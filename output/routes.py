from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class AuthPayload(BaseModel):
    name: str
    value: str

@app.post("/api/auth")
def handle_auth(payload: AuthPayload):
    if not payload.name:
        raise HTTPException(status_code=400, detail="Name field is required")
    return {
        "status": "success", 
        "message": "Auth resources mutated successfully",
        "payload": payload.dict()
    }
