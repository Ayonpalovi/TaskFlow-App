import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api } from "../lib/api";

function Money({ value }) {
  return <span className="font-mono">${Number(value || 0).toLocaleString()}</span>;
}

export default function EditorPerformance() {
  const [p, setP] = useState(null);
  const [proofs, setProofs] = useState([]);

  useEffect(() => {
    api.get("/performance/me").then(r => setP(r.data));
    api.get("/workflow/editor-payment-invoices/me")
      .then(r => setProofs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProofs([]));
  }, []);

  const tone = (v) => v >= 90 ? "good" : v >= 70 ? "warn" : "bad";

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label="Performance / 30-day" title="Your Metrics" subtitle="Rolling 30-day window. Updates as you ship. Payment proofs appear after Admin marks you as paid." />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
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

      <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Payment Proof Invoices</h2>
            <p className="text-sm text-zinc-500 mt-1">Auto-generated when Admin marks your editor payment as paid.</p>
          </div>
          <Badge tone={proofs.length ? "good" : "default"}>{proofs.length} proofs</Badge>
        </div>

        {proofs.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg p-8 text-center text-sm text-zinc-500">
            No payment proof invoices yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {proofs.map((proof) => (
              <div key={proof.id} className="border border-white/10 rounded-lg bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="label-xs text-zinc-500 mb-2">Payment Proof</div>
                    <div className="font-semibold">{proof.invoice_number}</div>
                    <div className="text-xs text-zinc-500 mt-1">{proof.month}</div>
                  </div>
                  <Badge tone="good">{proof.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mt-5">
                  <div><span className="text-zinc-500">Completed:</span> {proof.completed_projects}</div>
                  <div><span className="text-zinc-500">Rate:</span> <Money value={proof.charge_per_project} /></div>
                  <div><span className="text-zinc-500">Amount:</span> <span className="text-emerald-400"><Money value={proof.amount} /></span></div>
                  <div><span className="text-zinc-500">Paid:</span> {proof.paid_date?.slice(0, 10) || "—"}</div>
                </div>

                <div className="text-xs text-zinc-600 mt-4">This is your payment proof from Motionholic OS.</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
