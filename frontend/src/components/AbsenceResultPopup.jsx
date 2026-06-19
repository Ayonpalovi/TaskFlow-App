import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const ACK_KEY = "motionholic_absence_seen";

function getSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(ACK_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function addSeen(key) {
  try {
    const s = getSeen();
    s.add(key);
    localStorage.setItem(ACK_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    // localStorage may be unavailable in private mode — popup just shows again later.
  }
}

// Global watcher: shows the applicant a popup when their absence request is
// approved ("Enjoy your holiday") or rejected. Only runs for editors/moderators.
export default function AbsenceResultPopup() {
  const { user } = useAuth();
  const [popup, setPopup] = useState(null);

  const isApplicant = user && (user.role === "editor" || user.role === "moderator");

  const check = useCallback(async () => {
    if (!isApplicant) return;
    try {
      const { data } = await api.get("/absences");
      const decided = (data.mine || []).filter((a) => a.status === "approved" || a.status === "rejected");
      const seen = getSeen();
      const fresh = decided.find((a) => !seen.has(`${a.id}:${a.status}`));
      if (fresh) setPopup(fresh);
    } catch {
      // ignore transient errors
    }
  }, [isApplicant]);

  useEffect(() => {
    if (!isApplicant) return;
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [isApplicant, check]);

  if (!popup) return null;

  const approved = popup.status === "approved";
  const range = popup.start_date && popup.end_date
    ? `${popup.start_date} → ${popup.end_date}`
    : popup.start_date || popup.end_date || "";
  const dismiss = () => {
    addSeen(`${popup.id}:${popup.status}`);
    setPopup(null);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={dismiss}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border p-7 text-center bg-zinc-950 ${approved ? "border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,.20)]" : "border-red-500/30 shadow-[0_0_60px_rgba(239,68,68,.18)]"}`}
      >
        <div className="text-5xl mb-3">{approved ? "🌴" : "🙇"}</div>
        <h3 className="text-2xl font-bold mb-2">{approved ? "Enjoy your holiday!" : "Request not approved"}</h3>
        <p className="text-sm text-zinc-400">
          {approved
            ? `Your absence request was approved${range ? ` for ${range}` : ""}. Enjoy your time off! 🎉`
            : "Sorry to inform you — your absence application was not approved by the admin."}
        </p>
        {!approved && popup.decision_note && <p className="text-xs text-red-300 mt-3">Note: {popup.decision_note}</p>}
        <button
          onClick={dismiss}
          className={`mt-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white ${approved ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          {approved ? "Thank you!" : "Okay"}
        </button>
      </div>
    </div>
  );
}
