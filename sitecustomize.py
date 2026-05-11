"""Root-level extension loader for Render.

Render can start the FastAPI app from the repository root with a command like
`uvicorn backend.server:app`. Python only auto-loads `sitecustomize.py` from
folders on sys.path, so the previous `backend/sitecustomize.py` may not run in
that setup. This root file makes the account/workflow route extensions load
from either runtime location.
"""

import sys
from pathlib import Path
from fastapi.applications import FastAPI

ROOT_DIR = Path(__file__).parent
BACKEND_DIR = ROOT_DIR / "backend"
if BACKEND_DIR.exists() and str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_attached = False


def _find_server_module():
    return sys.modules.get("backend.server") or sys.modules.get("server") or sys.modules.get("__main__")


def _attach_extension_routers(app):
    global _attached
    if _attached:
        return

    try:
        server = _find_server_module()
        if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
            return

        from workflow_api import build_task_compat_router, build_workflow_router
        from account_status import install_status_patch
        from account_routes import build_account_router

        install_status_patch(server)

        existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}

        if "/api/workflow/state" not in existing_paths:
            _original_include_router(app, build_workflow_router(server))

        if "/api/tasks/{task_id}" not in existing_paths:
            _original_include_router(app, build_task_compat_router(server))

        if "/api/account/users/invite" not in existing_paths:
            _original_include_router(app, build_account_router(server))

        _attached = True
    except Exception as exc:
        print(f"Motionholic extension route loader failed: {exc}")


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
