import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

export default function AdminCalendar() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/calendar").then(r => setItems(r.data)); }, []);

  // Group by day
  const byDate = items.reduce((acc, it) => {
    const d = it.deadline?.slice(0, 10) || "unknown";
    (acc[d] = acc[d] || []).push(it); return acc;
  }, {});
  const sorted = Object.keys(byDate).sort();

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Calendar" title="Deadlines" subtitle="Upcoming and past delivery dates grouped by day." />
      <div className="space-y-4">
        {sorted.map(d => (
          <div key={d} className="border border-white/10 rounded-md bg-zinc-900/30 p-4">
            <div className="label-xs text-zinc-400 mb-3 font-mono">{d}</div>
            <div className="space-y-2">
              {byDate[d].map(t => (
                <div key={t.task_id} className="flex items-center gap-3 p-2">
                  <div className="flex-1 text-sm">{t.title}</div>
                  <Badge tone={t.priority === "urgent" ? "bad" : "default"}>{t.priority}</Badge>
                  <Badge tone={t.status === "completed" ? "good" : t.status === "revision" ? "bad" : "warn"}>{t.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
        {sorted.length === 0 && <div className="text-sm text-zinc-500 p-8 text-center">No scheduled deadlines.</div>}
      </div>
    </Layout>
  );
}
