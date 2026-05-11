import os

import requests
import uvicorn
import server
import account_routes
from account_routes import build_account_router
from account_status import install_status_patch
from starlette.responses import JSONResponse


def send_resend_email(to_email, subject, body):
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("EMAIL_FROM") or "Motionholic OS <onboarding@resend.dev>"

    if not api_key:
        print("Resend email skipped: RESEND_API_KEY is missing")
        return False

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
            json={"from": sender, "to": [to_email], "subject": subject, "text": body},
            timeout=15,
        )
        if 200 <= response.status_code < 300:
            print(f"Resend email sent to {to_email}")
            return True
        print(f"Resend email failed: {response.status_code} {response.text}")
        return False
    except Exception as exc:
        print(f"Resend email failed: {exc}")
        return False


account_routes.send_smtp_email = send_resend_email

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
