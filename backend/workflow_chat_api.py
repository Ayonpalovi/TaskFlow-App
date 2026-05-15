from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException

ALL_CHAT_ROLES = {"admin", "moderator", "editor", "client"}


def public_user(user: dict, viewer_role: str = "user") -> dict:
    role = user.get("role")
    name = user.get("anime_name") if role == "editor" else user.get("real_name") or user.get("display_name") or user.get("email")
    data = {
        "id": user.get("id"),
        "role": role,
        "anime_name": user.get("anime_name"),
        "display_name": name,
        "avatar_url": user.get("avatar_url"),
        "skills": user.get("skills", []),
        "online": False,
        "last_seen": user.get("last_seen"),
    }
    if viewer_role in {"admin", "moderator"}:
        data["real_name"] = user.get("real_name")
        data["email"] = user.get("email")
    return data


async def get_user(server, user_id: Optional[str]):
    if not user_id:
        raise HTTPException(400, "Missing user id")
    found = await server.db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not found:
        raise HTTPException(404, "User not found")
    return found


def sender_name(user: dict) -> str:
    return user.get("anime_name") if user.get("role") == "editor" else user.get("real_name") or user.get("display_name") or user.get("email") or "User"


def normalize_moderator_pair(
    first_id: str,
    second_id: str,
    first_role: Optional[str] = None,
    second_role: Optional[str] = None,
) -> str:
    if first_role == "moderator":
        return f"moddm:{first_id}:{second_id}"
    if second_role == "moderator":
        return f"moddm:{second_id}:{first_id}"
    participant_a, participant_b = sorted([first_id, second_id])
    return f"moddm:{participant_a}:{participant_b}"


async def normalize_chat_channel(server, user: dict, channel: str) -> str:
    if not channel:
        raise HTTPException(400, "Missing channel")

    user_role = user.get("role")
    user_id = user.get("id")

    if channel == "group":
        if user_role == "editor":
            return "group"
        raise HTTPException(403, "Only editors can use the editor group chat")

    if channel.startswith("moddm:"):
        parts = channel.split(":")
        if len(parts) != 3:
            raise HTTPException(400, "Invalid moderator DM channel")
        first_id, second_id = parts[1], parts[2]
        first = await get_user(server, first_id)
        second = await get_user(server, second_id)
        participant_roles = {first.get("role"), second.get("role")}
        if "moderator" not in participant_roles:
            raise HTTPException(400, "Invalid moderator channel")
        if not participant_roles.issubset(ALL_CHAT_ROLES):
            raise HTTPException(400, "Invalid chat participant")
        if user_id not in {first_id, second_id}:
            raise HTTPException(403, "You do not have access to this moderator conversation")
        return normalize_moderator_pair(first_id, second_id, first.get("role"), second.get("role"))

    if channel.startswith("dm:"):
        target_id = channel.split("dm:", 1)[1]
        if not target_id:
            raise HTTPException(400, "Invalid DM channel")
        if target_id == user_id:
            raise HTTPException(400, "You cannot DM yourself")

        target = await get_user(server, target_id)
        target_role = target.get("role")

        if user_role == "admin":
            if target_role not in ALL_CHAT_ROLES:
                raise HTTPException(403, "Admin can only DM admins, moderators, editors, or clients")
            if target_role == "moderator":
                return normalize_moderator_pair(target_id, user_id, target_role, user_role)
            return f"dm:{target_id}"

        if user_role == "moderator":
            if target_role not in ALL_CHAT_ROLES:
                raise HTTPException(403, "Moderator can only DM admins, moderators, editors, or clients")
            return normalize_moderator_pair(user_id, target_id, user_role, target_role)

        if user_role == "editor":
            if target_role == "moderator":
                return normalize_moderator_pair(target_id, user_id, target_role, user_role)
            if target_role == "admin":
                return f"dm:{user_id}"
            raise HTTPException(403, "Editors can only DM admins or moderators")

        if user_role == "client":
            if target_role == "moderator":
                return normalize_moderator_pair(target_id, user_id, target_role, user_role)
            if target_role == "admin":
                return f"dm:{user_id}"
            raise HTTPException(403, "Clients can only DM admins or moderators")

    raise HTTPException(403, "You do not have access to this conversation")


def attach_workflow_chat_routes(router, server):
    @router.get("/chat/conversations")
    async def workflow_chat_conversations(user: dict = Depends(server.get_current_user)):
        role = user.get("role")
        if role in {"admin", "moderator"}:
            query = {"role": {"$in": ["admin", "moderator", "editor", "client"]}}
        elif role in {"editor", "client"}:
            query = {"role": {"$in": ["admin", "moderator"]}}
        else:
            raise HTTPException(403, "Forbidden")

        users = await server.db.users.find(query, {"_id": 0, "password_hash": 0}).sort("role", 1).to_list(1000)
        return [public_user(item, viewer_role=role) for item in users if item.get("id") != user.get("id")]

    @router.get("/chat/messages")
    async def workflow_chat_messages(channel: str, user: dict = Depends(server.get_current_user)):
        normalized = await normalize_chat_channel(server, user, channel)
        items = await server.db.messages.find({"channel": normalized}, {"_id": 0}).sort("created_at", 1).to_list(1000)
        return items

    @router.post("/chat/messages")
    async def workflow_chat_send_message(payload: dict, user: dict = Depends(server.get_current_user)):
        normalized = await normalize_chat_channel(server, user, payload.get("channel"))
        content = (payload.get("content") or "").strip()
        if not content:
            raise HTTPException(400, "Message cannot be empty")
        msg = {
            "id": str(uuid.uuid4()),
            "channel": normalized,
            "sender_id": user["id"],
            "sender_name": sender_name(user),
            "sender_role": user["role"],
            "type": "text",
            "content": content,
            "created_at": server.now_iso() if hasattr(server, "now_iso") else __import__("datetime").datetime.utcnow().isoformat(),
            "reactions": {},
        }
        await server.db.messages.insert_one(msg.copy())
        msg.pop("_id", None)
        return msg

    @router.post("/chat/messages/voice")
    async def workflow_chat_send_voice(payload: dict, user: dict = Depends(server.get_current_user)):
        normalized = await normalize_chat_channel(server, user, payload.get("channel"))
        audio_data = payload.get("audio_data") or ""
        if len(audio_data) > 700000:
            raise HTTPException(400, "Audio too large (max ~500KB)")
        msg = {
            "id": str(uuid.uuid4()),
            "channel": normalized,
            "sender_id": user["id"],
            "sender_name": sender_name(user),
            "sender_role": user["role"],
            "type": "voice",
            "audio_data": audio_data,
            "duration_sec": payload.get("duration_sec", 0),
            "content": "",
            "created_at": server.now_iso() if hasattr(server, "now_iso") else __import__("datetime").datetime.utcnow().isoformat(),
            "reactions": {},
        }
        await server.db.messages.insert_one(msg.copy())
        msg.pop("_id", None)
        return msg

    @router.post("/chat/messages/{msg_id}/reactions")
    async def workflow_chat_react(msg_id: str, payload: dict, user: dict = Depends(server.get_current_user)):
        msg = await server.db.messages.find_one({"id": msg_id}, {"_id": 0})
        if not msg:
            raise HTTPException(404, "Not found")
        await normalize_chat_channel(server, user, msg.get("channel"))
        emoji = payload.get("emoji")
        if not emoji:
            raise HTTPException(400, "Missing emoji")
        reactions = msg.get("reactions", {}) or {}
        users = reactions.get(emoji, []) or []
        if user["id"] in users:
            users.remove(user["id"])
        else:
            users.append(user["id"])
        if users:
            reactions[emoji] = users
        else:
            reactions.pop(emoji, None)
        await server.db.messages.update_one({"id": msg_id}, {"$set": {"reactions": reactions}})
        return {"reactions": reactions}

    return router
