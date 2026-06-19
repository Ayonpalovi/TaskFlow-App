import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const BLUE = "#0051FF";

function statusTone(s) {
  if (s === "approved") return "good";
  if (s === "rejected") return "bad";
  return "warn";
}

function fmtRange(a) {
  if (a.start_date && a.end_date) return `${a.start_date} → ${a.end_date}`;
  return a.start_date || a.end_date || "No dates set";
}

export default function AbsenceMode() {
  const { user } = useAuth();
  const role = user?.role;
  const isApplicant = role === "editor" || role === "moderator";
  const isApprover = role === "admin" || role === "moderator";
  const allowed = role === "admin" ? ["admin"] : role === "moderator" ? ["moderator"] : ["editor"];

  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const inp = "w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";

  const load = async () => {
    try {
      const { data } = await api.get("/absences");
      setMine(data.mine || []);
      setPending(data.pending || []);
    } catch {
      // keep last good state on transient errors
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const apply = async () => {
    setErr("");
    setNotice("");
    if (!reason.trim()) {
      setErr("Please explain the reason for your absence.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/absences", { reason: reason.trim(), start_date: startDate || null, end_date: endDate || null });
      setReason("");
      setStartDate("");
      setEndDate("");
      setNotice("Your absence request was submitted. You'll be notified once it's reviewed.");
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (a, approve) => {
    setErr("");
    setNotice("");
    let note = "";
    if (!approve) {
      note = window.prompt("Optional note to the applicant (reason for rejection):", "") || "";
    }
    try {
      await api.post(`/absences/${a.id}/${approve ? "approve" : "reject"}`, { note });
      setNotice(approve ? `Approved ${a.anime_name || "the request"}.` : `Rejected ${a.anime_name || "the request"}.`);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    }
  };

  const header = role === "admin"
    ? { label: "Admin / Absences", title: "Absence Requests", subtitle: "Approve or reject time-off requests from editors and moderators." }
    : role === "moderator"
      ? { label: "Moderator / Absence", title: "Absence", subtitle: "Apply for time off (an admin approves), and review editor absence requests." }
      : { label: "Editor / Absence", title: "Absence", subtitle: "Apply for time off — a moderator or admin will review your request." };

  return (
    <Layout allowed={allowed}>
      <PageHeader label={header.label} title={header.title} subtitle={header.subtitle} />

      {err && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-xl px-4 py-3 text-sm">{err}</div>}
      {notice && <div className="mb-4 border border-blue-500/20 bg-blue-500/10 text-blue-200 rounded-xl px-4 py-3 text-sm">{notice}</div>}

      {isApplicant && (
        <div className="grid lg:grid-cols-2 gap-4 mb-8">
          <div className="border border-white/10 rounded-2xl bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold mb-1">Apply for absence</h2>
            <p className="text-sm text-zinc-500 mb-4">
              {role === "moderator" ? "Only an admin can approve a moderator's absence." : "A moderator or admin will review this request."}
            </p>
            <div className="space-y-3">
              <textarea data-testid="absence-reason" className={inp} rows={4} placeholder="Reason for your absence (required)…" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label-xs text-zinc-500 mb-1">From</div>
                  <input type="date" className={inp} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <div className="label-xs text-zinc-500 mb-1">To</div>
                  <input type="date" className={inp} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <button data-testid="absence-submit" onClick={apply} disabled={busy} className="text-white rounded-xl py-2.5 px-4 text-sm font-medium disabled:opacity-50 shadow-[0_0_28px_rgba(0,81,255,.22)]" style={{ background: BLUE }}>
                {busy ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </div>

          <div className="border border-white/10 rounded-2xl bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold mb-4">My requests</h2>
            <div className="space-y-3">
              {mine.length === 0 && <div className="text-sm text-zinc-500">No absence requests yet.</div>}
              {mine.map((a) => (
                <div key={a.id} className="border border-white/10 rounded-xl bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs text-zinc-500 font-mono">{fmtRange(a)}</span>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </div>
                  <div className="text-sm text-zinc-300">{a.reason}</div>
                  {a.status === "rejected" && a.decision_note && <div className="text-xs text-red-300 mt-2">Note: {a.decision_note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isApprover && (
        <div className="border border-white/10 rounded-2xl bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending approvals</h2>
            <Badge tone={pending.length ? "warn" : "good"}>{pending.length} pending</Badge>
          </div>
          <div className="space-y-3">
            {pending.length === 0 && <div className="text-sm text-zinc-500">No pending absence requests.</div>}
            {pending.map((a) => (
              <div key={a.id} data-testid={`absence-pending-${a.id}`} className="border border-white/10 rounded-xl bg-black/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {a.applicant?.avatar_url ? (
                    <img src={a.applicant.avatar_url} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 grid place-items-center text-sm shrink-0">{(a.anime_name || "U").charAt(0).toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {a.anime_name}
                      <span className="text-[11px] text-zinc-500 lowercase">{a.user_role}</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">{fmtRange(a)}</div>
                    <div className="text-sm text-zinc-300 mt-1">{a.reason}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button data-testid={`absence-approve-${a.id}`} onClick={() => decide(a, true)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25">Approve</button>
                  <button data-testid={`absence-reject-${a.id}`} onClick={() => decide(a, false)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
