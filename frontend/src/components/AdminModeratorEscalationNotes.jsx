import { useEffect, useState } from "react";
import { Badge } from "./Layout";
import { api } from "../lib/api";

const ESCALATION_TYPE = "moderator_escalation";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getTitle(item) {
  return item.issue_title || item.brand_name || item.title || "Moderator escalation";
}

function getBody(item) {
  return item.issue_body || item.notes || item.body || "";
}

export default function AdminModeratorEscalationNotes() {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const response = await api.get("/workflow/brandProfiles");
      const rows = Array.isArray(response.data) ? response.data : [];
      setItems(rows.filter((item) => item.record_type === ESCALATION_TYPE));
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-zinc-900/30 to-zinc-950 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Moderator Escalation Notes</h2>
          <p className="mt-1 text-sm text-zinc-500">Messages sent by moderators that need Admin attention.</p>
        </div>
        <Badge tone={items.length ? "warn" : "default"}>{items.length} notes</Badge>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">No moderator escalation notes yet.</div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-500/20 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-amber-100">{getTitle(item)}</div>
                  <div className="mt-1 text-xs text-amber-200/70">{item.category || "issue"} · {formatDate(item.created_at)}</div>
                </div>
                <Badge tone={item.admin_status === "read" ? "good" : "warn"}>{item.admin_status || "unread"}</Badge>
              </div>
              {getBody(item) && <p className="mt-3 text-sm text-zinc-300">{getBody(item)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
