"""
AgentVerse AI — API Gateway
=========================
FastAPI backend that handles user authentication (via Supabase JWT),
session persistence (via Neon/PostgreSQL), and triggers the 7-agent pipeline.

Endpoints:
- POST /api/sessions: Start a new run in the background (returns session_id)
- GET /api/sessions: Retrieve all runs for the authenticated user
- GET /api/sessions/{session_id}: Get detailed status/events of a run (IDOR protected)
"""

import datetime
import logging
import time
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config.settings import settings
from core.database import (
    create_session,
    get_session_state,
    get_user_sessions,
    SessionLocal,
    UserSession
)
from agents.pipeline_orchestrator import PipelineOrchestrator

logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(title="AgentVerse AI — API Gateway")

# ── CORS Middleware ──────────────────────────────────────────────────────────
# Checklist Item 4: Lock the API to allowed domains in production
allowed_origins = [settings.FRONTEND_URL]
if settings.MOCK_MODE:
    allowed_origins.append("*")  # Allow local debug origins during mock dev

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate Limiting (Memory-based Sliding Window) ────────────────────────────────
# Checklist Item 5: Rate limit triggering new pipelines (max 5 requests per 15 mins per IP)
RATE_LIMIT_WINDOW_SEC = 900  # 15 minutes
RATE_LIMIT_MAX = 5
request_history = defaultdict(list)

def rate_limit_check(request: Request):
    """Dependency validator enforcing request limits per IP to protect database and LLM tokens."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Prune old logs outside the 15-minute window
    request_history[client_ip] = [t for t in request_history[client_ip] if now - t < RATE_LIMIT_WINDOW_SEC]
    
    if len(request_history[client_ip]) >= RATE_LIMIT_MAX:
        logger.warning(f"[Rate Limit Alert] Client {client_ip} exceeded trigger rate limit.")
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait before triggering another pipeline run."
        )
    
    request_history[client_ip].append(now)


# ══════════════════════════════════════════════════════════════════════════════
#  SUPABASE JWT AUTHENTICATION DEPENDENCY
# ══════════════════════════════════════════════════════════════════════════════

class AuthenticatedUser:
    """Mock user object to match auth payloads."""
    def __init__(self, user_id: str, email: str):
        self.id = user_id
        self.email = email


def get_current_user(authorization: Optional[str] = Header(None)) -> AuthenticatedUser:
    """Verifies the Supabase JWT token from the Authorization header."""
    
    # MOCK MODE Fallback (for local testing without Supabase configured)
    if settings.MOCK_MODE or not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.info("[Auth] Mock Auth fallback active.")
        return AuthenticatedUser(
            user_id="hackathon_test_developer",
            email="developer@agentverse.ai"
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header scheme. Expected Bearer <JWT>"
        )

    token = authorization.split(" ")[1]
    
    try:
        from supabase import create_client, Client
        supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        response = supabase_client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid auth token")
        
        return AuthenticatedUser(
            user_id=response.user.id,
            email=response.user.email
        )
    except Exception as e:
        logger.error(f"[Auth] Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Session expired or invalid token")


# ══════════════════════════════════════════════════════════════════════════════
#  SCHEMAS & ROUTING
# ══════════════════════════════════════════════════════════════════════════════

class TriggerPipelineRequest(BaseModel):
    feature_request: str


async def run_pipeline_task(feature_request: str, session_id: str):
    """Executes the pipeline orchestrator in a background thread."""
    orchestrator = PipelineOrchestrator()
    try:
        await orchestrator.run_pipeline(feature_request, session_id=session_id)
    except Exception as e:
        logger.error(f"[Gateway] Background run failed for session {session_id}: {e}")


@app.post("/api/sessions", status_code=201, dependencies=[Depends(rate_limit_check)])
def start_pipeline_run(
    request: TriggerPipelineRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new run session and kick off the agent pipeline in the background."""
    prompt = request.feature_request.strip()
    
    # Input Sanitization (Checklist Item 3)
    if not prompt:
        raise HTTPException(status_code=400, detail="Feature request cannot be empty")
    if len(prompt) > 4000:
        raise HTTPException(status_code=400, detail="Feature request exceeds 4000 characters limit")

    try:
        # Create session in DB
        session_id = create_session(user.id, prompt)
        
        # Dispatch orchestrator run as background task (non-blocking)
        background_tasks.add_task(run_pipeline_task, prompt, session_id)
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": "Pipeline execution started in the background."
        }
    except Exception as e:
        logger.error(f"[Gateway] Failed to start pipeline run: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions")
def list_user_sessions(user: AuthenticatedUser = Depends(get_current_user)):
    """Retrieve all history runs for the authenticated user."""
    return get_user_sessions(user.id)


@app.get("/api/sessions/{session_id}")
def get_session_details(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Retrieve detailed state cards and events log for a specific run.

    Implements strict Authorization checks to prevent IDOR (Insecure Direct Object Reference) flaws.
    """
    db = SessionLocal()
    try:
        sess = db.query(UserSession).filter(UserSession.session_id == session_id).first()
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Checklist Item 1: Strict resource ownership authorization check
        if sess.user_id != user.id:
            logger.warning(f"[Security Alert] User {user.id} attempted unauthorized access to session {session_id}")
            raise HTTPException(
                status_code=403,
                detail="Access denied. You do not have permission to view this session."
            )
            
        return get_session_state(session_id)
    finally:
        db.close()


# ── Health Check & Monitoring ────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    """Endpoint for monitoring database and Gateway health (Checklist Item 8)."""
    db = SessionLocal()
    try:
        from sqlalchemy import text
        # Perform simple lookup to ensure Neon/SQLite is reachable
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        logger.critical(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")
    finally:
        db.close()


# ── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception hook to prevent raw stack trace leaks (Checklist Item 6)."""
    logger.critical(f"Unhandled system exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "An internal server error occurred. Please contact support."
        }
    )


# ── Mount Static Files ───────────────────────────────────────────────────────
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    print("Starting API Gateway server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
