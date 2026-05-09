"""Attach Motionholic OS workflow routes without rewriting server.py.

This loader is intentionally defensive. It attaches the workflow API when the
main /api router is included, and it also retries on first request in case the
server module was not fully available during import.
"""

import sys
from fastapi.applications import FastAPI

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_attached = False


def _find_server_module():
    return sys.modules.get("server") or sys.modules.get("backend.server") or sys.modules.get("__main__")


def _attach_workflow_router(app):
    global _attached
    if _attached:
        return

    try:
        server = _find_server_module()
        if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
            return

        from workflow_api import build_workflow_router

        workflow_router = build_workflow_router(server)
        existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}
        if "/api/workflow/state" not in existing_paths:
            _original_include_router(app, workflow_router)
        _attached = True
    except Exception:
        # Keep the original API alive even if the workflow extension cannot load.
        pass


def _patched_include_router(self, router, *args, **kwargs):
    result = _original_include_router(self, router, *args, **kwargs)
    if getattr(router, "prefix", None) == "/api":
        _attach_workflow_router(self)
    return result


async def _patched_call(self, scope, receive, send):
    _attach_workflow_router(self)
    return await _original_call(self, scope, receive, send)


FastAPI.include_router = _patched_include_router
FastAPI.__call__ = _patched_call
