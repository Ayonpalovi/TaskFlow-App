const PENDING_KEY = "motionholic_moderator_finance_pending_requests";
const APPROVED_KEY = "motionholic_moderator_finance_approved_access";

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage limitations
  }
}

export function createLocalFinanceRequest(user) {
  const requests = readJson(PENDING_KEY, []);
  const existing = requests.find((item) => item.moderator_id === user?.id && item.status === "pending");
  if (existing) return { request: existing, already_pending: true };

  const request = {
    id: `local-finance-${Date.now()}`,
    source: "local_fallback",
    moderator_id: user?.id || user?.email || "moderator",
    moderator_name: user?.real_name || user?.display_name || user?.email || "Moderator",
    moderator_email: user?.email || "",
    type: "finance_access",
    duration_hours: 6,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  writeJson(PENDING_KEY, [request, ...requests]);
  return { request, already_pending: false };
}

export function listLocalFinanceRequests() {
  return readJson(PENDING_KEY, []).filter((item) => item.status === "pending");
}

export function approveLocalFinanceRequest(request, financePayload = {}) {
  const requests = readJson(PENDING_KEY, []);
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const updated = requests.map((item) => item.id === request.id ? { ...item, status: "approved", approved_at: new Date().toISOString(), expires_at: expiresAt } : item);
  writeJson(PENDING_KEY, updated);

  const approved = {
    moderator_id: request.moderator_id,
    request_id: request.id,
    allowed: true,
    expires_at: expiresAt,
    monthly_revenue: financePayload.monthly_revenue ?? 0,
    monthly_profit: financePayload.monthly_profit ?? 0,
    daily: financePayload.daily || [],
  };
  writeJson(APPROVED_KEY, approved);
  return approved;
}

export function rejectLocalFinanceRequest(request) {
  const requests = readJson(PENDING_KEY, []);
  const updated = requests.map((item) => item.id === request.id ? { ...item, status: "rejected", rejected_at: new Date().toISOString() } : item);
  writeJson(PENDING_KEY, updated);
}

export function getLocalApprovedFinanceAccess(user) {
  const approved = readJson(APPROVED_KEY, null);
  if (!approved) return null;
  const sameModerator = !approved.moderator_id || approved.moderator_id === user?.id || approved.moderator_id === user?.email;
  const expires = approved.expires_at ? new Date(approved.expires_at).getTime() : 0;
  if (!sameModerator || !expires || expires <= Date.now()) return null;
  return approved;
}
