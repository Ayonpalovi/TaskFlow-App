import hashlib
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from account_status import now_iso, visible_user
from account_routes import activity, send_smtp_email


AssignableRole = Literal["editor", "client", "moderator"]


class AccountInviteWithModeratorIn(BaseModel):
    email: EmailStr
    real_name: str
    role: AssignableRole = "editor"
    skills: List[str] = []
    avatar_url: Optional[str] = None
    charge_per_project: float = 0


class AccountUpdateWithModeratorIn(BaseModel):
    email: Optional[EmailStr] = None
    real_name: Optional[str] = None
    role: Optional[AssignableRole] = None
    skills: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    charge_per_project: Optional[float] = None


def hash_invite(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def app_url() -> str:
    return (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_APP_URL") or os.environ.get("APP_URL") or "http://localhost:3000").rstrip("/")


def role_label(role: str) -> str:
    if role == "moderator":
        return "Moderator"
    if role == "client":
        return "Client"
    return "Editor"


def moderator_defaults(data: AccountInviteWithModeratorIn) -> dict:
    if data.role != "moderator":
        return {}
    return {
        "assigned_departments": data.skills,
        "permission_level": "Limited management access",
        "assigned_projects": [],
        "tasks_managed": 0,
        "client_conversations_handled": 0,
        "team_members_supervised": [],
        "escalation_notes": [],
    }


def build_moderator_account_patch_router(server):
    router = APIRouter(prefix="/api")

    @router.post("/account/users/invite")
    async def invite_account(data: AccountInviteWithModeratorIn, admin: dict = Depends(server.require_role("admin"))):
        email = data.email.lower()
        if await server.db.users.find_one({"email": email}):
            raise HTTPException(400, "Email already exists")

        invite_value = secrets.token_urlsafe(32)
        invite_days = int(os.environ.get("INVITE_TTL_DAYS", "7"))
        created_at = now_iso()
        invite_link = f"{app_url()}/accept-invite?token={invite_value}"
        doc = {
            "id": str(server.uuid.uuid4()),
            "email": email,
            "password_hash": server.hash_password(secrets.token_urlsafe(32)),
            "real_name": data.real_name,
            "anime_name": server.generate_anime_name() if data.role == "editor" else data.real_name,
            "role": data.role,
            "status": "invited",
            "skills": data.skills,
            "avatar_url": data.avatar_url,
            "xp": 0,
            "badges": [],
            "top_videos": [],
            "charge_per_project": data.charge_per_project if data.role == "editor" else 0,
            "invite_hash": hash_invite(invite_value),
            "invite_expires_at": (datetime.now(timezone.utc) + timedelta(days=invite_days)).isoformat(),
            "invited_at": created_at,
            "created_at": created_at,
            "updated_at": created_at,
            "created_by_admin_id": admin["id"],
            "last_seen": None,
            **moderator_defaults(data),
        }
        await server.db.users.insert_one(doc)

        body = f"Hi {data.real_name},\n\nYou have been invited to Motionholic OS as {role_label(data.role)}. Set up your account here:\n\n{invite_link}\n\nThis invite expires in {invite_days} days.\n\n— Motionholic OS"
        email_sent = send_smtp_email(email, "You have been invited to Motionholic OS", body)
        await activity(server, admin["id"], "user_invited", doc, {"role": data.role, "email_sent": email_sent})
        await server.create_notification(admin["id"], "user_invited", f"Invite created for {email}")
        result = visible_user(server, doc, viewer_role="admin")
        result["invite_url"] = invite_link
        result["email_sent"] = email_sent
        return result

    @router.patch("/account/users/{user_id}")
    async def update_account(user_id: str, data: AccountUpdateWithModeratorIn, admin: dict = Depends(server.require_role("admin"))):
        target = await server.db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "User not found")
        if target.get("role") == "admin":
            raise HTTPException(400, "Admin accounts cannot be changed here")

        updates = {}
        if data.email is not None:
            email = data.email.lower()
            existing = await server.db.users.find_one({"email": email, "id": {"$ne": user_id}})
            if existing:
                raise HTTPException(400, "Email already exists")
            updates["email"] = email
        if data.real_name is not None:
            updates["real_name"] = data.real_name
        if data.role is not None:
            updates["role"] = data.role
        if data.skills is not None:
            updates["skills"] = data.skills
        if data.avatar_url is not None:
            updates["avatar_url"] = data.avatar_url
        if data.charge_per_project is not None:
            updates["charge_per_project"] = data.charge_per_project

        final_role = updates.get("role") or target.get("role")
        if final_role in ["client", "moderator"]:
            updates["anime_name"] = updates.get("real_name") or target.get("real_name") or target.get("anime_name")
            updates["charge_per_project"] = 0
        elif final_role == "editor" and target.get("role") != "editor":
            updates["anime_name"] = server.generate_anime_name()
        if final_role == "moderator":
            updates.setdefault("permission_level", target.get("permission_level", "Limited management access"))
            if data.skills is not None:
                updates["assigned_departments"] = data.skills

        if not updates:
            raise HTTPException(400, "No changes provided")
        updates["updated_at"] = now_iso()
        await server.db.users.update_one({"id": user_id}, {"$set": updates})
        target.update(updates)
        await activity(server, admin["id"], "user_updated", target, {"updated_fields": list(updates.keys())})
        return {"ok": True, "user": visible_user(server, target, viewer_role="admin")}

    return router
