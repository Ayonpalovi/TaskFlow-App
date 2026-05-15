import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";

export default function AdminFinanceAccessApprovalWidget() {
  const location = useLocation();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const visible = user?.role === "admin" && location.pathname === "/admin/users";

  const load = async () => {
    if (!visible) return;
    try {
      const { data } = await api.get("/admin/moderator-finance-access/requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    load();
    if (!visible) return undefined;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [visible]);

  const approve = async (request) => {
    const moderatorId = request?.actor_id || request?.target_user_id;
    if (!moderatorId) return;
    setBusyId(request.id || moderatorId);
    setNotice("");
    try {
      await api.post(`/admin/moderator-finance-access/grant/${moderatorId}`);
      setNotice("Finance access approved for 6 hours.");
      await load();
    } catch (error) {
      setNotice(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusyId("");
    }
  };

  if (!visible || requests.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-blue-500/20 bg-zinc-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300">Moderator Finance Request</div>
          <h3 className="mt-1 text-sm font-semibold text-white">Approve 6-hour revenue/profit access</h3>
        </div>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-200">{requests.length}</span>
      </div>
      {notice && <div className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">{notice}</div>}
      <div className="space-y-2">
        {requests.slice(0, 5).map((request) => {
          const moderator = request.moderator || {};
          const name = moderator.real_name || moderator.email || request.target_email || "Moderator";
          const id = request.id || request.actor_id;
          return (
            <div key={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{name}</div>
                  <div className="truncate text-xs text-zinc-500">Requested 6-hour finance view</div>
                </div>
                <button
                  onClick={() => approve(request)}
                  disabled={busyId === id}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "#0051FF" }}
                >
                  {busyId === id ? "Approving…" : "Approve"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
