from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import random
import logging
import asyncio
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --- Config ---
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'taskflow-secret-change-me-please-xyz-0123456789')
JWT_ALG = 'HS256'
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@taskflow.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TaskFlow API")
api = APIRouter(prefix="/api")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Anime name pool ---
ANIME_FIRST = ["Shadow", "Crimson", "Azure", "Silver", "Twilight", "Lunar", "Solar", "Ember", "Frost", "Storm",
               "Raven", "Phantom", "Mystic", "Crystal", "Obsidian", "Celestial", "Nova", "Echo", "Zephyr", "Onyx"]
ANIME_LAST = ["Samurai", "Kitsune", "Ronin", "Oni", "Dragon", "Phoenix", "Wolf", "Tiger", "Blade", "Sage",
              "Ninja", "Shogun", "Warrior", "Shinobi", "Hunter", "Spirit", "Falcon", "Reaper", "Knight", "Voyager"]

def generate_anime_name() -> str:
    return f"{random.choice(ANIME_FIRST)}{random.choice(ANIME_LAST)}{random.randint(10, 99)}"

# --- Password helpers ---
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

# --- JWT helpers ---
def create_access_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    # update last_seen
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}})
    return user

def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return checker

# --- Models ---
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    real_name: str
    role: Literal["editor", "client"]
    skills: List[str] = []
    avatar_url: Optional[str] = None
    charge_per_project: float = 0

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    name: str
    code: str

class TopVideoIn(BaseModel):
    url: str
    title: str = ""

class ReactionIn(BaseModel):
    emoji: str

class VoiceMessageIn(BaseModel):
    channel: str
    audio_data: str
    duration_sec: float = 0

class TaskCreateIn(BaseModel):
    title: str
    client_id: Optional[str] = None
    project_type: str
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    deadline: str  # ISO date
    num_videos: int = 1
    duration: str = ""
    resolution: str = "1080p"
    aspect_ratio: str = "16:9"
    footages_url: Optional[str] = None
    script_url: Optional[str] = None
    brief_goal: str = ""
    brief_audience: str = ""
    brief_style: str = ""
    brief_hook: str = ""
    brief_body: str = ""
    brief_cta: str = ""
    brief_references: str = ""
    brief_notes: str = ""
    skill_tags: List[str] = []
    assigned_editor_id: Optional[str] = None
    revenue: float = 0
    cost: float = 0
    is_draft: bool = False

class RevisionIn(BaseModel):
    note: str

class ReviewIn(BaseModel):
    rating: int
    feedback: str = ""

class MessageIn(BaseModel):
    channel: str  # "group" or "dm:userid"
    content: str

class DraftIn(BaseModel):
    url: str
    note: str = ""

# --- Helpers ---
def scrub_user(u: dict, viewer_role: str = None) -> dict:
    """Return user public view. Editors get anonymous only (no real_name/email)."""
    out = {
        "id": u["id"],
        "anime_name": u.get("anime_name"),
        "display_name": u.get("anime_name") if u["role"] == "editor" else u.get("real_name"),
        "role": u["role"],
        "avatar_url": u.get("avatar_url"),
        "skills": u.get("skills", []),
        "online": is_online(u),
        "last_seen": u.get("last_seen"),
        "xp": u.get("xp", 0),
        "level": compute_level(u.get("xp", 0))[0],
        "level_name": compute_level(u.get("xp", 0))[1],
        "level_progress_pct": compute_level(u.get("xp", 0))[2],
        "badges": u.get("badges", []),
        "top_videos": u.get("top_videos", []),
        "burnout": u.get("burnout", "low"),
    }
    if viewer_role == "admin":
        out["real_name"] = u.get("real_name")
        out["email"] = u.get("email")
        out["charge_per_project"] = u.get("charge_per_project", 0)
    return out

def is_online(u: dict) -> bool:
    ls = u.get("last_seen")
    if not ls:
        return False
    try:
        t = datetime.fromisoformat(ls.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - t).total_seconds() < 120
    except Exception:
        return False

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# --- XP / Level / Badge logic ---
LEVEL_THRESHOLDS = [
    (1, "Rookie", 0),
    (2, "Rookie", 50),
    (3, "Rookie", 120),
    (4, "Rookie", 220),
    (5, "Pro Cutter", 350),
    (6, "Pro Cutter", 500),
    (7, "Pro Cutter", 680),
    (8, "Pro Cutter", 880),
    (9, "Pro Cutter", 1100),
    (10, "Cinematic Beast", 1400),
    (15, "Cinematic Beast", 2200),
    (20, "Editing God", 3200),
    (25, "Editing God", 4500),
    (30, "Editing God", 6000),
]

def compute_level(xp: int):
    """Returns (level_num, level_name, progress_pct_to_next)."""
    xp = max(0, int(xp or 0))
    cur = LEVEL_THRESHOLDS[0]
    nxt = LEVEL_THRESHOLDS[-1]
    for i, t in enumerate(LEVEL_THRESHOLDS):
        if xp >= t[2]:
            cur = t
            nxt = LEVEL_THRESHOLDS[i + 1] if i + 1 < len(LEVEL_THRESHOLDS) else t
    if cur == nxt:
        return cur[0], cur[1], 100
    span = nxt[2] - cur[2]
    pct = round(((xp - cur[2]) / span) * 100, 1) if span > 0 else 100
    return cur[0], cur[1], min(100, max(0, pct))

BADGE_DEFS = {
    "first_delivery": {"icon": "🎯", "name": "First Delivery", "desc": "Completed your first project"},
    "three_in_one_day": {"icon": "⚡", "name": "3 Tasks in 1 Day", "desc": "Delivered 3 projects in 24h"},
    "zero_revisions_streak": {"icon": "🧠", "name": "Zero Revisions Streak", "desc": "3 deliveries in a row with zero revisions"},
    "survived_5_urgent": {"icon": "💀", "name": "Survived 5 Urgent", "desc": "Completed 5 urgent-priority tasks"},
    "level_5": {"icon": "🥋", "name": "Pro Cutter", "desc": "Reached Level 5"},
    "level_10": {"icon": "🎬", "name": "Cinematic Beast", "desc": "Reached Level 10"},
    "level_20": {"icon": "👑", "name": "Editing God", "desc": "Reached Level 20"},
}

async def award_xp(editor_id: str, amount: int, reason: str):
    u = await db.users.find_one({"id": editor_id})
    if not u: return
    new_xp = max(0, (u.get("xp", 0) or 0) + amount)
    old_level = compute_level(u.get("xp", 0))[0]
    new_level = compute_level(new_xp)[0]
    await db.users.update_one({"id": editor_id}, {"$set": {"xp": new_xp}})
    await create_notification(editor_id, "xp", f"{'+' if amount >= 0 else ''}{amount} XP — {reason}", body=f"You're now at {new_xp} XP.")
    if new_level > old_level:
        await create_notification(editor_id, "level_up", f"Level up! → Lv {new_level}", body=compute_level(new_xp)[1])
        # auto-badge
        for thr, key in [(5, "level_5"), (10, "level_10"), (20, "level_20")]:
            if old_level < thr <= new_level:
                await unlock_badge(editor_id, key)

async def unlock_badge(editor_id: str, key: str):
    if key not in BADGE_DEFS: return
    u = await db.users.find_one({"id": editor_id})
    if not u: return
    badges = u.get("badges", []) or []
    if key in badges: return
    badges.append(key)
    await db.users.update_one({"id": editor_id}, {"$set": {"badges": badges}})
    bd = BADGE_DEFS[key]
    await create_notification(editor_id, "badge", f"Badge unlocked: {bd['name']}", body=bd["desc"])

async def evaluate_badges(editor_id: str):
    """Re-check and unlock any earned badges."""
    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    completed = await db.tasks.find({"assigned_editor_id": editor_id, "status": "completed"}, {"_id": 0}).to_list(2000)
    if len(completed) >= 1:
        await unlock_badge(editor_id, "first_delivery")
    # 3 in 24h
    recent = [t for t in completed if t.get("completed_at", "") >= cutoff_24h]
    if len(recent) >= 3:
        await unlock_badge(editor_id, "three_in_one_day")
    # zero revisions streak (last 3)
    completed_sorted = sorted(completed, key=lambda x: x.get("completed_at", ""), reverse=True)[:3]
    if len(completed_sorted) >= 3 and all(len(t.get("revisions", [])) == 0 for t in completed_sorted):
        await unlock_badge(editor_id, "zero_revisions_streak")
    # 5 urgent
    urgent = [t for t in completed if t.get("priority") == "urgent"]
    if len(urgent) >= 5:
        await unlock_badge(editor_id, "survived_5_urgent")

async def compute_burnout(editor_id: str) -> str:
    active = await db.tasks.count_documents({"assigned_editor_id": editor_id, "status": {"$in": ["active", "submitted", "client_review"]}})
    revisions = await db.tasks.count_documents({"assigned_editor_id": editor_id, "status": "revision"})
    urgent = await db.tasks.count_documents({"assigned_editor_id": editor_id, "status": {"$in": ["active", "submitted", "revision"]}, "priority": "urgent"})
    score = active * 10 + revisions * 15 + urgent * 12
    if score >= 60: return "high"
    if score >= 30: return "medium"
    return "low"

# --- Notifications ---
async def create_notification(user_id: str, ntype: str, title: str, body: str = "", link: str = None):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "link": link,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    return doc

async def notify_role(role: str, ntype: str, title: str, body: str = "", link: str = None):
    users = await db.users.find({"role": role}, {"id": 1, "_id": 0}).to_list(500)
    for u in users:
        await create_notification(u["id"], ntype, title, body, link)

# --- Auth endpoints ---
@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    u = await db.users.find_one({"email": data.email.lower()})
    if not u or not verify_password(data.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(u["id"], u["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True, samesite="none",
        max_age=60 * 60 * 24 * 7, path="/"
    )
    await db.users.update_one({"id": u["id"]}, {"$set": {"last_seen": now_iso()}})
    return {"token": token, "user": scrub_user(u, viewer_role="admin" if u["role"] == "admin" else u["role"])}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    user["burnout"] = await compute_burnout(user["id"]) if user["role"] == "editor" else "low"
    return scrub_user(user, viewer_role="admin" if user["role"] == "admin" else user["role"])

REGISTRATION_CODE = "42202010"

@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    if data.code != REGISTRATION_CODE:
        raise HTTPException(400, "Incorrect access code")
    if data.password != data.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "real_name": data.name,
        "anime_name": generate_anime_name(),
        "role": "editor",
        "skills": [],
        "avatar_url": None,
        "xp": 0,
        "badges": [],
        "top_videos": [],
        "charge_per_project": 0,
        "created_at": now_iso(),
        "last_seen": None,
    }
    await db.users.insert_one(doc)
    token = create_access_token(uid, "editor")
    await notify_role("admin", "new_editor_signup", f"New editor signed up: {doc['anime_name']}", body=data.email)
    doc.pop("_id", None); doc.pop("password_hash", None)
    return {"token": token, "user": scrub_user(doc, viewer_role="editor")}

# --- Users ---
@api.post("/users")
async def create_user(data: UserCreateIn, admin: dict = Depends(require_role("admin"))):
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "real_name": data.real_name,
        "anime_name": generate_anime_name() if data.role == "editor" else data.real_name,
        "role": data.role,
        "skills": data.skills,
        "avatar_url": data.avatar_url,
        "xp": 0,
        "badges": [],
        "top_videos": [],
        "charge_per_project": data.charge_per_project,
        "created_at": now_iso(),
        "last_seen": None,
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None); doc.pop("password_hash", None)
    return scrub_user(doc, viewer_role="admin")

@api.get("/users")
async def list_users(
    role: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    q = {}
    if role:
        q["role"] = role
    items = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(500)
    return [scrub_user(u, viewer_role=user["role"]) for u in items]

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_role("admin"))):
    await db.users.delete_one({"id": user_id})
    return {"ok": True}

# --- Projects / Tasks ---
@api.post("/tasks")
async def create_task(data: TaskCreateIn, user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    if user["role"] == "client":
        # Client-created project: needs admin approval first
        status = "pending_admin_approval"
        client_id = user["id"]
        assigned_editor_id = None
        is_draft = False
    elif user["role"] == "admin":
        status = "draft" if data.is_draft else ("active" if data.assigned_editor_id else "available")
        client_id = data.client_id
        assigned_editor_id = data.assigned_editor_id
        is_draft = data.is_draft
    else:
        raise HTTPException(403, "Only admin or client can create tasks")

    payload = data.model_dump()
    payload["client_id"] = client_id
    payload["assigned_editor_id"] = assigned_editor_id
    payload["is_draft"] = is_draft

    doc = {
        "id": tid,
        "status": status,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by": user["id"],
        "creator_role": user["role"],
        "available_at": None,
        "submitted_at": None,
        "video_url": None,
        **payload,
    }
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    if status == "pending_admin_approval":
        await notify_role("admin", "project_pending_approval", f"New project from client: {data.title}", link=f"/admin/approvals")
    elif status == "available":
        doc["available_at"] = now_iso()
        await db.tasks.update_one({"id": tid}, {"$set": {"available_at": doc["available_at"]}})
        await notify_role("editor", "new_brief", f"New open brief: {data.project_type}", link="/editor/available")
    return doc

@api.post("/tasks/{task_id}/admin-approve")
async def admin_approve_project(task_id: str, admin: dict = Depends(require_role("admin"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("status") != "pending_admin_approval":
        raise HTTPException(400, "Task not pending approval")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "available", "available_at": now_iso(), "updated_at": now_iso()}})
    if t.get("client_id"):
        await create_notification(t["client_id"], "project_approved", f"Your project '{t['title']}' was approved", link="/client/panel")
    await notify_role("editor", "new_brief", f"New open brief: {t.get('project_type')}", link="/editor/available")
    return {"ok": True}

@api.post("/tasks/{task_id}/admin-reject")
async def admin_reject_project(task_id: str, admin: dict = Depends(require_role("admin"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "Not found")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "rejected", "updated_at": now_iso()}})
    if t.get("client_id"):
        await create_notification(t["client_id"], "project_rejected", f"Your project '{t['title']}' was rejected", link="/client/panel")
    return {"ok": True}

@api.post("/tasks/{task_id}/submit")
async def editor_submit(task_id: str, data: dict, user: dict = Depends(require_role("editor"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("assigned_editor_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    video_url = data.get("video_url", "")
    note = data.get("note", "")
    draft = {"id": str(uuid.uuid4()), "url": video_url, "note": note, "uploaded_by": user["id"], "uploaded_at": now_iso()}
    await db.tasks.update_one({"id": task_id}, {
        "$push": {"drafts": draft},
        "$set": {"status": "submitted", "submitted_at": now_iso(), "video_url": video_url, "updated_at": now_iso()},
    })
    await notify_role("admin", "video_pending_approval", f"Video submitted: {t['title']}", link="/admin/approvals")
    return {"ok": True, "draft": draft}

@api.post("/tasks/{task_id}/admin-approve-video")
async def admin_approve_video(task_id: str, admin: dict = Depends(require_role("admin"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("status") != "submitted":
        raise HTTPException(400, "Task not pending video approval")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "client_review", "updated_at": now_iso()}})
    if t.get("client_id"):
        await create_notification(t["client_id"], "draft_ready", f"Draft ready for '{t['title']}'", link="/client/panel")
    return {"ok": True}

@api.get("/tasks")
async def list_tasks(
    status: Optional[str] = None,
    assigned_to_me: Optional[bool] = False,
    user: dict = Depends(get_current_user)
):
    q = {}
    if status:
        q["status"] = status
    # Role-based filter
    if user["role"] == "editor":
        if assigned_to_me:
            q["assigned_editor_id"] = user["id"]
        elif status == "available":
            q["status"] = "available"
        else:
            q["assigned_editor_id"] = user["id"]
    elif user["role"] == "client":
        q["client_id"] = user["id"]
        # Hide pending_admin_approval from client UI? actually they should see their own pending too
        # Keep all - client sees all their tasks across statuses

    items = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    # For editor viewing "available", hide sensitive info
    if user["role"] == "editor" and status == "available":
        cleaned = []
        for t in items:
            cleaned.append({
                "id": t["id"],
                "project_type": t["project_type"],
                "priority": t["priority"],
                "deadline": t["deadline"],
                "num_videos": t["num_videos"],
                "duration": t["duration"],
                "skill_tags": t.get("skill_tags", []),
                "status": t["status"],
                "created_at": t["created_at"],
            })
        # Also attach my pending request expiry if any
        my_reqs = await db.requests.find({"editor_id": user["id"]}, {"_id": 0}).to_list(200)
        req_map = {r["task_id"]: r for r in my_reqs}
        for t in cleaned:
            if t["id"] in req_map:
                t["my_request"] = req_map[t["id"]]
        return cleaned
    return items

@api.get("/tasks/{task_id}")
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    if user["role"] == "client" and t.get("client_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "editor" and t.get("assigned_editor_id") != user["id"] and t.get("status") != "available":
        raise HTTPException(403, "Forbidden")
    return t

@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, data: dict, admin: dict = Depends(require_role("admin"))):
    data["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": data})
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return t

@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin: dict = Depends(require_role("admin"))):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}

# --- Project Requests (editor requests a project) ---
@api.post("/tasks/{task_id}/request")
async def request_task(task_id: str, user: dict = Depends(require_role("editor"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("status") != "available":
        raise HTTPException(400, "Task not available")
    existing = await db.requests.find_one({"task_id": task_id, "editor_id": user["id"]})
    if existing:
        raise HTTPException(400, "Already requested")
    req = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "editor_id": user["id"],
        "editor_anime_name": user["anime_name"],
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
        "status": "pending",
    }
    await db.requests.insert_one(req)
    req.pop("_id", None)
    return req

@api.get("/requests")
async def list_requests(task_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if task_id:
        q["task_id"] = task_id
    if user["role"] == "editor":
        q["editor_id"] = user["id"]
    elif user["role"] == "client":
        raise HTTPException(403, "Forbidden")
    items = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with editor info for admin
    if user["role"] == "admin":
        for r in items:
            ed = await db.users.find_one({"id": r["editor_id"]}, {"_id": 0, "password_hash": 0})
            if ed:
                r["editor"] = scrub_user(ed, viewer_role="admin")
    return items

@api.post("/requests/{req_id}/approve")
async def approve_request(req_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.requests.find_one({"id": req_id})
    if not r:
        raise HTTPException(404, "Not found")
    await db.tasks.update_one(
        {"id": r["task_id"]},
        {"$set": {"assigned_editor_id": r["editor_id"], "status": "active", "updated_at": now_iso()}}
    )
    await db.requests.update_one({"id": req_id}, {"$set": {"status": "approved"}})
    # Reject other requests for same task
    await db.requests.update_many(
        {"task_id": r["task_id"], "id": {"$ne": req_id}},
        {"$set": {"status": "rejected"}}
    )
    return {"ok": True}

@api.post("/requests/{req_id}/reject")
async def reject_request(req_id: str, admin: dict = Depends(require_role("admin"))):
    await db.requests.update_one({"id": req_id}, {"$set": {"status": "rejected"}})
    return {"ok": True}

# --- Drafts, Revisions, Approval, Reviews ---
@api.post("/tasks/{task_id}/drafts")
async def add_draft(task_id: str, data: DraftIn, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "Not found")
    if user["role"] == "editor" and t.get("assigned_editor_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    draft = {"id": str(uuid.uuid4()), "url": data.url, "note": data.note,
             "uploaded_by": user["id"], "uploaded_at": now_iso()}
    await db.tasks.update_one({"id": task_id}, {"$push": {"drafts": draft}, "$set": {"updated_at": now_iso()}})
    return draft

@api.post("/tasks/{task_id}/revision")
async def request_revision(task_id: str, data: RevisionIn, user: dict = Depends(require_role("client"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("client_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    rev = {"id": str(uuid.uuid4()), "note": data.note, "created_at": now_iso()}
    await db.tasks.update_one({"id": task_id},
        {"$push": {"revisions": rev}, "$set": {"status": "revision", "updated_at": now_iso()}})
    if t.get("assigned_editor_id"):
        await create_notification(t["assigned_editor_id"], "revision_requested", f"Revision requested: {t['title']}", body=data.note, link="/editor/projects")
    return rev

@api.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, user: dict = Depends(require_role("client"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("client_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    completed_at = now_iso()
    await db.tasks.update_one({"id": task_id},
        {"$set": {"status": "completed", "completed_at": completed_at, "updated_at": completed_at}})
    # XP awards
    editor_id = t.get("assigned_editor_id")
    if editor_id:
        await award_xp(editor_id, 10, "project completed")
        # On-time vs late
        try:
            d = t.get("deadline", "")
            d_dt = datetime.fromisoformat(d) if "T" in d else datetime.fromisoformat(d + "T23:59:59+00:00")
            if d_dt.tzinfo is None: d_dt = d_dt.replace(tzinfo=timezone.utc)
            c_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            if c_dt <= d_dt:
                await award_xp(editor_id, 5, "on-time delivery")
            else:
                await award_xp(editor_id, -5, "late delivery")
        except Exception:
            pass
        await evaluate_badges(editor_id)
        await create_notification(editor_id, "client_approved", f"Client approved '{t['title']}'! +10 XP", link="/editor/projects")
    await notify_role("admin", "client_approved", f"Project completed: {t['title']}")
    return {"ok": True}

@api.post("/tasks/{task_id}/review")
async def leave_review(task_id: str, data: ReviewIn, user: dict = Depends(require_role("client"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("client_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    review = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "editor_id": t.get("assigned_editor_id"),
        "client_id": user["id"],
        "rating": max(1, min(5, data.rating)),
        "feedback": data.feedback,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    return review

@api.get("/reviews")
async def list_reviews(editor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if editor_id:
        q["editor_id"] = editor_id
    items = await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

# --- Chat ---
@api.post("/messages")
async def send_message(data: MessageIn, user: dict = Depends(get_current_user)):
    # Permission: group = editors + admin only. dm = admin <-> editor or admin <-> client
    ch = data.channel
    if ch == "group":
        if user["role"] == "client":
            raise HTTPException(403, "Clients cannot use group chat")
    elif ch.startswith("dm:"):
        other_id = ch.split("dm:", 1)[1]
        other = await db.users.find_one({"id": other_id})
        if not other:
            raise HTTPException(404, "User not found")
        # Only admin <-> non-admin allowed (no editor<->client)
        pair = {user["role"], other["role"]}
        if "admin" not in pair:
            raise HTTPException(403, "Only admin can DM editors/clients")
    else:
        raise HTTPException(400, "Invalid channel")

    msg = {
        "id": str(uuid.uuid4()),
        "channel": ch,
        "sender_id": user["id"],
        "sender_name": user.get("anime_name") if user["role"] == "editor" else user.get("real_name"),
        "sender_role": user["role"],
        "content": data.content,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg

@api.get("/messages")
async def list_messages(channel: str, user: dict = Depends(get_current_user)):
    # Permission check
    if channel == "group":
        if user["role"] == "client":
            raise HTTPException(403, "Forbidden")
        ch_q = "group"
    elif channel.startswith("dm:"):
        other_id = channel.split("dm:", 1)[1]
        # user must be participant
        if user["id"] != other_id and user["role"] != "admin":
            # client/editor can only see their own DM with admin
            other = await db.users.find_one({"id": other_id})
            if not other or other["role"] != "admin":
                raise HTTPException(403, "Forbidden")
        # channel normalization: both sides share same channel key (dm:<nonadmin>)
        if user["role"] == "admin":
            ch_q = f"dm:{other_id}"  # admin viewing dm with non-admin stored as dm:<nonadmin>
        else:
            ch_q = f"dm:{user['id']}"
    else:
        raise HTTPException(400, "Invalid channel")

    # For DMs, we store sender's choice; normalize: when non-admin sends, channel=dm:<their_id>; admin sends dm:<other_id>
    # So fetch all messages where channel matches the normalized key
    items = await db.messages.find({"channel": ch_q}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return items

@api.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    """List DM partners for current user."""
    if user["role"] == "admin":
        # all editors + clients
        users = await db.users.find({"role": {"$in": ["editor", "client"]}},
                                    {"_id": 0, "password_hash": 0}).to_list(500)
        return [scrub_user(u, viewer_role="admin") for u in users]
    else:
        # non-admin: only admin
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).to_list(10)
        return [scrub_user(a, viewer_role=user["role"]) for a in admins]

# --- Performance & Leaderboard ---
async def compute_editor_metrics(editor_id: str) -> dict:
    """Compute metrics for last 30 days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    tasks = await db.tasks.find({"assigned_editor_id": editor_id, "created_at": {"$gte": cutoff}},
                                 {"_id": 0}).to_list(500)
    reviews = await db.reviews.find({"editor_id": editor_id, "created_at": {"$gte": cutoff}},
                                     {"_id": 0}).to_list(500)
    requests = await db.requests.find({"editor_id": editor_id, "created_at": {"$gte": cutoff}},
                                       {"_id": 0}).to_list(500)

    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    on_time = 0
    for t in tasks:
        if t.get("status") == "completed" and t.get("completed_at") and t.get("deadline"):
            try:
                c = datetime.fromisoformat(t["completed_at"].replace("Z", "+00:00"))
                d = datetime.fromisoformat(t["deadline"].replace("Z", "+00:00")) if "T" in t["deadline"] else datetime.fromisoformat(t["deadline"] + "T23:59:59+00:00")
                if c <= d:
                    on_time += 1
            except Exception:
                pass
    on_time_rate = round((on_time / completed) * 100, 1) if completed else 0

    revisions_count = sum(len(t.get("revisions", [])) for t in tasks)
    revision_rate = round((revisions_count / total) * 100, 1) if total else 0

    approved_reqs = sum(1 for r in requests if r.get("status") == "approved")
    total_reqs = len(requests)
    acceptance_rate = round((approved_reqs / total_reqs) * 100, 1) if total_reqs else 0

    videos_per_week = round(sum(t.get("num_videos", 1) for t in tasks if t.get("status") == "completed") / 4.0, 1)

    # response rate = % of requests made within 2 hours of task creation (proxy)
    response_rate = 85.0  # default

    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else 0

    # Overall score (0-100)
    score = round(
        0.3 * on_time_rate +
        0.2 * acceptance_rate +
        0.2 * max(0, 100 - revision_rate * 2) +
        0.15 * response_rate +
        0.15 * (avg_rating * 20),
        1
    )

    return {
        "editor_id": editor_id,
        "on_time_rate": on_time_rate,
        "acceptance_rate": acceptance_rate,
        "videos_per_week": videos_per_week,
        "revision_rate": revision_rate,
        "response_rate": response_rate,
        "avg_rating": avg_rating,
        "total_tasks": total,
        "completed_tasks": completed,
        "score": score,
    }

@api.get("/performance/me")
async def my_performance(user: dict = Depends(require_role("editor"))):
    return await compute_editor_metrics(user["id"])

@api.get("/performance/{editor_id}")
async def editor_performance(editor_id: str, admin: dict = Depends(require_role("admin"))):
    return await compute_editor_metrics(editor_id)

@api.get("/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
    rows = []
    for e in editors:
        m = await compute_editor_metrics(e["id"])
        rows.append({
            "editor": scrub_user(e, viewer_role=user["role"]),
            **m,
        })
    rows.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows

# --- Editor Recommendation ---
@api.get("/tasks/{task_id}/recommendations")
async def recommend_editors(task_id: str, admin: dict = Depends(require_role("admin"))):
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
    skill_tags = set([s.lower() for s in t.get("skill_tags", [])])
    out = []
    for e in editors:
        m = await compute_editor_metrics(e["id"])
        es = set([s.lower() for s in e.get("skills", [])])
        skill_match = (len(skill_tags & es) / len(skill_tags)) * 100 if skill_tags else 50
        active_load = await db.tasks.count_documents({"assigned_editor_id": e["id"], "status": {"$in": ["active", "pending", "revision"]}})
        availability = max(0, 100 - active_load * 20)
        overall = round(
            0.35 * skill_match + 0.25 * m["score"] + 0.2 * availability +
            0.1 * m["response_rate"] + 0.1 * max(0, 100 - m["revision_rate"] * 2), 1
        )
        out.append({
            "editor": scrub_user(e, viewer_role="admin"),
            "skill_match": round(skill_match, 1),
            "performance_score": m["score"],
            "availability": availability,
            "response_rate": m["response_rate"],
            "revision_rate": m["revision_rate"],
            "overall": overall,
        })
    out.sort(key=lambda x: x["overall"], reverse=True)
    return out

# --- Brief Health Score ---
@api.post("/brief/score")
async def brief_score(data: dict, user: dict = Depends(get_current_user)):
    fields = {
        "brief_goal": 15, "brief_audience": 15, "brief_hook": 15,
        "brief_body": 10, "brief_cta": 15, "brief_style": 10,
        "brief_references": 10, "brief_notes": 5, "skill_tags": 5,
    }
    score = 0
    missing = []
    for k, w in fields.items():
        v = data.get(k)
        has = bool(v and (v if isinstance(v, str) else len(v) > 0))
        if has:
            score += w
        else:
            missing.append(k)
    suggestions = []
    if "brief_hook" in missing: suggestions.append("Add a hook to grab attention in first 3 seconds.")
    if "brief_audience" in missing: suggestions.append("Define target audience age, interests, platform.")
    if "brief_cta" in missing: suggestions.append("Include a clear call-to-action.")
    if "brief_references" in missing: suggestions.append("Share reference videos for style guidance.")
    return {"score": score, "missing": missing, "suggestions": suggestions}

# --- Admin Dashboard Stats ---
@api.get("/stats/admin")
async def admin_stats(admin: dict = Depends(require_role("admin"))):
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(2000)
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    in_progress = sum(1 for t in tasks if t.get("status") in ["active", "pending"])
    revisions = sum(1 for t in tasks if t.get("status") == "revision")

    # Monthly metrics (current month)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    monthly_tasks = [t for t in tasks if t.get("created_at", "") >= month_start]
    revenue = sum(t.get("revenue", 0) for t in monthly_tasks)
    cost = sum(t.get("cost", 0) for t in monthly_tasks)
    profit = revenue - cost

    editors_count = await db.users.count_documents({"role": "editor"})
    clients_count = await db.users.count_documents({"role": "client"})

    return {
        "total_projects": total,
        "completed": completed,
        "in_progress": in_progress,
        "revisions": revisions,
        "monthly_revenue": revenue,
        "monthly_profit": profit,
        "monthly_completed": sum(1 for t in monthly_tasks if t.get("status") == "completed"),
        "editors_count": editors_count,
        "clients_count": clients_count,
    }

@api.get("/stats/trends")
async def stats_trends(admin: dict = Depends(require_role("admin"))):
    """Daily revenue + task counts for last 30 days."""
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(5000)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    days = {}
    for i in range(30):
        d = (cutoff + timedelta(days=i)).date().isoformat()
        days[d] = {"date": d, "revenue": 0, "cost": 0, "profit": 0, "tasks": 0, "completed": 0}
    for t in tasks:
        ca = t.get("created_at", "")
        if not ca or ca[:10] not in days:
            continue
        d = ca[:10]
        days[d]["tasks"] += 1
        days[d]["revenue"] += t.get("revenue", 0) or 0
        days[d]["cost"] += t.get("cost", 0) or 0
        days[d]["profit"] = days[d]["revenue"] - days[d]["cost"]
        if t.get("status") == "completed":
            days[d]["completed"] += 1
    rows = [days[k] for k in sorted(days.keys())]
    # status breakdown
    status_counts = {}
    for t in tasks:
        s = t.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
    return {"daily": rows, "status_breakdown": [{"name": k, "value": v} for k, v in status_counts.items()]}

@api.get("/stats/revisions")
async def stats_revisions(admin: dict = Depends(require_role("admin"))):
    """Revision counts per editor and per client."""
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(5000)
    editors = {}; clients = {}
    for t in tasks:
        revs = len(t.get("revisions", []))
        if revs == 0: continue
        ed = t.get("assigned_editor_id"); cl = t.get("client_id")
        if ed:
            editors[ed] = editors.get(ed, 0) + revs
        if cl:
            clients[cl] = clients.get(cl, 0) + revs
    out_editors = []
    for uid, count in sorted(editors.items(), key=lambda x: -x[1]):
        u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
        if u:
            out_editors.append({"user": scrub_user(u, viewer_role="admin"), "revision_count": count})
    out_clients = []
    for uid, count in sorted(clients.items(), key=lambda x: -x[1]):
        u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
        if u:
            out_clients.append({"user": scrub_user(u, viewer_role="admin"), "revision_count": count})
    return {"editors": out_editors, "clients": out_clients}

@api.get("/stats/deadline-risk")
async def stats_deadline_risk(user: dict = Depends(get_current_user)):
    """Tasks at risk: within 48h and not completed."""
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(hours=48))
    q = {"status": {"$in": ["active", "pending", "revision", "available"]}}
    if user["role"] == "editor":
        q["assigned_editor_id"] = user["id"]
    elif user["role"] == "client":
        q["client_id"] = user["id"]
    tasks = await db.tasks.find(q, {"_id": 0}).to_list(2000)
    out = []
    for t in tasks:
        if not t.get("deadline"): continue
        try:
            d = datetime.fromisoformat(t["deadline"]) if "T" in t["deadline"] else datetime.fromisoformat(t["deadline"] + "T23:59:59+00:00")
            if d.tzinfo is None: d = d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        hours_left = (d - now).total_seconds() / 3600
        if hours_left < 48:
            out.append({
                "task_id": t["id"], "title": t["title"], "deadline": t["deadline"],
                "status": t["status"], "priority": t.get("priority"),
                "hours_left": round(hours_left, 1),
                "assigned_editor_id": t.get("assigned_editor_id"),
                "risk": "overdue" if hours_left < 0 else "high" if hours_left < 12 else "medium",
            })
    out.sort(key=lambda x: x["hours_left"])
    return out

@api.get("/stats/satisfaction")
async def stats_satisfaction(admin: dict = Depends(require_role("admin"))):
    """Avg rating per client and per editor."""
    reviews = await db.reviews.find({}, {"_id": 0}).to_list(5000)
    by_editor = {}; by_client = {}
    for r in reviews:
        eid = r.get("editor_id"); cid = r.get("client_id")
        if eid:
            by_editor.setdefault(eid, []).append(r["rating"])
        if cid:
            by_client.setdefault(cid, []).append(r["rating"])
    async def enrich(d):
        out = []
        for uid, ratings in d.items():
            u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
            if u:
                out.append({
                    "user": scrub_user(u, viewer_role="admin"),
                    "avg_rating": round(sum(ratings) / len(ratings), 2),
                    "review_count": len(ratings),
                })
        out.sort(key=lambda x: -x["avg_rating"])
        return out
    return {"editors": await enrich(by_editor), "clients": await enrich(by_client)}

@api.get("/stats/workload")
async def stats_workload(admin: dict = Depends(require_role("admin"))):
    """Active task counts per editor — for workload balancing."""
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
    out = []
    for e in editors:
        active = await db.tasks.count_documents({"assigned_editor_id": e["id"], "status": "active"})
        revision = await db.tasks.count_documents({"assigned_editor_id": e["id"], "status": "revision"})
        pending = await db.tasks.count_documents({"assigned_editor_id": e["id"], "status": "pending"})
        total = active + revision + pending
        # capacity = 5 active tasks comfortably
        load_pct = min(100, round((total / 5) * 100))
        out.append({
            "editor": scrub_user(e, viewer_role="admin"),
            "active": active, "revision": revision, "pending": pending,
            "total": total, "load_pct": load_pct,
            "status": "overloaded" if load_pct >= 100 else "busy" if load_pct >= 70 else "available",
        })
    out.sort(key=lambda x: -x["total"])
    return out

@api.get("/showcase")
async def showcase():
    """Public: list editors with anonymized stats for a discovery surface."""
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0, "email": 0, "real_name": 0}).to_list(500)
    rows = []
    for e in editors:
        m = await compute_editor_metrics(e["id"])
        rows.append({
            "anime_name": e.get("anime_name"),
            "avatar_url": e.get("avatar_url"),
            "skills": e.get("skills", []),
            "score": m["score"],
            "on_time_rate": m["on_time_rate"],
            "avg_rating": m["avg_rating"],
            "completed_tasks": m["completed_tasks"],
            "videos_per_week": m["videos_per_week"],
        })
    rows.sort(key=lambda x: x["score"], reverse=True)
    return rows

@api.get("/calendar")
async def calendar(admin: dict = Depends(require_role("admin"))):
    tasks = await db.tasks.find({"status": {"$ne": "draft"}}, {"_id": 0}).to_list(1000)
    items = []
    for t in tasks:
        if t.get("deadline"):
            items.append({
                "task_id": t["id"],
                "title": t["title"],
                "deadline": t["deadline"],
                "status": t["status"],
                "priority": t.get("priority"),
            })
    return items

# --- Root ---
@api.get("/")
async def root():
    return {"message": "TaskFlow API", "status": "ok"}

# --- Notifications ---
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return items

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

# --- Editor profile ---
@api.get("/me/profile")
async def my_profile(user: dict = Depends(get_current_user)):
    user["burnout"] = await compute_burnout(user["id"]) if user["role"] == "editor" else "low"
    p = scrub_user(user, viewer_role="admin" if user["role"] == "admin" else user["role"])
    if user["role"] == "editor":
        await evaluate_badges(user["id"])
        u2 = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
        u2["burnout"] = p["burnout"]
        return scrub_user(u2, viewer_role="editor") | {"badge_defs": BADGE_DEFS}
    return p | {"badge_defs": BADGE_DEFS}

@api.get("/editor-profile/{editor_id}")
async def editor_profile(editor_id: str, viewer: dict = Depends(get_current_user)):
    if viewer["role"] not in ("admin", "editor"):
        raise HTTPException(403, "Forbidden")
    if viewer["role"] == "editor" and viewer["id"] != editor_id:
        raise HTTPException(403, "Editors can only view their own profile")
    u = await db.users.find_one({"id": editor_id}, {"_id": 0, "password_hash": 0})
    if not u or u["role"] != "editor":
        raise HTTPException(404, "Not found")
    u["burnout"] = await compute_burnout(editor_id)
    await evaluate_badges(editor_id)
    u2 = await db.users.find_one({"id": editor_id}, {"_id": 0, "password_hash": 0})
    u2["burnout"] = u["burnout"]
    metrics = await compute_editor_metrics(editor_id)
    return {"profile": scrub_user(u2, viewer_role=viewer["role"]) | {"badge_defs": BADGE_DEFS}, "metrics": metrics}

@api.put("/me/top-videos")
async def update_top_videos(data: dict, user: dict = Depends(require_role("editor"))):
    videos = data.get("videos", [])[:5]
    await db.users.update_one({"id": user["id"]}, {"$set": {"top_videos": videos}})
    return {"ok": True, "top_videos": videos}

# --- Reactions ---
@api.post("/messages/{msg_id}/reactions")
async def react_message(msg_id: str, data: ReactionIn, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Not found")
    reactions = msg.get("reactions", {}) or {}
    arr = reactions.get(data.emoji, []) or []
    if user["id"] in arr:
        arr.remove(user["id"])
    else:
        arr.append(user["id"])
    if not arr:
        reactions.pop(data.emoji, None)
    else:
        reactions[data.emoji] = arr
    await db.messages.update_one({"id": msg_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

# --- Voice notes (base64 stored in message) ---
@api.post("/messages/voice")
async def send_voice_message(data: VoiceMessageIn, user: dict = Depends(get_current_user)):
    if len(data.audio_data) > 700000:
        raise HTTPException(400, "Audio too large (max ~500KB)")
    ch = data.channel
    if ch == "group":
        if user["role"] == "client":
            raise HTTPException(403, "Forbidden")
        ch_q = "group"
    elif ch.startswith("dm:"):
        if user["role"] == "admin":
            ch_q = ch
        else:
            ch_q = f"dm:{user['id']}"
    else:
        raise HTTPException(400, "Invalid channel")
    msg = {
        "id": str(uuid.uuid4()),
        "channel": ch_q,
        "sender_id": user["id"],
        "sender_name": user.get("anime_name") if user["role"] == "editor" else user.get("real_name"),
        "sender_role": user["role"],
        "type": "voice",
        "audio_data": data.audio_data,
        "duration_sec": data.duration_sec,
        "content": "",
        "created_at": now_iso(),
        "reactions": {},
    }
    await db.messages.insert_one(msg.copy())
    msg.pop("_id", None)
    return msg

# --- Payments ---
@api.get("/payments")
async def list_payments(admin: dict = Depends(require_role("admin"))):
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
    # Current month start
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    out = []
    for e in editors:
        completed = await db.tasks.count_documents({
            "assigned_editor_id": e["id"],
            "status": "completed",
            "completed_at": {"$gte": month_start},
        })
        rate = e.get("charge_per_project", 0) or 0
        amount = completed * rate
        paid = e.get("payment_paid_this_month", False)
        out.append({
            "editor": scrub_user(e, viewer_role="admin"),
            "charge_per_project": rate,
            "completed_this_month": completed,
            "amount_owed": amount,
            "status": "paid" if paid else "unpaid",
        })
    out.sort(key=lambda x: -x["amount_owed"])
    return out

@api.post("/payments/{editor_id}/mark-paid")
async def mark_paid(editor_id: str, admin: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": editor_id}, {"$set": {"payment_paid_this_month": True}})
    return {"ok": True}

@api.get("/payments/history")
async def payment_history(admin: dict = Depends(require_role("admin"))):
    items = await db.payment_history.find({}, {"_id": 0}).sort("month", -1).to_list(500)
    return items

# --- MVP of the Month ---
@api.get("/mvp/current")
async def mvp_current(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
    best = None
    for e in editors:
        m = await compute_editor_metrics(e["id"])
        completed = await db.tasks.count_documents({
            "assigned_editor_id": e["id"], "status": "completed",
            "completed_at": {"$gte": month_start},
        })
        score = (m["score"] or 0) + completed * 5 + (e.get("xp", 0) or 0) * 0.1 + len(e.get("badges", [])) * 5
        if not best or score > best["score"]:
            best = {"editor": scrub_user(e, viewer_role=user["role"]), "score": round(score, 1),
                    "completed_this_month": completed, "metrics": m,
                    "reason": f"{m['on_time_rate']}% on-time, {completed} videos this month, {m['revision_rate']}% revisions"}
    return best or {}

# --- Background scheduler ---
SCHEDULER_LOCK = {"running": False}

async def scheduler_tick():
    """Runs every 60s."""
    if SCHEDULER_LOCK["running"]:
        return
    SCHEDULER_LOCK["running"] = True
    try:
        now = datetime.now(timezone.utc)
        # 1. Auto-assign tasks past 12h available window
        cutoff = (now - timedelta(hours=12)).isoformat()
        stale = await db.tasks.find({"status": "available", "available_at": {"$lt": cutoff, "$ne": None}}, {"_id": 0}).to_list(200)
        for t in stale:
            # find best-fit editor among requesters (or any editor)
            reqs = await db.requests.find({"task_id": t["id"], "status": "pending"}, {"_id": 0}).to_list(50)
            best_editor_id = None
            best_score = -1
            candidates = [r["editor_id"] for r in reqs] if reqs else None
            editors = await db.users.find({"role": "editor"} if not candidates else {"id": {"$in": candidates}},
                                          {"_id": 0, "password_hash": 0}).to_list(500)
            t_skills = set([s.lower() for s in t.get("skill_tags", [])])
            for e in editors:
                m = await compute_editor_metrics(e["id"])
                e_skills = set([s.lower() for s in e.get("skills", [])])
                skill_match = (len(t_skills & e_skills) / len(t_skills) * 100) if t_skills else 50
                load = await db.tasks.count_documents({"assigned_editor_id": e["id"], "status": {"$in": ["active", "revision", "submitted"]}})
                avail = max(0, 100 - load * 20)
                burnout = await compute_burnout(e["id"])
                burnout_pen = {"low": 0, "medium": 15, "high": 35}[burnout]
                score = 0.35 * skill_match + 0.25 * m["score"] + 0.2 * avail + 0.1 * m["response_rate"] + 0.1 * (100 - m["revision_rate"] * 2) - burnout_pen
                if score > best_score:
                    best_score = score
                    best_editor_id = e["id"]
            if best_editor_id:
                await db.tasks.update_one({"id": t["id"]}, {"$set": {
                    "assigned_editor_id": best_editor_id, "status": "active",
                    "auto_assigned": True, "updated_at": now_iso()
                }})
                await db.requests.update_many({"task_id": t["id"]}, {"$set": {"status": "auto_resolved"}})
                await create_notification(best_editor_id, "auto_assigned", f"Auto-assigned: {t['title']}", link="/editor/projects")
                await notify_role("admin", "auto_assigned", f"Auto-assigned '{t['title']}' (12h window)", link="/admin/tasks")

        # 2. Auto-approve videos past 6h submission window
        cutoff6 = (now - timedelta(hours=6)).isoformat()
        stale_v = await db.tasks.find({"status": "submitted", "submitted_at": {"$lt": cutoff6, "$ne": None}}, {"_id": 0}).to_list(200)
        for t in stale_v:
            await db.tasks.update_one({"id": t["id"]}, {"$set": {"status": "client_review", "auto_approved": True, "updated_at": now_iso()}})
            if t.get("client_id"):
                await create_notification(t["client_id"], "draft_ready", f"Draft auto-approved: {t['title']}", link="/client/panel")
            await notify_role("admin", "auto_approved", f"Video auto-approved: {t['title']}")

        # 3. Monthly payment reset on 5th day at midnight (run once per month)
        if now.day == 5:
            marker = await db.system_state.find_one({"key": "payment_reset"})
            month_key = now.strftime("%Y-%m")
            if not marker or marker.get("month") != month_key:
                # Save to history and reset
                editors = await db.users.find({"role": "editor"}, {"_id": 0, "password_hash": 0}).to_list(500)
                prev_month = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
                prev_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1).isoformat()
                prev_end = now.replace(day=1, hour=0, minute=0, second=0).isoformat()
                for e in editors:
                    completed = await db.tasks.count_documents({
                        "assigned_editor_id": e["id"], "status": "completed",
                        "completed_at": {"$gte": prev_start, "$lt": prev_end},
                    })
                    amount = completed * (e.get("charge_per_project", 0) or 0)
                    await db.payment_history.insert_one({
                        "id": str(uuid.uuid4()), "month": prev_month, "editor_id": e["id"],
                        "editor_name": e.get("anime_name"), "real_name": e.get("real_name"),
                        "completed": completed, "amount": amount,
                        "status": "paid" if e.get("payment_paid_this_month") else "unpaid",
                        "saved_at": now_iso(),
                    })
                # reset
                await db.users.update_many({"role": "editor"}, {"$set": {"payment_paid_this_month": False}})
                await db.system_state.update_one({"key": "payment_reset"}, {"$set": {"month": month_key, "ran_at": now_iso()}}, upsert=True)
                await notify_role("admin", "payment_reset", f"Monthly payment cycle reset ({prev_month} archived)")
    finally:
        SCHEDULER_LOCK["running"] = False

async def scheduler_loop():
    while True:
        try:
            await scheduler_tick()
        except Exception as e:
            logger.error(f"scheduler error: {e}")
        await asyncio.sleep(60)

# --- WebSocket Chat ---
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}  # channel -> websockets

    async def connect(self, channel: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(channel, []).append(ws)

    def disconnect(self, channel: str, ws: WebSocket):
        if channel in self.active and ws in self.active[channel]:
            self.active[channel].remove(ws)

    async def broadcast(self, channel: str, msg: dict):
        dead = []
        for ws in self.active.get(channel, []):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel, ws)

manager = ConnectionManager()

@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: str, channel: str):
    # Auth
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except Exception:
        await ws.close(code=1008); return
    if not user:
        await ws.close(code=1008); return
    # Permission
    if channel == "group":
        if user["role"] == "client":
            await ws.close(code=1008); return
        ch_q = "group"
    elif channel.startswith("dm:"):
        other_id = channel.split("dm:", 1)[1]
        if user["role"] == "admin":
            ch_q = f"dm:{other_id}"
        else:
            ch_q = f"dm:{user['id']}"
    else:
        await ws.close(code=1008); return

    await manager.connect(ch_q, ws)
    try:
        while True:
            data = await ws.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue
            msg = {
                "id": str(uuid.uuid4()),
                "channel": ch_q,
                "sender_id": user["id"],
                "sender_name": user.get("anime_name") if user["role"] == "editor" else user.get("real_name"),
                "sender_role": user["role"],
                "content": content,
                "created_at": now_iso(),
            }
            await db.messages.insert_one(msg.copy())
            msg.pop("_id", None)
            await manager.broadcast(ch_q, msg)
    except WebSocketDisconnect:
        manager.disconnect(ch_q, ws)
    except Exception:
        manager.disconnect(ch_q, ws)

app.include_router(api)

# --- Logging & Startup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tasks.create_index("id", unique=True)
    await db.messages.create_index("channel")
    await db.requests.create_index("task_id")
    await db.notifications.create_index("user_id")

    # Start scheduler
    asyncio.create_task(scheduler_loop())

    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "real_name": "Agency Admin",
            "anime_name": "Agency Admin",
            "role": "admin",
            "skills": [],
            "avatar_url": None,
            "created_at": now_iso(),
            "last_seen": None,
        })
        logger.info(f"Seeded admin: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                  {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Seed demo data if empty
    editor_count = await db.users.count_documents({"role": "editor"})
    if editor_count == 0:
        demo_editors = [
            ("editor1@taskflow.com", "editor123", "John Smith", ["reels", "ads", "motion graphics"]),
            ("editor2@taskflow.com", "editor123", "Sarah Lee", ["podcast", "documentary", "interviews"]),
            ("editor3@taskflow.com", "editor123", "Mike Chen", ["vlog", "reels", "youtube"]),
        ]
        avatars = [
            "https://images.unsplash.com/photo-1664267665561-24e5c5af0645?w=200",
            "https://images.unsplash.com/photo-1614249102574-94b6b58d02ee?w=200",
            "https://images.unsplash.com/photo-1668608380298-00f7fbb572d3?w=200",
        ]
        for i, (email, pw, name, skills) in enumerate(demo_editors):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email, "password_hash": hash_password(pw),
                "real_name": name, "anime_name": generate_anime_name(),
                "role": "editor", "skills": skills, "avatar_url": avatars[i],
                "created_at": now_iso(), "last_seen": None,
            })
        demo_clients = [
            ("client1@taskflow.com", "client123", "Acme Corp"),
            ("client2@taskflow.com", "client123", "Bright Media"),
        ]
        client_avatars = [
            "https://images.pexels.com/photos/14585727/pexels-photo-14585727.jpeg?w=200",
            "https://images.pexels.com/photos/36712225/pexels-photo-36712225.jpeg?w=200",
        ]
        for i, (email, pw, name) in enumerate(demo_clients):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email, "password_hash": hash_password(pw),
                "real_name": name, "anime_name": name,
                "role": "client", "skills": [], "avatar_url": client_avatars[i],
                "created_at": now_iso(), "last_seen": None,
            })
        logger.info("Seeded demo editors + clients")

@app.on_event("shutdown")
async def shutdown():
    client.close()
