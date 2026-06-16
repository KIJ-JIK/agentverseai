from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os

app = FastAPI()

class KeySubmit(BaseModel):
    key: str

@app.post("/api/keys")
def register_key(data: KeySubmit):
    if not data.key:
        raise HTTPException(status_code=400, detail="Key cannot be empty")
    # Simulate DB write
    return {"status": "success", "message": "Key registered successfully"}
