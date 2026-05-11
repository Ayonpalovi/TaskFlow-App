import os

import uvicorn
import server
from account_routes import build_account_router
from account_status import install_status_patch


install_status_patch(server)
existing_paths = {getattr(route, "path", "") for route in getattr(server.app, "routes", [])}

if "/api/account/users/invite" not in existing_paths:
    server.app.include_router(build_account_router(server))
    print("Motionholic account routes attached by render_start.py")
else:
    print("Motionholic account routes already attached")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    uvicorn.run(server.app, host="0.0.0.0", port=port)
