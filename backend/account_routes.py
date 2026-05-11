import hashlib
import os
import secrets
import smtplib
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr

from account_status import now_iso, user_status, visible_user


class AccountInviteIn(BaseModel):
    email: EmailStr
    real_name: str
    role: Literal["editor", "client"] = "editor"
    skills: List[str] = []
    avatar_url: Optional[str] = None
    charge_per_project: float = 0


class AcceptInviteIn(BaseModel):
    token: str
    password: str
    confirm_password: str


def hash_invite(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def app_url() -> str:
    return (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_APP_URL") or os.environ.get("APP_URL") or "http://localhost:3000").rstrip("/")


def send_smtp_email(to_email: str, subject: str, body: str) -> bool:
    host = os.environ.get("SMTP_HOST")
    username = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    sender = os.environ.get("SMTP_FROM") or username
    port = int(os.environ.get("SMTP_PORT", "587"))

    if not host or not username or not password or not sender or not to_email:
        print("SMTP skipped: missing SMTP env config or recipient")
        return False

    try:
        message = EmailMessage()
        message["From"] = sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(host, port, timeout=12) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)

        return True
    except Exception as exc:
        print(f"SMTP send failed: {exc}")
        return False


async def activity(server, actor_id: str, action: str, target: dict, meta: Optional[dict] = None):
    await server.db.activity_logs.insert_one({
        "id": str(server.uuid.uuid4()),
        "actor_id": actor_id,
        "action": action,
        "target_user_id": target.get("id"),
        "target_email": target.get("email"),
        "metadata": meta or {},
        "created_at": now_iso(),
    })


def build_account_router(server):
    router = APIRouter(prefix="/api")

    @router.post("/account/users/invite")
    async def invite_account(data: AccountInviteIn, admin: dict = Depends(server.require_role("admin"))):
        email = data.email.lower()
        if await server.db.users.find_one({"email": email}):
            raise HTTPException(400, "Email already exists")

        invite_value = secrets.token_urlsafe(32)
        invite_days = int(os.environ.get("INVITE_TTL_DAYS", "7"))
        invite_link = f"{app_url()}/accept-invite?token={invite_value}"
        created_at = now_iso()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=invite_days)).isoformat()
        user_id = str(server.uuid.uuid4())
        doc = {
            "id": user_id,
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
            "charge_per_project": data.charge_per_project,
            "invite_hash": hash_invite(invite_value),
            "invite_expires_at": expires_at,
            "invited_at": created_at,
            "created_at": created_at,
            "updated_at": created_at,
            "created_by_admin_id": admin["id"],
            "last_seen": None,
        }
        await server.db.users.insert_one(doc)

        invite_body = (
            f"Hi {data.real_name},\n\n"
            "You have been invited to Motionholic OS. Set up your account here:\n\n"
            f"{invite_link}\n\n"
            f"This invite expires in {invite_days} days.\n\n"
            "— Motionholic OS"
        )
        email_sent = send_smtp_email(email, "You have been invited to Motionholic OS", invite_body)

        await activity(server, admin["id"], "user_invited", doc, {"role": data.role, "email_sent": email_sent})
        notification_body = "Invite email sent successfully." if email_sent else "Email is not configured yet. Copy the setup link from the invite result."
        await server.create_notification(admin["id"], "user_invited", f"Invite created for {email}", body=notification_body)
        result = visible_user(server, doc, viewer_role="admin")
        result["invite_url"] = invite_link
        result["email_sent"] = email_sent
        return result

    @router.post("/auth/accept-invite")
    async def accept_invite(data: AcceptInviteIn, response: Response):
        if data.password != data.confirm_password:
            raise HTTPException(400, "Passwords do not match")
        if len(data.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")

        user = await server.db.users.find_one({"invite_hash": hash_invite(data.token)})
        if not user or user_status(user) != "invited":
            raise HTTPException(400, "Invalid or already used invite link")

        expires_at = user.get("invite_expires_at")
        if expires_at and datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.now(timezone.utc):
            raise HTTPException(400, "This invite link has expired")

        updates = {
            "password_hash": server.hash_password(data.password),
            "status": "active",
            "activated_at": now_iso(),
            "updated_at": now_iso(),
            "last_seen": now_iso(),
        }
        await server.db.users.update_one({"id": user["id"]}, {"$set": updates, "$unset": {"invite_hash": "", "invite_expires_at": ""}})
        user.update(updates)
        token = server.create_access_token(user["id"], user["role"])
        response.set_cookie(key="access_token", value=token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
        return {"token": token, "user": visible_user(server, user, viewer_role=user["role"])}

    @router.delete("/account/users/{user_id}/deactivate")
    async def deactivate_account(user_id: str, admin: dict = Depends(server.require_role("admin"))):
        target = await server.db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "User not found")
        if target.get("role") == "admin":
            raise HTTPException(400, "Admin accounts cannot be changed here")

        deactivation_body = (
            f"Hi {target.get('real_name') or target.get('anime_name') or 'there'},\n\n"
            "Your Motionholic OS account has been deactivated by the admin. You will no longer have access to the dashboard.\n\n"
            "Your previous project history, task records, messages, and performance data will remain safely stored in Motionholic OS.\n\n"
            "If you believe this was a mistake, please contact the Motionholic team.\n\n"
            "— Motionholic OS"
        )
        email_sent = send_smtp_email(target.get("email"), "Your Motionholic OS account has been deactivated", deactivation_body)

        updates = {"status": "deactivated", "deactivated_at": now_iso(), "deactivated_by_admin_id": admin["id"], "updated_at": now_iso()}
        await server.db.users.update_one({"id": user_id}, {"$set": updates})
        target.update(updates)
        await activity(server, admin["id"], "user_deactivated", target, {"email_sent": email_sent})
        await server.create_notification(admin["id"], "user_deactivated", f"{target.get('email')} was deactivated", body="Project history and records were kept safe.")
        return {"ok": True, "email_sent": email_sent, "user": visible_user(server, target, viewer_role="admin")}

    @router.post("/account/users/{user_id}/reactivate")
    async def reactivate_account(user_id: str, admin: dict = Depends(server.require_role("admin"))):
        target = await server.db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "User not found")
        updates = {"status": "active", "reactivated_at": now_iso(), "reactivated_by_admin_id": admin["id"], "updated_at": now_iso()}
        await server.db.users.update_one({"id": user_id}, {"$set": updates, "$unset": {"deactivated_at": "", "deactivated_by_admin_id": ""}})
        target.update(updates)
        target.pop("deactivated_at", None)
        target.pop("deactivated_by_admin_id", None)

        reactivate_body = (
            f"Hi {target.get('real_name') or target.get('anime_name') or 'there'},\n\n"
            f"Your Motionholic OS account has been reactivated. You can sign in again here: {app_url()}/login\n\n"
            "— Motionholic OS"
        )
        email_sent = send_smtp_email(target.get("email"), "Your Motionholic OS account has been reactivated", reactivate_body)

        await activity(server, admin["id"], "user_reactivated", target, {"email_sent": email_sent})
        await server.create_notification(admin["id"], "user_reactivated", f"{target.get('email')} was reactivated")
        return {"ok": True, "email_sent": email_sent, "user": visible_user(server, target, viewer_role="admin")}

    @router.delete("/account/users/{user_id}/delete")
    async def delete_account(user_id: str, admin: dict = Depends(server.require_role("admin"))):
        target = await server.db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "User not found")
        if target.get("role") == "admin":
            raise HTTPException(400, "Admin accounts cannot be deleted here")

        await activity(server, admin["id"], "user_deleted", target, {"role": target.get("role")})
        result = await server.db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(404, "User not found")

        await server.db.notifications.delete_many({"user_id": user_id})
        await server.create_notification(admin["id"], "user_deleted", f"{target.get('email')} was deleted", body="The login account was removed. Existing project records were not deleted.")
        return {"ok": True, "deleted_user_id": user_id, "email": target.get("email")}

    return router
