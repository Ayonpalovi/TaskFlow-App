import os

import uvicorn
import server
from account_routes import build_account_router
from account_status import install_status_patch
from starlette.responses import JSONResponse


install_status_patch(server)
existing_paths = {getattr(route, "path", "") for route in getattr(server.app, "routes", [])}

if "/api/account/users/invite" not in existing_paths:
    server.app.include_router(build_account_router(server))
    print("Motionholic account routes attached by render_start.py")
else:
    print("Motionholic account routes already attached")


@server.app.middleware("http")
async def block_deactivated_accounts(request, call_next):
    path = request.url.path

    public_paths = (
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/accept-invite",
    )

    if not path.startswith("/api") or any(path.startswith(item) for item in public_paths):
        return await call_next(request)

    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

    if token:
        try:
            payload = server.pyjwt.decode(token, server.JWT_SECRET, algorithms=[server.JWT_ALG])
            user = await server.db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "role": 1, "status": 1})
            if user and user.get("role") != "admin" and user.get("status") == "deactivated":
                return JSONResponse(
                    {
                        "detail": "Your Motionholic OS account has been deactivated. Please contact the Motionholic team if you think this is a mistake."
                    },
                    status_code=403,
                )
        except Exception:
            pass

    return await call_next(request)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    uvicorn.run(server.app, host="0.0.0.0", port=port)
