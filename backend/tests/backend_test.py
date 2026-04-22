"""TaskFlow backend regression tests."""
import os, uuid, pytest, requests
from datetime import datetime, timedelta, timezone

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://video-ops-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE}/api"

def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]

@pytest.fixture(scope="session")
def admin():
    tok, u = _login("admin@taskflow.com", "admin123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}

@pytest.fixture(scope="session")
def editor1():
    tok, u = _login("editor1@taskflow.com", "editor123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}

@pytest.fixture(scope="session")
def editor2():
    tok, u = _login("editor2@taskflow.com", "editor123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}

@pytest.fixture(scope="session")
def client1():
    tok, u = _login("client1@taskflow.com", "client123")
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}

# ---------- AUTH ----------
class TestAuth:
    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email":"admin@taskflow.com","password":"wrong"})
        assert r.status_code == 401

    def test_me(self, admin):
        r = requests.get(f"{API}/auth/me", headers=admin["h"])
        assert r.status_code == 200 and r.json()["role"] == "admin"

    def test_me_noauth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401

    def test_logout(self, admin):
        assert requests.post(f"{API}/auth/logout", headers=admin["h"]).status_code == 200

# ---------- USERS ----------
class TestUsers:
    def test_list_users_admin(self, admin):
        r = requests.get(f"{API}/users", headers=admin["h"])
        assert r.status_code == 200 and len(r.json()) >= 6

    def test_editor_sees_no_emails(self, editor1):
        r = requests.get(f"{API}/users?role=editor", headers=editor1["h"])
        assert r.status_code == 200
        assert all("email" not in u for u in r.json())

    def test_editor_cannot_create(self, editor1):
        r = requests.post(f"{API}/users", headers=editor1["h"],
                          json={"email":"x@y.com","password":"p","real_name":"X","role":"editor"})
        assert r.status_code == 403

    def test_admin_creates_editor_anime_name(self, admin):
        email = f"TEST_{uuid.uuid4().hex[:6]}@t.com"
        r = requests.post(f"{API}/users", headers=admin["h"],
            json={"email":email,"password":"pw12345","real_name":"Test E","role":"editor","skills":["reels"]})
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "editor" and d.get("anime_name")
        assert d["display_name"] == d["anime_name"]
        requests.delete(f"{API}/users/{d['id']}", headers=admin["h"])

# ---------- TASKS ----------
@pytest.fixture(scope="session")
def sample_task(admin, client1):
    deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    r = requests.post(f"{API}/tasks", headers=admin["h"], json={
        "title":"TEST Reel Edit","client_id":client1["user"]["id"],"project_type":"reels",
        "priority":"high","deadline":deadline,"num_videos":1,"skill_tags":["reels","ads"],
        "revenue":500,"cost":100,"brief_goal":"grow","brief_hook":"h","brief_cta":"c",
        "brief_audience":"a","brief_body":"b","brief_style":"s","brief_references":"r","brief_notes":"n"
    })
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "available"
    yield t
    requests.delete(f"{API}/tasks/{t['id']}", headers=admin["h"])

class TestTasks:
    def test_create_draft(self, admin):
        r = requests.post(f"{API}/tasks", headers=admin["h"], json={
            "title":"TEST Draft","project_type":"ads","deadline":"2026-12-01","is_draft":True})
        assert r.status_code == 200 and r.json()["status"] == "draft"
        requests.delete(f"{API}/tasks/{r.json()['id']}", headers=admin["h"])

    def test_available_hides_client_info(self, editor1, sample_task):
        r = requests.get(f"{API}/tasks?status=available", headers=editor1["h"])
        assert r.status_code == 200
        item = next((x for x in r.json() if x["id"] == sample_task["id"]), None)
        assert item and "client_id" not in item and "revenue" not in item and "title" not in item

    def test_client_sees_own(self, client1, sample_task):
        r = requests.get(f"{API}/tasks", headers=client1["h"])
        assert r.status_code == 200
        assert any(t["id"] == sample_task["id"] for t in r.json())

    def test_editor_my_tasks_empty(self, editor1):
        r = requests.get(f"{API}/tasks", headers=editor1["h"])
        assert r.status_code == 200
        assert all(t.get("assigned_editor_id") == editor1["user"]["id"] for t in r.json())

# ---------- REQUEST / APPROVAL FLOW ----------
class TestRequestFlow:
    def test_full_flow(self, admin, editor1, editor2, client1, sample_task):
        tid = sample_task["id"]
        # editor1 request
        r = requests.post(f"{API}/tasks/{tid}/request", headers=editor1["h"])
        assert r.status_code == 200
        req1 = r.json()
        assert req1["status"] == "pending" and "expires_at" in req1
        # double request blocked
        assert requests.post(f"{API}/tasks/{tid}/request", headers=editor1["h"]).status_code == 400
        # editor2 requests too
        r2 = requests.post(f"{API}/tasks/{tid}/request", headers=editor2["h"])
        assert r2.status_code == 200
        # admin approves editor1
        ap = requests.post(f"{API}/requests/{req1['id']}/approve", headers=admin["h"])
        assert ap.status_code == 200
        # task now active, assigned
        t = requests.get(f"{API}/tasks/{tid}", headers=admin["h"]).json()
        assert t["status"] == "active" and t["assigned_editor_id"] == editor1["user"]["id"]
        # other request rejected
        all_reqs = requests.get(f"{API}/requests?task_id={tid}", headers=admin["h"]).json()
        e2_req = next(r for r in all_reqs if r["editor_id"] == editor2["user"]["id"])
        assert e2_req["status"] == "rejected"
        # client cannot list requests
        assert requests.get(f"{API}/requests", headers=client1["h"]).status_code == 403

# ---------- DRAFT / REVISION / APPROVE / REVIEW ----------
class TestLifecycle:
    def test_lifecycle(self, admin, editor1, client1, sample_task):
        tid = sample_task["id"]
        # editor submits draft
        d = requests.post(f"{API}/tasks/{tid}/drafts", headers=editor1["h"],
                          json={"url":"https://example.com/v.mp4","note":"v1"})
        assert d.status_code == 200
        # client revision
        rv = requests.post(f"{API}/tasks/{tid}/revision", headers=client1["h"], json={"note":"tighten"})
        assert rv.status_code == 200
        assert requests.get(f"{API}/tasks/{tid}", headers=admin["h"]).json()["status"] == "revision"
        # client approve
        ap = requests.post(f"{API}/tasks/{tid}/approve", headers=client1["h"])
        assert ap.status_code == 200
        assert requests.get(f"{API}/tasks/{tid}", headers=admin["h"]).json()["status"] == "completed"
        # review
        rev = requests.post(f"{API}/tasks/{tid}/review", headers=client1["h"],
                            json={"rating":5,"feedback":"great"})
        assert rev.status_code == 200 and rev.json()["rating"] == 5

# ---------- METRICS / LEADERBOARD / RECOMMENDATIONS / BRIEF ----------
class TestAnalytics:
    def test_my_perf(self, editor1):
        r = requests.get(f"{API}/performance/me", headers=editor1["h"])
        assert r.status_code == 200
        for k in ["on_time_rate","acceptance_rate","videos_per_week","revision_rate","response_rate","score"]:
            assert k in r.json()

    def test_perf_admin(self, admin, editor1):
        r = requests.get(f"{API}/performance/{editor1['user']['id']}", headers=admin["h"])
        assert r.status_code == 200

    def test_leaderboard(self, admin):
        r = requests.get(f"{API}/leaderboard", headers=admin["h"])
        assert r.status_code == 200 and len(r.json()) >= 3
        assert r.json()[0]["rank"] == 1

    def test_brief_score(self, admin):
        r = requests.post(f"{API}/brief/score", headers=admin["h"], json={
            "brief_goal":"g","brief_audience":"a","brief_hook":"h","brief_body":"b",
            "brief_cta":"c","brief_style":"s","brief_references":"r","brief_notes":"n","skill_tags":["x"]})
        assert r.status_code == 200 and r.json()["score"] == 100

    def test_brief_score_missing(self, admin):
        r = requests.post(f"{API}/brief/score", headers=admin["h"], json={"brief_goal":"g"})
        assert r.status_code == 200 and r.json()["score"] < 100 and "brief_hook" in r.json()["missing"]

    def test_recommendations(self, admin, sample_task):
        r = requests.get(f"{API}/tasks/{sample_task['id']}/recommendations", headers=admin["h"])
        assert r.status_code == 200 and len(r.json()) >= 3
        assert "overall" in r.json()[0] and "skill_match" in r.json()[0]

    def test_admin_stats(self, admin):
        r = requests.get(f"{API}/stats/admin", headers=admin["h"])
        assert r.status_code == 200
        for k in ["total_projects","completed","in_progress","monthly_revenue","monthly_profit","editors_count","clients_count"]:
            assert k in r.json()

    def test_calendar(self, admin):
        r = requests.get(f"{API}/calendar", headers=admin["h"])
        assert r.status_code == 200 and isinstance(r.json(), list)

# ---------- CHAT ----------
class TestChat:
    def test_group_client_denied(self, client1):
        assert requests.post(f"{API}/messages", headers=client1["h"],
            json={"channel":"group","content":"hi"}).status_code == 403
        assert requests.get(f"{API}/messages?channel=group", headers=client1["h"]).status_code == 403

    def test_group_editor_ok(self, editor1):
        assert requests.post(f"{API}/messages", headers=editor1["h"],
            json={"channel":"group","content":"hello team"}).status_code == 200
        r = requests.get(f"{API}/messages?channel=group", headers=editor1["h"])
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_dm_admin_editor(self, admin, editor1):
        ch = f"dm:{editor1['user']['id']}"
        assert requests.post(f"{API}/messages", headers=admin["h"],
            json={"channel":ch,"content":"hi editor"}).status_code == 200
        # editor should see it (channel normalized to dm:<own id>)
        r = requests.get(f"{API}/messages?channel={ch}", headers=editor1["h"])
        assert r.status_code == 200 and any("hi editor" in m["content"] for m in r.json())

    def test_editor_cannot_dm_client(self, editor1, client1):
        ch = f"dm:{client1['user']['id']}"
        assert requests.post(f"{API}/messages", headers=editor1["h"],
            json={"channel":ch,"content":"no"}).status_code == 403

    def test_conversations(self, admin, editor1):
        assert len(requests.get(f"{API}/conversations", headers=admin["h"]).json()) >= 5
        convs = requests.get(f"{API}/conversations", headers=editor1["h"]).json()
        assert all(c["role"] == "admin" for c in convs)
