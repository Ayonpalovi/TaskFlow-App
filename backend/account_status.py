from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def user_status(user: dict) -> str:
    return user.get("status") or "active"


def visible_user(server, user: dict, viewer_role: str = "admin") -> dict:
    clean = dict(user)
    clean.pop("_id", None)
    clean.pop("password_hash", None)
    out = server.scrub_user(clean, viewer_role=viewer_role)
    out["status"] = user_status(clean)
    out["invited_at"] = clean.get("invited_at")
    out["activated_at"] = clean.get("activated_at")
    out["deactivated_at"] = clean.get("deactivated_at")
    return out


def install_status_patch(server):
    if getattr(server, "_account_status_patch_installed", False):
        return

    original_scrub = server.scrub_user

    def patched_scrub_user(user: dict, viewer_role: str = None) -> dict:
        out = original_scrub(user, viewer_role=viewer_role)
        out["status"] = user_status(user)
        if viewer_role == "admin":
            out["invited_at"] = user.get("invited_at")
            out["activated_at"] = user.get("activated_at")
            out["deactivated_at"] = user.get("deactivated_at")
        return out

    async def patched_notify_role(role: str, ntype: str, title: str, body: str = "", link: str = None):
        users = await server.db.users.find({"role": role, "status": {"$ne": "deactivated"}}, {"id": 1, "_id": 0}).to_list(500)
        for item in users:
            await server.create_notification(item["id"], ntype, title, body, link)

    server.scrub_user = patched_scrub_user
    server.notify_role = patched_notify_role
    server._account_status_patch_installed = True
