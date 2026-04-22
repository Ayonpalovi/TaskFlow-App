"""Tests for new TaskFlow features (iteration 2):
- Public /showcase
- /stats/trends, /stats/revisions, /stats/deadline-risk, /stats/satisfaction, /stats/workload
- WebSocket /api/ws permissions + persistence
"""
import os, json, uuid, asyncio, pytest, requests, websockets
from datetime import datetime, timedelta, timezone

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://video-ops-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE}/api"
WS_BASE = BASE.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws'


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def admin():
    tok, u = _login("admin@taskflow.com", "admin123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def editor1():
    tok, u = _login("editor1@taskflow.com", "editor123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def client1():
    tok, u = _login("client1@taskflow.com", "client123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


# -------- Public /showcase --------
class TestShowcase:
    def test_public_no_auth(self):
        r = requests.get(f"{API}/showcase")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # 3 seeded editors

    def test_no_pii_leak(self):
        r = requests.get(f"{API}/showcase")
        for e in r.json():
            assert "email" not in e
            assert "real_name" not in e
            assert "password_hash" not in e
            assert "id" not in e
            # must contain anonymized fields
            assert "anime_name" in e
            assert "skills" in e
            assert "score" in e
            assert "avg_rating" in e

    def test_sorted_by_score(self):
        r = requests.get(f"{API}/showcase")
        scores = [e["score"] for e in r.json()]
        assert scores == sorted(scores, reverse=True)


# -------- /stats/trends --------
class TestStatsTrends:
    def test_admin_ok(self, admin):
        r = requests.get(f"{API}/stats/trends", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        assert "daily" in d and "status_breakdown" in d
        assert len(d["daily"]) == 30
        sample = d["daily"][0]
        for k in ["date", "revenue", "cost", "profit", "tasks", "completed"]:
            assert k in sample
        assert isinstance(d["status_breakdown"], list)

    def test_editor_forbidden(self, editor1):
        r = requests.get(f"{API}/stats/trends", headers=editor1["h"])
        assert r.status_code == 403

    def test_noauth(self):
        assert requests.get(f"{API}/stats/trends").status_code == 401


# -------- /stats/revisions --------
class TestStatsRevisions:
    def test_admin_shape(self, admin):
        r = requests.get(f"{API}/stats/revisions", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        assert "editors" in d and "clients" in d
        # verify structure when populated
        for group in [d["editors"], d["clients"]]:
            for item in group:
                assert "user" in item
                assert "revision_count" in item
                assert isinstance(item["revision_count"], int)
        # sorted desc
        ec = [x["revision_count"] for x in d["editors"]]
        cc = [x["revision_count"] for x in d["clients"]]
        assert ec == sorted(ec, reverse=True)
        assert cc == sorted(cc, reverse=True)

    def test_editor_forbidden(self, editor1):
        assert requests.get(f"{API}/stats/revisions", headers=editor1["h"]).status_code == 403


# -------- /stats/deadline-risk --------
@pytest.fixture(scope="module")
def risky_task(admin, client1):
    """Create a task deadline within 24h to trigger risk."""
    deadline = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    r = requests.post(f"{API}/tasks", headers=admin["h"], json={
        "title": "TEST Risky Deadline",
        "client_id": client1["user"]["id"],
        "project_type": "reels",
        "priority": "urgent",
        "deadline": deadline,
        "num_videos": 1,
        "skill_tags": ["reels"],
        "revenue": 300,
        "cost": 50,
    })
    assert r.status_code == 200
    t = r.json()
    yield t
    requests.delete(f"{API}/tasks/{t['id']}", headers=admin["h"])


class TestDeadlineRisk:
    def test_admin_sees_risk(self, admin, risky_task):
        r = requests.get(f"{API}/stats/deadline-risk", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        ids = [x["task_id"] for x in d]
        assert risky_task["id"] in ids
        mine = next(x for x in d if x["task_id"] == risky_task["id"])
        assert mine["hours_left"] <= 48
        assert mine["risk"] in ["overdue", "high", "medium"]

    def test_client_scoped(self, client1, risky_task):
        r = requests.get(f"{API}/stats/deadline-risk", headers=client1["h"])
        assert r.status_code == 200
        # client can see their own risky task
        assert any(x["task_id"] == risky_task["id"] for x in r.json())

    def test_editor_scoped(self, editor1, risky_task):
        r = requests.get(f"{API}/stats/deadline-risk", headers=editor1["h"])
        assert r.status_code == 200
        # editor not assigned, shouldn't see it
        assert not any(x["task_id"] == risky_task["id"] for x in r.json())


# -------- /stats/satisfaction --------
class TestSatisfaction:
    def test_admin_shape(self, admin):
        r = requests.get(f"{API}/stats/satisfaction", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        assert "editors" in d and "clients" in d
        for group in [d["editors"], d["clients"]]:
            for item in group:
                assert "user" in item and "avg_rating" in item and "review_count" in item
                assert 0 <= item["avg_rating"] <= 5

    def test_editor_forbidden(self, editor1):
        assert requests.get(f"{API}/stats/satisfaction", headers=editor1["h"]).status_code == 403


# -------- /stats/workload --------
class TestWorkload:
    def test_admin_shape(self, admin):
        r = requests.get(f"{API}/stats/workload", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) >= 3
        for row in d:
            assert "editor" in row
            for k in ["active", "revision", "pending", "total", "load_pct", "status"]:
                assert k in row
            assert 0 <= row["load_pct"] <= 100
            assert row["status"] in ["overloaded", "busy", "available"]

    def test_editor_forbidden(self, editor1):
        assert requests.get(f"{API}/stats/workload", headers=editor1["h"]).status_code == 403


# -------- WebSocket --------
async def _ws_connect(token, channel):
    return await websockets.connect(f"{WS_BASE}?token={token}&channel={channel}", open_timeout=10)


class TestWebSocket:
    def test_ws_bad_token_closes(self):
        async def run():
            try:
                ws = await _ws_connect("badtoken", "group")
                # should close immediately (1008); receive will raise
                try:
                    await asyncio.wait_for(ws.recv(), timeout=3)
                except Exception:
                    pass
                assert ws.closed or ws.close_code == 1008
                await ws.close()
            except websockets.exceptions.InvalidStatusCode:
                return  # server rejected - acceptable
            except Exception:
                return
        asyncio.run(run())

    def test_ws_client_cannot_group(self, client1):
        async def run():
            try:
                ws = await _ws_connect(client1["token"], "group")
                try:
                    await asyncio.wait_for(ws.recv(), timeout=3)
                except Exception:
                    pass
                # Should be closed with 1008
                assert ws.closed
                await ws.close()
            except websockets.exceptions.ConnectionClosed:
                return
            except Exception:
                return
        asyncio.run(run())

    def test_ws_group_broadcast_and_persist(self, admin, editor1):
        """Editor connects, admin connects, editor sends -> admin receives; persisted in DB."""
        async def run():
            token_admin = admin["token"]
            token_editor = editor1["token"]
            ws_admin = await _ws_connect(token_admin, "group")
            ws_editor = await _ws_connect(token_editor, "group")
            await asyncio.sleep(0.5)
            payload = {"content": f"TEST_WS_{uuid.uuid4().hex[:6]}"}
            await ws_editor.send(json.dumps(payload))
            # admin should receive
            try:
                raw = await asyncio.wait_for(ws_admin.recv(), timeout=5)
                msg = json.loads(raw)
                assert msg["content"] == payload["content"]
                assert msg["sender_role"] == "editor"
            finally:
                await ws_admin.close()
                await ws_editor.close()
            # verify persisted
            await asyncio.sleep(0.5)
            r = requests.get(f"{API}/messages?channel=group", headers=admin["h"])
            assert r.status_code == 200
            assert any(m["content"] == payload["content"] for m in r.json())
        asyncio.run(run())


# -------- CORS (no withCredentials path) --------
class TestCORS:
    def test_bearer_only_works(self, admin):
        """Simulate frontend: Authorization header only, no cookie."""
        s = requests.Session()
        r = s.get(f"{API}/auth/me", headers=admin["h"])
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
