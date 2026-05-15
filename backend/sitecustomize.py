"""Attach Motionholic OS extension routes without rewriting server.py.

Render starts this backend with `uvicorn server:app`, so this file is loaded
from the backend folder at Python startup. Keep each extension independent so a
workflow import issue cannot block account routes.
"""

import sys
from fastapi.applications import FastAPI

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_attached_account = False
_attached_workflow = False
_attached_workflow_chat = False
_attached_moderator = False
_attached_moderator_create_task = False
_attached_moderator_account_patch = False
_attached_moderator_finance = False


def _find_server_module():
    return sys.modules.get("server") or sys.modules.get("backend.server") or sys.modules.get("__main__")


def _attach_moderator_account_patch(app, server, existing_paths):
    global _attached_moderator_account_patch
    if _attached_moderator_account_patch:
        return

    from moderator_account_patch import build_moderator_account_patch_router

    _original_include_router(app, build_moderator_account_patch_router(server))
    _attached_moderator_account_patch = True
    print("Motionholic moderator account patch routes attached")


def _attach_account_router(app, server, existing_paths):
    global _attached_account
    if _attached_account or "/api/account/users/invite" in existing_paths:
        _attached_account = True
        return

    from account_status import install_status_patch
    from account_routes import build_account_router

    install_status_patch(server)
    _original_include_router(app, build_account_router(server))
    _attached_account = True
    print("Motionholic account routes attached")


def _attach_workflow_routers(app, server, existing_paths):
    global _attached_workflow
    if _attached_workflow:
        return

    from workflow_api import build_task_compat_router, build_workflow_router

    if "/api/workflow/state" not in existing_paths:
        _original_include_router(app, build_workflow_router(server))

    if "/api/tasks/{task_id}" not in existing_paths:
        _original_include_router(app, build_task_compat_router(server))

    _attached_workflow = True
    print("Motionholic workflow routes attached")


def _attach_workflow_chat_router(app, server, existing_paths):
    global _attached_workflow_chat
    if _attached_workflow_chat or "/api/workflow/chat/conversations" in existing_paths:
        _attached_workflow_chat = True
        return

    from fastapi import APIRouter
    from workflow_chat_api import attach_workflow_chat_routes

    chat_router = APIRouter(prefix="/api/workflow", tags=["workflow-chat"])
    attach_workflow_chat_routes(chat_router, server)
    _original_include_router(app, chat_router)
    _attached_workflow_chat = True
    print("Motionholic workflow chat routes attached")


def _attach_moderator_create_task_router(app, server, existing_paths):
    global _attached_moderator_create_task
    if _attached_moderator_create_task or "/api/workflow/moderator/tasks" in existing_paths:
        _attached_moderator_create_task = True
        return

    from moderator_create_task_patch import build_moderator_create_task_router

    _original_include_router(app, build_moderator_create_task_router(server))
    _attached_moderator_create_task = True
    print("Motionholic moderator create task route attached")


def _attach_moderator_router(app, server, existing_paths):
    global _attached_moderator
    if _attached_moderator or "/api/moderator/dashboard" in existing_paths:
        _attached_moderator = True
        return

    from moderator_routes import build_moderator_router

    _original_include_router(app, build_moderator_router(server))
    _attached_moderator = True
    print("Motionholic moderator routes attached")


def _attach_moderator_finance_router(app, server, existing_paths):
    global _attached_moderator_finance
    if _attached_moderator_finance or "/api/moderator/finance-access" in existing_paths:
        _attached_moderator_finance = True
        return

    from moderator_finance_access import build_moderator_finance_router

    _original_include_router(app, build_moderator_finance_router(server))
    _attached_moderator_finance = True
    print("Motionholic moderator finance routes attached")


def _attach_extension_routers(app):
    server = _find_server_module()
    if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
        return

    existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}

    try:
        _attach_moderator_account_patch(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator account patch loader failed: {exc}")

    try:
        _attach_account_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic account route loader failed: {exc}")

    try:
        _attach_workflow_routers(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic workflow route loader failed: {exc}")

    try:
        _attach_workflow_chat_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic workflow chat route loader failed: {exc}")

    try:
        _attach_moderator_create_task_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator create task route loader failed: {exc}")

    try:
        _attach_moderator_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator route loader failed: {exc}")

    try:
        _attach_moderator_finance_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator finance route loader failed: {exc}")


def _patched_include_router(self, router, *args, **kwargs):
    result = _original_include_router(self, router, *args, **kwargs)
    if getattr(router, "prefix", None) == "/api":
        _attach_extension_routers(self)
    return result


async def _patched_call(self, scope, receive, send):
    _attach_extension_routers(self)
    return await _original_call(self, scope, receive, send)


FastAPI.include_router = _patched_include_router
FastAPI.__call__ = _patched_call