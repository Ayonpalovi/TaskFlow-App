"""Attach Motionholic OS workflow routes without rewriting server.py."""

import sys
from fastapi.applications import FastAPI

_original_include_router = FastAPI.include_router
_attached = False


def _patched_include_router(self, router, *args, **kwargs):
    global _attached
    result = _original_include_router(self, router, *args, **kwargs)
    try:
        if not _attached and getattr(router, "prefix", None) == "/api":
            server = sys.modules.get("server")
            if server is not None:
                from workflow_api import build_workflow_router
                _original_include_router(self, build_workflow_router(server))
                _attached = True
    except Exception:
        pass
    return result


FastAPI.include_router = _patched_include_router
