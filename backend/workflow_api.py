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
    "editorPaymentInvoices": "workflow_editor_payment_invoices",
}

PROJECT_RELATED_COLLECTIONS = [
    "videoVersions",
    "timestampFeedback",
    "invoices",
    "calendarItems",
    "happinessScores",
    "projectFinance",
]

ADMIN_ONLY = {"projectFinance", "invoices", "editorPaymentInvoices"}
CLIENT_CREATE = {"brandProfiles", "timestampFeedback", "calendarItems", "happinessScores"}
EDITOR_CREATE = {"videoVersions", "timestampFeedback"}
CLIENT_PATCH = {"brandProfiles", "timestampFeedback", "calendarItems", "happinessScores"}
EDITOR_PATCH = {"videoVersions", "timestampFeedback", "calendarItems"}
OPS_ROLES = {"admin", "moderator"}


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


def invoice_number(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def is_ops(user: dict) -> bool:
    return user.get("role") in OPS_ROLES


def scrub_task_for_moderator(task: dict) -> dict:
    safe = clean(task)
    safe.pop("revenue", None)
    safe.pop("cost", None)
    return safe


def maybe_scrub_task_for_viewer(task: dict, user: dict) -> dict:
    if user.get("role") == "moderator":
        return scrub_task_for_moderator(task)
    return clean(task)


async def task(server, task_id: Optional[str]):
    if not task_id:
        return None
    return await server.db.tasks.find_one({"id": task_id}, {"_id": 0})


async def existing_project_ids(server) -> set[str]:
    rows = await server.db.tasks.find({}, {"id": 1, "_id": 0}).to_list(5000)
    return {row["id"] for row in rows if row.get("id")}


async def visible_scope(server, user: dict):
    fields = {"id": 1, "client_id": 1, "assigned_editor_id": 1, "status": 1, "_id": 0}
    if is_ops(user):
        rows = await server.db.tasks.find({}, fields).to_list(2000)
    elif user["role"] == "client":
        rows = await server.db.tasks.find({"client_id": user["id"]}, fields).to_list(2000)
    else:
        rows = await server.db.tasks.find({"$or": [{"assigned_editor_id": user["id"]}, {"status": "available"}]}, fields).to_list(2000)
    task_ids = {row["id"] for row in rows if row.get("id")}
    client_ids = {row.get("client_id") for row in rows if row.get("client_id")}
    return task_ids, client_ids


async def can_read_project(server, user: dict, project_id: Optional[str]) -> bool:
    if is_ops(user):
        return True
    current = await task(server, project_id)
    if not current:
        return False
    if user["role"] == "client":
        return current.get("client_id") == user["id"]
    return current.get("assigned_editor_id") == user["id"] or current.get("status") == "available"


async def can_write_project(server, user: dict, project_id: Optional[str]) -> bool:
    if is_ops(user):
        return True
    current = await task(server, project_id)
    if not current:
        return False
    if user["role"] == "client":
        return current.get("client_id") == user["id"]
    return current.get("assigned_editor_id") == user["id"]


async def can_access_doc(server, user: dict, collection_name: str, doc: dict) -> bool:
    if is_ops(user):
        return True
    if collection_name == "brandProfiles":
        if user["role"] == "editor":
            return False
        return doc.get("client_id") == user["id"]
    if collection_name == "editorPaymentInvoices":
        return user["role"] == "editor" and doc.get("editor_id") == user["id"]
    if doc.get("project_id"):
        return await can_read_project(server, user, doc.get("project_id"))
    if doc.get("client_id"):
        return doc.get("client_id") == user["id"]
    return False


def can_create(user: dict, collection_name: str) -> bool:
    if is_ops(user):
        return True
    if user["role"] == "client":
        return collection_name in CLIENT_CREATE
    if user["role"] == "editor":
        return collection_name in EDITOR_CREATE
    return False


def can_patch(user: dict, collection_name: str) -> bool:
    if is_ops(user):
        return True
    if user["role"] == "client":
        return collection_name in CLIENT_PATCH
    if user["role"] == "editor":
        return collection_name in EDITOR_PATCH
    return False


def filter_live_project_docs(items: list[dict], live_project_ids: set[str], collection_name: str) -> list[dict]:
    if collection_name == "brandProfiles":
        return [item for item in items if not item.get("project_id") or item.get("project_id") in live_project_ids]
    if collection_name == "editorPaymentInvoices":
        return [item for item in items if not item.get("project_id") or item.get("project_id") in live_project_ids]
    if collection_name in PROJECT_RELATED_COLLECTIONS:
        return [item for item in items if item.get("project_id") and item.get("project_id") in live_project_ids]
    return items


async def collection_items(server, user: dict, collection_name: str):
    if collection_name == "brandProfiles" and user["role"] == "editor":
        return []

    coll = collection(server, collection_name)
    live_project_ids = await existing_project_ids(server)

    if is_ops(user):
        rows = [clean(x) for x in await coll.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)]
        rows = filter_live_project_docs(rows, live_project_ids, collection_name)
        if user["role"] == "moderator" and collection_name in ADMIN_ONLY:
            return []
        return rows

    if collection_name == "editorPaymentInvoices":
        if user["role"] != "editor":
            return []
        rows = [clean(x) for x in await coll.find({"editor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)]
        return filter_live_project_docs(rows, live_project_ids, collection_name)

    task_ids, client_ids = await visible_scope(server, user)
    live_visible_task_ids = task_ids.intersection(live_project_ids)
    if collection_name == "brandProfiles":
        query = {"client_id": user["id"]}
    else:
        ors = []
        if live_visible_task_ids:
            ors.append({"project_id": {"$in": list(live_visible_task_ids)}})
        query = {"$or": ors} if ors else {"id": "__none__"}
    rows = [clean(x) for x in await coll.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)]
    return filter_live_project_docs(rows, live_project_ids, collection_name)


async def editor_happiness_feedback(server, editor_id: str):
    tasks = await server.db.tasks.find(
        {"assigned_editor_id": editor_id},
        {"_id": 0, "id": 1, "title": 1, "project_type": 1, "completed_at": 1, "status": 1},
    ).to_list(2000)
    task_map = {item["id"]: item for item in tasks if item.get("id")}
    task_ids = list(task_map.keys())
    if not task_ids:
        return []

    feedback = []
    client_reviews = await server.db.reviews.find(
        {"task_id": {"$in": task_ids}},
        {"_id": 0, "id": 1, "task_id": 1, "rating": 1, "feedback": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(2000)

    for review in client_reviews:
        project = task_map.get(review.get("task_id"))
        if project:
            feedback.append({
                "id": review.get("id") or str(uuid.uuid4()),
                "source": "client_review",
                "project_id": project.get("id"),
                "project_title": project.get("title") or "Project",
                "project_type": project.get("project_type") or "Video",
                "rating": review.get("rating"),
                "feedback": review.get("feedback") or "",
                "created_at": review.get("created_at"),
                "client_label": "Anonymous client",
            })

    happiness_rows = await collection(server, "happinessScores").find(
        {"project_id": {"$in": task_ids}},
        {"_id": 0, "id": 1, "project_id": 1, "rating": 1, "feedback": 1, "fast_enough": 1, "clear_communication": 1, "happy_final": 1, "work_again": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(2000)

    for score in happiness_rows:
        project = task_map.get(score.get("project_id"))
        if project:
            feedback.append({
                "id": score.get("id") or str(uuid.uuid4()),
                "source": "happiness_score",
                "project_id": project.get("id"),
                "project_title": project.get("title") or "Project",
                "project_type": project.get("project_type") or "Video",
                "rating": score.get("rating"),
                "feedback": score.get("feedback") or "",
                "fast_enough": score.get("fast_enough"),
                "clear_communication": score.get("clear_communication"),
                "happy_final": score.get("happy_final"),
                "work_again": score.get("work_again"),
                "created_at": score.get("created_at"),
                "client_label": "Anonymous client",
            })

    return sorted(feedback, key=lambda item: item.get("created_at") or "", reverse=True)


async def delete_matching_reviews(server, current_task: dict):
    title = current_task.get("title")
    task_id = current_task.get("id")
    client_id = current_task.get("client_id")
    queries = [{"task_id": task_id}, {"project_id": task_id}]
    if title:
        queries.extend([{field: title} for field in ["project_name", "project_title", "title"]])
    if client_id and title:
        queries.extend([{ "client_id": client_id, field: title } for field in ["project_name", "project_title", "title"]])
    result = await server.db.reviews.delete_many({"$or": queries})
    return result.deleted_count


async def cascade_delete_project(server, task_id: str, current_task: Optional[dict] = None):
    current_task = current_task or await task(server, task_id) or {"id": task_id}
    title = current_task.get("title")
    client_id = current_task.get("client_id")
    deleted = {}

    related_queries = [{"project_id": task_id}]
    if title:
        related_queries.extend([{field: title} for field in ["project_name", "project_title", "video_title"]])
    if client_id and title:
        related_queries.extend([{ "client_id": client_id, field: title } for field in ["project_name", "project_title", "video_title"]])

    for name in PROJECT_RELATED_COLLECTIONS:
        result = await collection(server, name).delete_many({"$or": related_queries})
        deleted[name] = result.deleted_count

    deleted["brandProfiles"] = (await collection(server, "brandProfiles").delete_many({"project_id": task_id})).deleted_count
    deleted["editorPaymentInvoices"] = (await collection(server, "editorPaymentInvoices").delete_many({"project_id": task_id})).deleted_count
    deleted["reviews"] = await delete_matching_reviews(server, current_task)
    return deleted


async def cleanup_orphan_project_data(server):
    live_project_ids = await existing_project_ids(server)
    deleted = {}
    for name in PROJECT_RELATED_COLLECTIONS:
        coll = collection(server, name)
        result = await coll.delete_many({"$or": [{"project_id": {"$exists": False}}, {"project_id": None}, {"project_id": {"$nin": list(live_project_ids)}}]})
        deleted[name] = result.deleted_count
    result = await server.db.reviews.delete_many({"$or": [{"task_id": {"$exists": False}}, {"task_id": None}, {"task_id": {"$nin": list(live_project_ids)}}]})
    deleted["reviews"] = result.deleted_count
    return deleted


async def build_editor_payment_invoice(server, editor_id: str, user: dict):
    editor = await server.db.users.find_one({"id": editor_id, "role": "editor"}, {"_id": 0})
    if not editor:
        raise HTTPException(404, "Editor not found")

    tasks = await server.db.tasks.find({"assigned_editor_id": editor_id, "status": "completed"}, {"_id": 0}).to_list(2000)
    charge_per_project = float(editor.get("charge_per_project") or editor.get("rate_per_project") or 0)
    completed_count = len(tasks)
    amount = completed_count * charge_per_project
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    coll = collection(server, "editorPaymentInvoices")
    existing = await coll.find_one({"editor_id": editor_id, "month": month, "status": "Paid"}, {"_id": 0})
    if existing:
        return clean(existing)

    doc = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number("EPI"),
        "type": "editor_payment_proof",
        "editor_id": editor_id,
        "editor_name": editor.get("anime_name") or editor.get("display_name") or editor.get("email"),
        "editor_real_name": editor.get("real_name"),
        "month": month,
        "completed_projects": completed_count,
        "completed_project_ids": [item.get("id") for item in tasks if item.get("id")],
        "charge_per_project": charge_per_project,
        "amount": amount,
        "currency": "USD",
        "status": "Paid",
        "paid_date": now_iso(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by": user["id"],
        "created_by_role": user["role"],
        "notes": "Auto-generated when Admin marked editor as paid.",
    }
    await coll.insert_one(doc)
    return clean(doc)


def build_task_compat_router(server):
    router = APIRouter(prefix="/api", tags=["workflow-task-compat"])

    @router.patch("/tasks/{task_id}")
    async def workflow_assign_task(task_id: str, payload: dict, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Admin or moderator only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        update = dict(payload or {})
        editor_id = update.get("assigned_editor_id") or update.get("editor_id")
        if editor_id:
            editor = await server.db.users.find_one({"id": editor_id, "role": "editor"}, {"_id": 0})
            if not editor:
                raise HTTPException(404, "Editor not found")
            update["assigned_editor_id"] = editor_id
            update["editor_id"] = editor_id
        if user["role"] == "moderator":
            update.pop("revenue", None)
            update.pop("cost", None)
        update["updated_at"] = now_iso()
        await server.db.tasks.update_one({"id": task_id}, {"$set": update})
        if editor_id:
            await server.db.requests.update_many({"task_id": task_id, "status": "pending"}, {"$set": {"status": "closed", "updated_at": now_iso()}})
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    return router


def build_workflow_router(server):
    router = APIRouter(prefix="/api/workflow", tags=["workflow-suite"])

    @router.get("/state")
    async def workflow_state(user: dict = Depends(server.get_current_user)):
        state = {}
        for name in COLLECTIONS:
            state[name] = await collection_items(server, user, name)
        return state

    @router.patch("/moderator/tasks/{task_id}")
    async def moderator_update_task(task_id: str, payload: dict, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        update = dict(payload or {})
        update.pop("id", None)
        update.pop("_id", None)
        update.pop("created_at", None)
        update.pop("created_by", None)
        update.pop("creator_role", None)
        if user["role"] == "moderator":
            update.pop("revenue", None)
            update.pop("cost", None)
        editor_id = update.get("assigned_editor_id") or update.get("editor_id")
        if editor_id:
            editor = await server.db.users.find_one({"id": editor_id, "role": "editor"}, {"_id": 0})
            if not editor:
                raise HTTPException(404, "Editor not found")
            update["assigned_editor_id"] = editor_id
            update["editor_id"] = editor_id
        update["updated_at"] = now_iso()
        await server.db.tasks.update_one({"id": task_id}, {"$set": update})
        if editor_id:
            await server.db.requests.update_many({"task_id": task_id, "status": "pending"}, {"$set": {"status": "closed", "updated_at": now_iso()}})
            await server.create_notification(editor_id, "task_assigned", f"Assigned project: {current_task.get('title', 'Project')}", link="/editor/projects")
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    @router.post("/moderator/tasks/{task_id}/approve-client")
    async def moderator_approve_client_project(task_id: str, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        if current_task.get("status") not in ["pending_admin_approval", "awaiting_admin_approval", "admin_review"]:
            raise HTTPException(400, "Task is not waiting for client project approval")
        await server.db.tasks.update_one({"id": task_id}, {"$set": {"status": "available", "available_at": now_iso(), "updated_at": now_iso(), "approved_by": user["id"], "approved_by_role": user["role"]}})
        if current_task.get("client_id"):
            await server.create_notification(current_task["client_id"], "project_approved", f"Your project '{current_task.get('title', 'Project')}' was approved", link="/client/panel")
        await server.notify_role("editor", "new_brief", f"New open brief: {current_task.get('project_type')}", link="/editor/available")
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    @router.post("/moderator/tasks/{task_id}/reject-client")
    async def moderator_reject_client_project(task_id: str, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        await server.db.tasks.update_one({"id": task_id}, {"$set": {"status": "rejected", "updated_at": now_iso(), "rejected_by": user["id"], "rejected_by_role": user["role"]}})
        if current_task.get("client_id"):
            await server.create_notification(current_task["client_id"], "project_rejected", f"Your project '{current_task.get('title', 'Project')}' was rejected", link="/client/panel")
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    @router.post("/moderator/tasks/{task_id}/approve-editor-draft")
    async def moderator_approve_editor_draft(task_id: str, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        if current_task.get("status") != "submitted":
            raise HTTPException(400, "Task is not waiting for editor draft approval")
        await server.db.tasks.update_one({"id": task_id}, {"$set": {"status": "client_review", "updated_at": now_iso(), "editor_draft_approved_by": user["id"], "editor_draft_approved_by_role": user["role"]}})
        if current_task.get("client_id"):
            await server.create_notification(current_task["client_id"], "draft_ready", f"Draft ready for '{current_task.get('title', 'Project')}'", link="/client/panel")
        if current_task.get("assigned_editor_id"):
            await server.create_notification(current_task["assigned_editor_id"], "draft_approved", f"Draft approved: {current_task.get('title', 'Project')}", link="/editor/projects")
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    @router.post("/moderator/requests/{req_id}/approve")
    async def moderator_approve_request(req_id: str, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        request = await server.db.requests.find_one({"id": req_id}, {"_id": 0})
        if not request:
            raise HTTPException(404, "Request not found")
        current_task = await server.db.tasks.find_one({"id": request["task_id"]}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        await server.db.tasks.update_one({"id": request["task_id"]}, {"$set": {"assigned_editor_id": request["editor_id"], "editor_id": request["editor_id"], "status": "active", "updated_at": now_iso(), "assigned_by": user["id"], "assigned_by_role": user["role"]}})
        await server.db.requests.update_one({"id": req_id}, {"$set": {"status": "approved", "updated_at": now_iso(), "approved_by": user["id"], "approved_by_role": user["role"]}})
        await server.db.requests.update_many({"task_id": request["task_id"], "id": {"$ne": req_id}, "status": "pending"}, {"$set": {"status": "rejected", "updated_at": now_iso()}})
        await server.create_notification(request["editor_id"], "request_approved", f"Request approved: {current_task.get('title', 'Project')}", link="/editor/projects")
        updated = await server.db.tasks.find_one({"id": request["task_id"]}, {"_id": 0})
        return maybe_scrub_task_for_viewer(updated, user)

    @router.post("/moderator/requests/{req_id}/reject")
    async def moderator_reject_request(req_id: str, user: dict = Depends(server.get_current_user)):
        if not is_ops(user):
            raise HTTPException(403, "Moderator or admin only")
        request = await server.db.requests.find_one({"id": req_id}, {"_id": 0})
        if not request:
            raise HTTPException(404, "Request not found")
        await server.db.requests.update_one({"id": req_id}, {"$set": {"status": "rejected", "updated_at": now_iso(), "rejected_by": user["id"], "rejected_by_role": user["role"]}})
        await server.create_notification(request["editor_id"], "request_rejected", "Your project request was rejected", link="/editor/available")
        return {"ok": True}

    @router.get("/editor-happiness/me")
    async def workflow_editor_happiness_me(user: dict = Depends(server.get_current_user)):
        if user["role"] != "editor":
            raise HTTPException(403, "Editor only")
        return await editor_happiness_feedback(server, user["id"])

    @router.post("/cleanup-orphans")
    async def workflow_cleanup_orphans(user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        return {"ok": True, "deleted": await cleanup_orphan_project_data(server)}

    @router.delete("/projects/{task_id}/delete-all")
    async def workflow_delete_project_all(task_id: str, user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        current_task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not current_task:
            raise HTTPException(404, "Task not found")
        deleted_related = await cascade_delete_project(server, task_id, current_task)
        task_result = await server.db.tasks.delete_one({"id": task_id})
        await server.db.requests.delete_many({"task_id": task_id})
        await server.db.notifications.delete_many({"task_id": task_id})
        return {"ok": True, "deleted_project": task_result.deleted_count, "deleted_related": deleted_related}

    @router.post("/editor-payments/{editor_id}/mark-paid")
    async def workflow_mark_editor_paid(editor_id: str, user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        payment_invoice = await build_editor_payment_invoice(server, editor_id, user)
        await server.db.payment_history.update_one(
            {"editor_id": editor_id, "month": payment_invoice["month"]},
            {"$set": {
                "id": payment_invoice["id"], "editor_id": editor_id,
                "editor_name": payment_invoice.get("editor_name"),
                "real_name": payment_invoice.get("editor_real_name"),
                "month": payment_invoice["month"],
                "completed": payment_invoice["completed_projects"],
                "amount": payment_invoice["amount"],
                "status": "paid",
                "invoice_id": payment_invoice["id"],
                "invoice_number": payment_invoice["invoice_number"],
                "updated_at": now_iso(),
            }, "$setOnInsert": {"created_at": now_iso()}},
            upsert=True,
        )
        return payment_invoice

    @router.get("/editor-payment-invoices")
    async def workflow_admin_editor_payment_invoices(user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        return await collection_items(server, user, "editorPaymentInvoices")

    @router.get("/editor-payment-invoices/me")
    async def workflow_my_editor_payment_invoices(user: dict = Depends(server.get_current_user)):
        if user["role"] != "editor":
            raise HTTPException(403, "Editor only")
        return await collection_items(server, user, "editorPaymentInvoices")

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
        if collection_name in ADMIN_ONLY and user["role"] != "admin":
            raise HTTPException(403, "Admin only")
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
