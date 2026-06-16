"""
DevFlow AI — Centralised Configuration
========================================
Uses pydantic-settings so every environment variable is validated at startup.
Copy .env.example → .env and fill in your real keys.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """All environment variables consumed by the DevFlow AI backend.

    Values are loaded from a `.env` file automatically thanks to
    ``SettingsConfigDict(env_file=".env")``.  Any variable that is
    already exported in the shell takes precedence.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",           # silently ignore unknown keys in .env
    )

    # ── Development / Mock Mode ──────────────────────────────────────────
    MOCK_MODE: bool = Field(default=True, description="Skip real API calls when True")

    # ── AI/ML API (Reasoning cluster) ────────────────────────────────────
    AIML_API_KEY: str = Field(default="", description="AI/ML API secret key")
    AIML_BASE_URL: str = Field(
        default="https://api.aimlapi.com/v1",
        description="Base URL for the AI/ML API (OpenAI-compatible)",
    )
    AIML_MODEL: str = Field(
        default="meta-llama/Llama-3-70b-instruct",
        description="Model ID for reasoning agents (Architect, Reviewer, Release Manager)",
    )

    # ── Featherless AI (Code-gen cluster) ────────────────────────────────
    FEATHERLESS_API_KEY: str = Field(default="", description="Featherless AI secret key")
    FEATHERLESS_BASE_URL: str = Field(
        default="https://api.featherless.ai/v1",
        description="Base URL for Featherless AI (OpenAI-compatible)",
    )
    FEATHERLESS_MODEL: str = Field(
        default="Qwen/Qwen2.5-Coder-32B-Instruct",
        description="Model ID for code-gen agents (FE Dev, BE Dev, QA, Tech Writer)",
    )

    # ── Band API (Multi-Agent Coordination Bus) ──────────────────────────
    BAND_BASE_URL: str = Field(
        default="https://app.band.ai",
        description="Base URL for the Band multi-agent bus",
    )
    BAND_ROOM_ID: str = Field(
        default="orchestrator-local",
        description="The Band room/chat ID shared by all 7 agents",
    )

    # Per-agent Band API keys
    BAND_API_KEY_ARCHITECT: str = Field(default="")
    BAND_API_KEY_FRONTEND: str = Field(default="")
    BAND_API_KEY_BACKEND: str = Field(default="")
    BAND_API_KEY_REVIEWER: str = Field(default="")
    BAND_API_KEY_QA_TESTER: str = Field(default="")
    BAND_API_KEY_TECH_WRITER: str = Field(default="")
    BAND_API_KEY_RELEASE_MANAGER: str = Field(default="")

    # ── CORS Configurations ──────────────────────────────────────────────
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Allowed origin URL for CORS requests (e.g. Next.js dashboard URL)",
    )

    # ── Supabase (Authentication — used by Vercel frontend) ──────────────
    SUPABASE_URL: str = Field(
        default="",
        description="Supabase project URL (e.g. https://xxxx.supabase.co)",
    )
    SUPABASE_ANON_KEY: str = Field(
        default="",
        description="Supabase anon / public key for JWT verification",
    )
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        default="",
        description="Supabase service-role key (server-side only)",
    )

    # ── Neon Database (PostgreSQL) ────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="",
        description="Neon / PostgreSQL connection string",
    )


    # ── Render (Deployment) ──────────────────────────────────────────────
    RENDER_API_KEY: str = Field(
        default="",
        description="Render.com API key for deployment automation",
    )

    # ── Helper ───────────────────────────────────────────────────────────
    def get_band_api_key(self, agent_name: str) -> str:
        """Return the correct Band API key for a given agent class name."""
        mapping = {
            "ArchitectAgent": self.BAND_API_KEY_ARCHITECT,
            "FrontendDevAgent": self.BAND_API_KEY_FRONTEND,
            "BackendDevAgent": self.BAND_API_KEY_BACKEND,
            "CodeReviewerAgent": self.BAND_API_KEY_REVIEWER,
            "QATesterAgent": self.BAND_API_KEY_QA_TESTER,
            "TechWriterAgent": self.BAND_API_KEY_TECH_WRITER,
            "ReleaseManagerAgent": self.BAND_API_KEY_RELEASE_MANAGER,
        }
        return mapping.get(agent_name, "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton factory — import this instead of instantiating Settings directly."""
    return Settings()


# Convenience alias so existing `from config.settings import settings` still works
settings = get_settings()
