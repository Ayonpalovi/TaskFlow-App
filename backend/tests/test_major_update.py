"""TaskFlow major update (iteration 4) backend tests.

Covers:
- /auth/register with access code 42202010
- client project creation → admin approve/reject flow
- editor submit → admin approve video flow
- XP math via compute_level (invoked through API seeded xp)
- notifications endpoints
- /me/profile
- /me/top-videos
- /messages/{id}/reactions
- /messages/voice (size limit)
- /payments, /payments/{id}/mark-paid, /payments/history
- /mvp/current
- role-based access control on new endpoints
"""
import os, uuid, pytest, requests, base64
from datetime import datetime, timedelta, timezone

BASE = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE}/api"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
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


# ---------- Registration ----------
class TestRegister:
    def test_register_wrong_code(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": f"TEST_{uuid.uuid4().hex[:6]}@t.com",
            "password": "pw12345", "confirm_password": "pw12345", "code": "wrong"
        })
        assert r.status_code == 400

    def test_register_password_mismatch(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": f"TEST_{uuid.uuid4().hex[:6]}@t.com",
            "password": "pw12345", "confirm_password": "pwXXXXX", "code": "42202010"
        })
        assert r.status_code == 400

    def test_register_success(self, admin):
        email = f"TEST_reg_{uuid.uuid4().hex[:6]}@t.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "Test Reg", "email": email,
            "password": "pw12345", "confirm_password": "pw12345", "code": "42202010"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "editor"
        assert data["user"].get("anime_name")
        uid = data["user"]["id"]
        # duplicate email
        dup = requests.post(f"{API}/auth/register", json={
            "name": "Test Reg", "email": email,
            "password": "pw12345", "confirm_password": "pw12345", "code": "42202010"
        })
        assert dup.status_code == 400
        # cleanup
        requests.delete(f"{API}/users/{uid}", headers=admin["h"])


# ---------- Client Project Creation + Admin Approval Flow ----------
@pytest.fixture(scope="module")
def client_project(client1, admin):
    """Client creates a project, yields it, cleans up."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = requests.post(f"{API}/tasks", headers=client1["h"], json={
        "title": "TEST Client Project",
        "project_type": "reels",
        "priority": "high",
        "deadline": deadline,
        "num_videos": 1,
        "skill_tags": ["reels"],
        "brief_goal": "grow", "brief_hook": "hook",
    })
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "pending_admin_approval"
    assert t["client_id"] == client1["user"]["id"]
    yield t
    requests.delete(f"{API}/tasks/{t['id']}", headers=admin["h"])


class TestClientProjectFlow:
    def test_client_creates_pending(self, client_project):
        assert client_project["status"] == "pending_admin_approval"

    def test_admin_approve_project(self, admin, client_project):
        r = requests.post(f"{API}/tasks/{client_project['id']}/admin-approve", headers=admin["h"])
        assert r.status_code == 200
        t = requests.get(f"{API}/tasks/{client_project['id']}", headers=admin["h"]).json()
        assert t["status"] == "available"

    def test_admin_approve_on_non_pending_400(self, admin, client_project):
        # already available
        r = requests.post(f"{API}/tasks/{client_project['id']}/admin-approve", headers=admin["h"])
        assert r.status_code == 400


class TestAdminRejectProject:
    def test_reject(self, admin, client1):
        deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        cr = requests.post(f"{API}/tasks", headers=client1["h"], json={
            "title": "TEST Reject Me", "project_type": "ads",
            "priority": "low", "deadline": deadline, "num_videos": 1, "skill_tags": ["ads"]})
        tid = cr.json()["id"]
        r = requests.post(f"{API}/tasks/{tid}/admin-reject", headers=admin["h"])
        assert r.status_code == 200
        t = requests.get(f"{API}/tasks/{tid}", headers=admin["h"]).json()
        assert t["status"] == "rejected"
        requests.delete(f"{API}/tasks/{tid}", headers=admin["h"])


# ---------- Editor Submit + Admin Video Approval ----------
@pytest.fixture(scope="module")
def assigned_task(admin, editor1, client1):
    """Create task assigned directly to editor1."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    r = requests.post(f"{API}/tasks", headers=admin["h"], json={
        "title": "TEST Assigned",
        "client_id": client1["user"]["id"],
        "project_type": "reels",
        "priority": "high",
        "deadline": deadline,
        "num_videos": 1,
        "skill_tags": ["reels"],
        "revenue": 500, "cost": 100,
        "assigned_editor_id": editor1["user"]["id"],
    })
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "active"
    yield t
    requests.delete(f"{API}/tasks/{t['id']}", headers=admin["h"])


class TestSubmitAndVideoApproval:
    def test_editor_submit(self, editor1, assigned_task):
        r = requests.post(f"{API}/tasks/{assigned_task['id']}/submit", headers=editor1["h"],
                          json={"video_url": "https://drive.google.com/x", "note": "v1"})
        assert r.status_code == 200
        t = requests.get(f"{API}/tasks/{assigned_task['id']}", headers=editor1["h"]).json()
        assert t["status"] == "submitted"
        assert t.get("video_url") == "https://drive.google.com/x"

    def test_client_cannot_submit(self, client1, assigned_task):
        # client role rejected (require_role editor)
        r = requests.post(f"{API}/tasks/{assigned_task['id']}/submit", headers=client1["h"],
                          json={"video_url": "https://x"})
        assert r.status_code == 403

    def test_unassigned_editor_cannot_submit(self, admin, client1):
        # a different task assigned to nobody
        deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        tr = requests.post(f"{API}/tasks", headers=admin["h"], json={
            "title": "TEST Unassigned", "client_id": client1["user"]["id"],
            "project_type": "reels", "priority": "low", "deadline": deadline,
            "num_videos": 1, "skill_tags": ["reels"], "revenue": 100, "cost": 10,
        })
        tid = tr.json()["id"]
        # editor1 not assigned to this one
        ed_tok, _ = _login("editor1@taskflow.com", "editor123")
        r = requests.post(f"{API}/tasks/{tid}/submit", headers={"Authorization": f"Bearer {ed_tok}"},
                          json={"video_url": "x"})
        assert r.status_code == 403
        requests.delete(f"{API}/tasks/{tid}", headers=admin["h"])

    def test_admin_approve_video(self, admin, assigned_task):
        r = requests.post(f"{API}/tasks/{assigned_task['id']}/admin-approve-video", headers=admin["h"])
        assert r.status_code == 200
        t = requests.get(f"{API}/tasks/{assigned_task['id']}", headers=admin["h"]).json()
        assert t["status"] == "client_review"

    def test_client_cannot_approve_video(self, client1, assigned_task):
        r = requests.post(f"{API}/tasks/{assigned_task['id']}/admin-approve-video", headers=client1["h"])
        assert r.status_code == 403


# ---------- XP/level via profile after approval ----------
class TestXpFlow:
    def test_approve_awards_xp_and_notifies(self, admin, editor1, client1):
        # fresh task, assign to editor1 directly, submit, approve video, client approve
        deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        tr = requests.post(f"{API}/tasks", headers=admin["h"], json={
            "title": "TEST XP Flow", "client_id": client1["user"]["id"],
            "project_type": "reels", "priority": "high", "deadline": deadline,
            "num_videos": 1, "skill_tags": ["reels"], "revenue": 300, "cost": 50,
            "assigned_editor_id": editor1["user"]["id"],
        })
        tid = tr.json()["id"]
        # before
        p0 = requests.get(f"{API}/me/profile", headers=editor1["h"]).json()
        xp0 = p0.get("xp", 0) or 0
        # submit
        requests.post(f"{API}/tasks/{tid}/submit", headers=editor1["h"],
                      json={"video_url": "https://x", "note": "v1"})
        # admin approve video
        requests.post(f"{API}/tasks/{tid}/admin-approve-video", headers=admin["h"])
        # client approve
        r = requests.post(f"{API}/tasks/{tid}/approve", headers=client1["h"])
        assert r.status_code == 200
        # after - should gain +10 + (+5 on-time since deadline 5 days out)
        p1 = requests.get(f"{API}/me/profile", headers=editor1["h"]).json()
        xp1 = p1.get("xp", 0) or 0
        assert xp1 >= xp0 + 10, f"Expected >= {xp0+10} XP, got {xp1}"
        requests.delete(f"{API}/tasks/{tid}", headers=admin["h"])


# ---------- Notifications ----------
class TestNotifications:
    def test_list_mine(self, editor1):
        r = requests.get(f"{API}/notifications", headers=editor1["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_mark_all_read(self, editor1):
        r = requests.post(f"{API}/notifications/read-all", headers=editor1["h"])
        assert r.status_code == 200

    def test_mark_one_read(self, editor1):
        items = requests.get(f"{API}/notifications", headers=editor1["h"]).json()
        if items:
            nid = items[0]["id"]
            r = requests.post(f"{API}/notifications/{nid}/read", headers=editor1["h"])
            assert r.status_code == 200

    def test_noauth(self):
        assert requests.get(f"{API}/notifications").status_code == 401


# ---------- /me/profile ----------
class TestMyProfile:
    def test_editor_profile_shape(self, editor1):
        r = requests.get(f"{API}/me/profile", headers=editor1["h"])
        assert r.status_code == 200
        d = r.json()
        # expected fields for editor
        for k in ["xp", "badges", "top_videos", "burnout", "badge_defs"]:
            assert k in d, f"{k} missing in profile"
        assert d["burnout"] in ("low", "medium", "high")

    def test_admin_profile(self, admin):
        r = requests.get(f"{API}/me/profile", headers=admin["h"])
        assert r.status_code == 200
        assert "badge_defs" in r.json()


# ---------- /me/top-videos ----------
class TestTopVideos:
    def test_set_and_trim(self, editor1):
        vids = [{"title": f"v{i}", "url": f"https://drive.google.com/{i}"} for i in range(7)]
        r = requests.put(f"{API}/me/top-videos", headers=editor1["h"], json={"videos": vids})
        assert r.status_code == 200
        assert len(r.json()["top_videos"]) == 5  # trimmed
        p = requests.get(f"{API}/me/profile", headers=editor1["h"]).json()
        assert len(p.get("top_videos", [])) == 5

    def test_non_editor_forbidden(self, admin):
        r = requests.put(f"{API}/me/top-videos", headers=admin["h"], json={"videos": []})
        assert r.status_code == 403


# ---------- Reactions ----------
class TestReactions:
    def test_react_toggle(self, editor1, admin):
        # send a group message first as editor
        send = requests.post(f"{API}/messages", headers=editor1["h"],
                             json={"channel": "group", "content": f"TEST_REACT_{uuid.uuid4().hex[:4]}"})
        assert send.status_code == 200
        mid = send.json()["id"]
        # admin reacts
        r1 = requests.post(f"{API}/messages/{mid}/reactions", headers=admin["h"], json={"emoji": "🔥"})
        assert r1.status_code == 200
        assert "🔥" in r1.json()["reactions"]
        assert admin["user"]["id"] in r1.json()["reactions"]["🔥"]
        # toggle off
        r2 = requests.post(f"{API}/messages/{mid}/reactions", headers=admin["h"], json={"emoji": "🔥"})
        assert r2.status_code == 200
        assert "🔥" not in r2.json().get("reactions", {})


# ---------- Voice ----------
class TestVoice:
    def test_voice_send(self, editor1):
        tiny = base64.b64encode(b"\x00\x00\x00" * 100).decode()
        r = requests.post(f"{API}/messages/voice", headers=editor1["h"],
                          json={"channel": "group", "audio_data": tiny, "duration_sec": 2})
        assert r.status_code == 200
        d = r.json()
        assert d["type"] == "voice"
        assert d["duration_sec"] == 2

    def test_voice_size_limit(self, editor1):
        huge = "A" * 700001
        r = requests.post(f"{API}/messages/voice", headers=editor1["h"],
                          json={"channel": "group", "audio_data": huge, "duration_sec": 5})
        assert r.status_code == 400

    def test_client_cannot_send_group_voice(self, client1):
        tiny = base64.b64encode(b"\x00" * 10).decode()
        r = requests.post(f"{API}/messages/voice", headers=client1["h"],
                          json={"channel": "group", "audio_data": tiny, "duration_sec": 1})
        assert r.status_code == 403


# ---------- Payments ----------
class TestPayments:
    def test_list(self, admin):
        r = requests.get(f"{API}/payments", headers=admin["h"])
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for row in data:
            for k in ["editor", "charge_per_project", "completed_this_month", "amount_owed", "status"]:
                assert k in row
            assert row["status"] in ("paid", "unpaid")

    def test_mark_paid(self, admin, editor1):
        r = requests.post(f"{API}/payments/{editor1['user']['id']}/mark-paid", headers=admin["h"])
        assert r.status_code == 200
        rows = requests.get(f"{API}/payments", headers=admin["h"]).json()
        mine = next(x for x in rows if x["editor"]["id"] == editor1["user"]["id"])
        assert mine["status"] == "paid"

    def test_history(self, admin):
        r = requests.get(f"{API}/payments/history", headers=admin["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_editor_forbidden(self, editor1):
        r = requests.get(f"{API}/payments", headers=editor1["h"])
        assert r.status_code == 403


# ---------- MVP ----------
class TestMVP:
    def test_mvp_current(self, admin):
        r = requests.get(f"{API}/mvp/current", headers=admin["h"])
        assert r.status_code == 200
        d = r.json()
        # may be empty if no editors, but expect editor field given 3 seeded
        if d:
            assert "editor" in d
            assert "score" in d
            assert "reason" in d

    def test_mvp_editor_can_view(self, editor1):
        r = requests.get(f"{API}/mvp/current", headers=editor1["h"])
        assert r.status_code == 200


# ---------- Role-based access control ----------
class TestRBAC:
    def test_client_cannot_admin_approve(self, client1, client_project):
        r = requests.post(f"{API}/tasks/{client_project['id']}/admin-approve", headers=client1["h"])
        assert r.status_code == 403

    def test_editor_cannot_admin_approve(self, editor1, client_project):
        r = requests.post(f"{API}/tasks/{client_project['id']}/admin-approve", headers=editor1["h"])
        assert r.status_code == 403

    def test_client_cannot_mark_paid(self, client1, editor1):
        r = requests.post(f"{API}/payments/{editor1['user']['id']}/mark-paid", headers=client1["h"])
        assert r.status_code == 403
