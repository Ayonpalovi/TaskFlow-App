import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "taskflow-secret-change-me-please-xyz-0123456789")
JWT_ALG = "HS256"

# Shares the same Mongo deployment/database as the main app (server.py) —
# Growth-mode data lives in its own collections (growth_leads, growth_activities,
# etc.) so it can't collide with TaskFlow's existing tasks/users/etc.
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    token = request.cookies.get("access_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_growth_access(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin" and not user.get("lead_gen_access"):
        raise HTTPException(403, "You don't have access to Growth mode. Ask an admin to enable it.")
    return user
