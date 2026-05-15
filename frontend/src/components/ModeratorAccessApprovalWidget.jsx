import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { listLocalFinanceRequests, approveLocalFinanceRequest, rejectLocalFinanceRequest } from "../lib/moderatorFinanceRequestStore";

function financeFromTasks(tasks) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthly = tasks.filter((t) => new Date(t.created_at || t.updated_at || Date.now()).getTime() >= monthStart);
  const revenue = monthly.reduce((sum, t) => sum + Number(t.revenue || t.price || t.amount || t.budget || 0), 0);
  const cost = monthly.reduce((sum, t) => sum + Number(t.cost || t.expense || t.editor_cost || 0), 0);
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const date = day.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => String(t.created_at || t.updated_at || "").slice(0, 10) === date);
    const dayRevenue = dayTasks.reduce((sum, t) => sum + Number(t.revenue || t.price || t.amount || t.budget || 0), 0);
    const dayCost = dayTasks.reduce((sum, t) => sum + Number(t.cost || t.expense || t.editor_cost || 0), 0);
    daily.push({ date, revenue: dayRevenue, profit: dayRevenue - dayCost, tasks: dayTasks.length });
  }
  return { monthly_revenue: revenue, monthly_profit: revenue - cost, daily };
}

export default function ModeratorAccessApprovalWidget({ embedded = false }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notice, setNotice] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [collapsed, setCollapsed] = useState(false);
  const visible = user?.role === "admin";

  async function load() {
    if (!visible) return;
    let serverRequests = [];
    try {
      const { data } = await api.get("/workflow/moderator-finance/requests");
      serverRequests = Array.isArray(data) ? data : [];
      setBackendStatus("backend connected");
    } catch {
      serverRequests = [];
      setBackendStatus("local fallback mode");
    }
    try {
      const { data } = await api.get("/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    }
    setRequests([...serverRequests, ...listLocalFinanceRequests()]);
  }

  useEffect(() => {
    load();
    if (!visible) return undefined;
    const onFocus = () => load();
    const onStorage = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const timer = setInterval(load, 3000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      clearInterval(timer);
    };
  }, [visible]);

  async function approve(request) {
    try {
      if (request.source === "local_fallback") {
        approveLocalFinanceRequest(request, financeFromTasks(tasks));
      } else {
        await api.post(`/workflow/moderator-finance/requests/${request.id}/approve`);
      }
      setNotice("Approved for 6 hours. Moderator should refresh the overview page.");
      await load();
    } catch {
      setNotice("Could not approve yet.");
    }
  }

  async function reject(request) {
    try {
      if (request.source === "local_fallback") {
        rejectLocalFinanceRequest(request);
      } else {
        await api.post(`/workflow/moderator-finance/requests/${request.id}/reject`);
      }
      setNotice("Request rejected.");
      await load();
    } catch {
      setNotice("Could not reject yet.");
    }
  }

  if (!visible) return null;

  const wrapperClass = embedded
    ? "w-full rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-zinc-900/30 to-zinc-950 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
    : "fixed right-6 top-24 z-50 w-[410px] max-w-[calc(100vw-2rem)] rounded-2xl border border-blue-500/20 bg-zinc-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl max-sm:left-4 max-sm:right-4 max-sm:top-24 max-sm:w-auto lg:right-8 lg:top-28";

  return (
    <div className={wrapperClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300">Moderator Request Center</div>
          <h3 className="mt-1 text-sm font-semibold text-white">Finance access approval</h3>
          <div className="mt-1 text-[11px] text-zinc-500">{backendStatus} · {requests.length} pending</div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10">Reload</button>
          <button onClick={() => setCollapsed(!collapsed)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10">{collapsed ? "Open" : "Hide"}</button>
        </div>
      </div>
      {!collapsed && (
        <>
          {notice && <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">{notice}</div>}
          {requests.length === 0 ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">No pending Moderator finance requests.</div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {requests.slice(0, 6).map((request) => {
                const id = request.id || request.moderator_id;
                const name = request.moderator_name || request.moderator_email || "Moderator";
                return (
                  <div key={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="truncate text-sm font-medium text-white">{name}</div>
                    <div className="text-xs text-zinc-500">Requested revenue/profit visibility for 6 hours</div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => approve(request)} className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: "#0051FF" }}>Approve</button>
                      <button onClick={() => reject(request)} className="flex-1 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300">Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
