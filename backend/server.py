from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import random
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
    }
    if viewer_role == "admin":
        out["real_name"] = u.get("real_name")
        out["email"] = u.get("email")
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
    return scrub_user(user, viewer_role="admin" if user["role"] == "admin" else user["role"])

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
async def create_task(data: TaskCreateIn, admin: dict = Depends(require_role("admin"))):
    tid = str(uuid.uuid4())
    status = "draft" if data.is_draft else ("active" if data.assigned_editor_id else "available")
    doc = {
        "id": tid,
        "status": status,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **data.model_dump(),
    }
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc

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
    return rev

@api.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, user: dict = Depends(require_role("client"))):
    t = await db.tasks.find_one({"id": task_id})
    if not t or t.get("client_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    await db.tasks.update_one({"id": task_id},
        {"$set": {"status": "completed", "completed_at": now_iso(), "updated_at": now_iso()}})
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
