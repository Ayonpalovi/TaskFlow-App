import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../../components/Layout";
import { api, formatApiError } from "../../lib/api";

const BLUE = "#0051FF";

const categories = [
  ["delay", "Delayed project"],
  ["payment", "Payment issue"],
  ["conflict", "Client conflict"],
  ["team", "Team member unavailable"],
  ["approval", "Urgent approval needed"],
];

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">{children}</div>;
}

function Card({ title, children }) {
  return <section className="rounded-2xl border border-white/10 bg-zinc-900/35 p-4 shadow-2xl shadow-black/15 backdrop-blur"><h2 className="mb-3 text-base font-semibold tracking-tight">{title}</h2>{children}</section>;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ModeratorEscalations() {
  const [form, setForm] = useState({ title: "", category: "delay", body: "" });
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadEscalations = async () => {
    try {
      const response = await api.get("/moderator/dashboard");
      const dashboard = response.data || {};
      const notes = dashboard.escalation_center?.issues_needing_admin_attention || [];
      setItems(Array.isArray(notes) ? notes : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    loadEscalations();
  }, []);

  const submit = async () => {
    setError("");
    setNotice("");

    const categoryLabel = categories.find(([value]) => value === form.category)?.[1] || "Moderator escalation";
    const title = form.title.trim() || categoryLabel;
    const body = form.body.trim();

    if (!title && !body) {
      setError("Write a short issue title or note before notifying Admin.");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post("/moderator/escalations", {
        title,
        category: form.category,
        body,
      });
      const created = response.data?.escalation || response.data;
      setItems((prev) => [created, ...prev]);
      setForm({ title: "", category: "delay", body: "" });
      setNotice("Sent to Admin. Admin will receive this as a notification.");
      await loadEscalations();
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout allowed={["moderator"]}>
      <PageHeader label="Moderator / Escalations" title="Escalations" subtitle="Send issues directly to Admin notifications." />
      {notice && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[.75fr,1fr]">
        <Card title="Create Escalation Note">
          <div className="space-y-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Issue title" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" />
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Short note to Admin" rows={3} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" />
            <button onClick={submit} disabled={saving} className="w-full rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? "Notifying Admin…" : "Notify Admin"}</button>
          </div>
        </Card>
        <Card title="Submitted Notes">
          {items.length ? <div className="space-y-3">{items.map((item) => {
            const meta = item.metadata || {};
            const title = meta.title || item.target_email || "Escalation";
            const category = meta.category || "issue";
            const body = meta.body || "";
            return <div key={item.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium text-amber-100">{title}</div><div className="mt-1 text-xs text-amber-200/70">{category} · {formatDate(item.created_at)}</div></div><Badge tone={meta.notification_sent === false ? "warn" : "good"}>{meta.notification_sent === false ? "saved" : "admin notified"}</Badge></div>{body && <p className="mt-3 text-amber-100/80">{body}</p>}</div>;
          })}</div> : <Empty>No escalation notes yet.</Empty>}
        </Card>
      </div>
    </Layout>
  );
}
