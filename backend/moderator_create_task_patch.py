from fastapi import APIRouter


def build_moderator_create_task_router(server):
    router = APIRouter(prefix="/api/workflow", tags=["moderator-create-task"])
    return router
