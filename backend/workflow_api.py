from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

COLLECTIONS: Dict[str, str] = {
    "brandProfiles": "workflow_brand_profiles",
    "videoVersions": "workflow_video_versions",
    "timestampFeedback": "workflow_timestamp_feedback",
    "invoices": "workflow_invoices",
    "calendarItems": "workflow_calendar_items",
    "happinessScores": "workflow_happiness_scores",
    "projectFinance": "workflow_project_finance",
}

ADMIN_ONLY = {"projectFinance", "invoices"}
CLIENT_CREATE = {"brandProfiles", "timestampFeedback", "calendarItems", "happinessScores"}
EDITOR_CREATE = {"videoVersions", "timestampFeedback"}
CLIENT_PATCH = {"brandProfiles", "timestampFeedback", "calendarItems", "happinessScores"}
EDITOR_PATCH = {"videoVersions", "timestampFeedback", "calendarItems"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    out = dict(doc or {})
    out.pop("_id", None)
    return out


def collection(server, name: str):
    if name not in COLLECTIONS:
        raise HTTPException(404, "Unknown workflow collection")
    return getattr(server.db, COLLECTIONS[name])


async def task(server, task_id: Optional[str]):
    if not task_id:
        return None
    return await server.db.tasks.find_one({"id": task_id}, {"_id": 0})


async def visible_scope(server, user: dict):
    fields = {"id": 1, "client_id": 1, "assigned_editor_id": 1, "status": 1, "_id": 0}
    if user["role"] == "admin":
        rows = await server.db.tasks.find({}, fields).to_list(2000)
    elif user["role"] == "client":
        rows = await server.db.tasks.find({"client_id": user["id"]}, fields).to_list(2000)
    else:
        rows = await server.db.tasks.find({"$or": [{"assigned_editor_id": user["id"]}, {"status": "available"}]}, fields).to_list(2000)
    task_ids = {row["id"] for row in rows if row.get("id")}
    client_ids = {row.get("client_id") for row in rows if row.get("client_id")}
    return task_ids, client_ids


async def can_read_project(server, user: dict, project_id: Optional[str]) -> bool:
    if user["role"] == "admin":
        return True
    current = await task(server, project_id)
    if not current:
        return False
    if user["role"] == "client":
        return current.get("client_id") == user["id"]
    return current.get("assigned_editor_id") == user["id"] or current.get("status") == "available"


async def can_write_project(server, user: dict, project_id: Optional[str]) -> bool:
    if user["role"] == "admin":
        return True
    current = await task(server, project_id)
    if not current:
        return False
    if user["role"] == "client":
        return current.get("client_id") == user["id"]
    return current.get("assigned_editor_id") == user["id"]


async def can_access_doc(server, user: dict, collection_name: str, doc: dict) -> bool:
    if user["role"] == "admin":
        return True
    if collection_name == "brandProfiles":
        if user["role"] == "client":
            return doc.get("client_id") == user["id"]
        _, client_ids = await visible_scope(server, user)
        return doc.get("client_id") in client_ids
    if doc.get("project_id"):
        return await can_read_project(server, user, doc.get("project_id"))
    if doc.get("client_id"):
        return doc.get("client_id") == user["id"]
    return False


def can_create(user: dict, collection_name: str) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] == "client":
        return collection_name in CLIENT_CREATE
    if user["role"] == "editor":
        return collection_name in EDITOR_CREATE
    return False


def can_patch(user: dict, collection_name: str) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] == "client":
        return collection_name in CLIENT_PATCH
    if user["role"] == "editor":
        return collection_name in EDITOR_PATCH
    return False


async def collection_items(server, user: dict, collection_name: str):
    coll = collection(server, collection_name)
    if user["role"] == "admin":
        return [clean(x) for x in await coll.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)]

    task_ids, client_ids = await visible_scope(server, user)
    if collection_name == "brandProfiles":
        query = {"client_id": user["id"]} if user["role"] == "client" else {"client_id": {"$in": list(client_ids)}}
    else:
        ors = []
        if task_ids:
            ors.append({"project_id": {"$in": list(task_ids)}})
        if user["role"] == "client":
            ors.append({"client_id": user["id"]})
        elif client_ids:
            ors.append({"client_id": {"$in": list(client_ids)}})
        query = {"$or": ors} if ors else {"id": "__none__"}
    return [clean(x) for x in await coll.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)]


def build_workflow_router(server):
    router = APIRouter(prefix="/api/workflow", tags=["workflow-suite"])

    @router.get("/state")
    async def workflow_state(user: dict = Depends(server.get_current_user)):
        state = {}
        for name in COLLECTIONS:
            state[name] = await collection_items(server, user, name)
        return state

    @router.get("/{collection_name}")
    async def workflow_list(collection_name: str, user: dict = Depends(server.get_current_user)):
        if collection_name not in COLLECTIONS:
            raise HTTPException(404, "Unknown workflow collection")
        return await collection_items(server, user, collection_name)

    @router.post("/{collection_name}")
    async def workflow_create(collection_name: str, payload: dict, user: dict = Depends(server.get_current_user)):
        if collection_name not in COLLECTIONS:
            raise HTTPException(404, "Unknown workflow collection")
        if not can_create(user, collection_name):
            raise HTTPException(403, "Forbidden")
        if collection_name in ADMIN_ONLY and user["role"] != "admin":
            raise HTTPException(403, "Admin only")

        doc = dict(payload or {})
        doc.pop("_id", None)
        doc["id"] = doc.get("id") or str(uuid.uuid4())
        doc["created_at"] = doc.get("created_at") or now_iso()
        doc["updated_at"] = now_iso()
        doc["created_by"] = user["id"]
        doc["created_by_role"] = user["role"]

        if user["role"] == "client":
            doc["client_id"] = user["id"]
        if collection_name != "brandProfiles" and doc.get("project_id"):
            if not await can_write_project(server, user, doc.get("project_id")):
                raise HTTPException(403, "You cannot write to this project")
        if collection_name == "videoVersions" and user["role"] == "client":
            raise HTTPException(403, "Clients cannot upload versions")

        await collection(server, collection_name).insert_one(doc)
        return clean(doc)

    @router.patch("/{collection_name}/{doc_id}")
    async def workflow_patch(collection_name: str, doc_id: str, payload: dict, user: dict = Depends(server.get_current_user)):
        if collection_name not in COLLECTIONS:
            raise HTTPException(404, "Unknown workflow collection")
        if not can_patch(user, collection_name):
            raise HTTPException(403, "Forbidden")
        coll = collection(server, collection_name)
        existing = await coll.find_one({"id": doc_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Not found")
        if not await can_access_doc(server, user, collection_name, existing):
            raise HTTPException(403, "Forbidden")

        update = dict(payload or {})
        for protected in ["_id", "id", "created_at", "created_by", "created_by_role"]:
            update.pop(protected, None)
        if user["role"] == "client":
            update.pop("client_id", None)
            update.pop("project_id", None)
        update["updated_at"] = now_iso()
        await coll.update_one({"id": doc_id}, {"$set": update})
        return clean(await coll.find_one({"id": doc_id}, {"_id": 0}))

    @router.delete("/{collection_name}/{doc_id}")
    async def workflow_delete(collection_name: str, doc_id: str, user: dict = Depends(server.get_current_user)):
        if collection_name not in COLLECTIONS:
            raise HTTPException(404, "Unknown workflow collection")
        coll = collection(server, collection_name)
        existing = await coll.find_one({"id": doc_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Not found")
        if user["role"] != "admin" and existing.get("created_by") != user["id"]:
            raise HTTPException(403, "Forbidden")
        if not await can_access_doc(server, user, collection_name, existing):
            raise HTTPException(403, "Forbidden")
        await coll.delete_one({"id": doc_id})
        return {"ok": True}

    @router.post("/invoices/{invoice_id}/mark-paid")
    async def workflow_invoice_paid(invoice_id: str, user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        coll = collection(server, "invoices")
        await coll.update_one({"id": invoice_id}, {"$set": {"status": "Paid", "paid_date": now_iso(), "updated_at": now_iso()}})
        return clean(await coll.find_one({"id": invoice_id}, {"_id": 0}))

    return router
