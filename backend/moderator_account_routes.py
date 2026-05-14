import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from account_status import now_iso, visible_user


class ModeratorInviteIn(BaseModel):
    email: EmailStr
    real_name: str


def hash_invite(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def build_moderator_account_router(server):
    router = APIRouter(prefix="/api")

    @router.post("/absence-mode/moderators/invite")
    async def invite_moderator_account(data: ModeratorInviteIn, admin: dict = Depends(server.require_role("admin"))):
        email = data.email.lower()
        if await server.db.users.find_one({"email": email}):
            raise HTTPException(400, "Email already exists")

        invite_value = secrets.token_urlsafe(32)
        invite_days = 7
        app_base = (server.os.environ.get("FRONTEND_URL") or server.os.environ.get("PUBLIC_APP_URL") or server.os.environ.get("APP_URL") or "http://localhost:3000").rstrip("/")
        invite_link = f"{app_base}/accept-invite?token={invite_value}"
        created_at = now_iso()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=invite_days)).isoformat()
        user_id = str(server.uuid.uuid4())

        doc = {
            "id": user_id,
            "email": email,
            "password_hash": server.hash_password(secrets.token_urlsafe(32)),
            "real_name": data.real_name,
            "anime_name": data.real_name,
            "role": "moderator",
            "status": "invited",
            "skills": [],
            "avatar_url": None,
            "xp": 0,
            "badges": [],
            "top_videos": [],
            "charge_per_project": 0,
            "invite_hash": hash_invite(invite_value),
            "invite_expires_at": expires_at,
            "invited_at": created_at,
            "created_at": created_at,
            "updated_at": created_at,
            "created_by_admin_id": admin["id"],
            "last_seen": None,
        }

        await server.db.users.insert_one(doc)
        await server.create_notification(
            admin["id"],
            "moderator_invited",
            f"Moderator invite created for {email}",
            body="Copy the setup link and send it to the temporary Agency Manager.",
            link="/admin/absence",
        )

        result = visible_user(server, doc, viewer_role="admin")
        result["invite_url"] = invite_link
        result["email_sent"] = False
        return result

    return router
