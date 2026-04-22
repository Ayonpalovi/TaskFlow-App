import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard } from "../components/Layout";
import { api } from "../lib/api";

export default function EditorPerformance() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get("/performance/me").then(r => setP(r.data)); }, []);
  const tone = (v) => v >= 90 ? "good" : v >= 70 ? "warn" : "bad";

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label="Performance / 30-day" title="Your Metrics" subtitle="Rolling 30-day window. Updates as you ship." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard label="On-time Rate" value={`${p?.on_time_rate ?? 0}%`} tone={tone(p?.on_time_rate ?? 0)} />
        <MetricCard label="Acceptance Rate" value={`${p?.acceptance_rate ?? 0}%`} tone={tone(p?.acceptance_rate ?? 0)} />
        <MetricCard label="Videos / Week" value={p?.videos_per_week ?? 0} />
        <MetricCard label="Revision Rate" value={`${p?.revision_rate ?? 0}%`} tone={p?.revision_rate > 30 ? "bad" : p?.revision_rate > 15 ? "warn" : "good"} />
        <MetricCard label="Response Rate" value={`${p?.response_rate ?? 0}%`} tone={tone(p?.response_rate ?? 0)} />
        <MetricCard label="Avg Rating" value={`${p?.avg_rating ?? 0} ★`} />
        <MetricCard label="Total Tasks" value={p?.total_tasks ?? 0} />
        <MetricCard label="Completed" value={p?.completed_tasks ?? 0} tone="good" />
        <MetricCard label="Overall Score" value={p?.score ?? 0} tone={tone(p?.score ?? 0)} />
      </div>
    </Layout>
  );
}
