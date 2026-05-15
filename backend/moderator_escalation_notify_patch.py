from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


class ModeratorEscalationNotifyIn(BaseModel):
    title: str
    body: str = ""
    project_id: Optional[str] = None
    category: str = "general"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _clean(doc):
    item = dict(doc or {})
    item.pop("_id", None)
    return item


def build_moderator_escalation_notify_router(server):
    router = APIRouter(prefix="/api", tags=["moderator-escalation-notify"])

    @router.post("/moderator/escalations")
    async def create_moderator_escalation(data: ModeratorEscalationNotifyIn, user: dict = Depends(server.get_current_user)):
        if user.get("role") not in ["moderator", "admin"]:
            raise HTTPException(403, "Moderator access only")

        title = (data.title or "").strip()
        if not title:
            raise HTTPException(400, "Issue title is required")

        moderator_name = user.get("real_name") or user.get("display_name") or user.get("email") or "Moderator"
        category = data.category or "general"
        body = (data.body or "").strip()

        escalation = {
            "id": str(server.uuid.uuid4()),
            "actor_id": user["id"],
            "actor_name": moderator_name,
            "actor_role": user.get("role"),
            "action": "moderator_escalation",
            "target_user_id": None,
            "target_email": title,
            "metadata": {
                "project_id": data.project_id,
                "category": category,
                "title": title,
                "body": body,
                "status": "sent_to_admin",
            },
            "created_at": _now_iso(),
        }

        await server.db.activity_logs.insert_one(escalation.copy())

        notification_title = f"Moderator escalation: {title}"
        notification_body = f"From: {moderator_name}\nCategory: {category}"
        if body:
            notification_body += f"\nMessage: {body}"

        admin_users = await server.db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
        sent_count = 0
        for admin_user in admin_users:
            try:
                await server.create_notification(
                    admin_user["id"],
                    "moderator_escalation",
                    notification_title,
                    body=notification_body,
                    link="/admin",
                )
                sent_count += 1
            except Exception as exc:
                print(f"Moderator escalation admin notification failed: {exc}")

        await server.db.activity_logs.update_one(
            {"id": escalation["id"]},
            {"$set": {"metadata.notification_sent": sent_count > 0, "metadata.admin_notifications_sent": sent_count}},
        )
        escalation["metadata"]["notification_sent"] = sent_count > 0
        escalation["metadata"]["admin_notifications_sent"] = sent_count

        return {"ok": True, "notification_sent": sent_count > 0, "admin_notifications_sent": sent_count, "escalation": _clean(escalation)}

    return router
