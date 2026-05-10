import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

function Money({ value }) {
  return <span className="font-mono">${Number(value || 0).toLocaleString()}</span>;
}

const metricStyles = {
  red: {
    border: "rgba(239, 68, 68, 0.30)",
    glow: "rgba(239, 68, 68, 0.10)",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  green: {
    border: "rgba(34, 197, 94, 0.30)",
    glow: "rgba(34, 197, 94, 0.10)",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  blue: {
    border: "rgba(59, 130, 246, 0.30)",
    glow: "rgba(59, 130, 246, 0.10)",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  amber: {
    border: "rgba(245, 158, 11, 0.34)",
    glow: "rgba(245, 158, 11, 0.11)",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  purple: {
    border: "rgba(168, 85, 247, 0.30)",
    glow: "rgba(168, 85, 247, 0.10)",
    text: "text-purple-300",
    dot: "bg-purple-400",
  },
  teal: {
    border: "rgba(20, 184, 166, 0.30)",
    glow: "rgba(20, 184, 166, 0.10)",
    text: "text-teal-300",
    dot: "bg-teal-400",
  },
  pink: {
    border: "rgba(236, 72, 153, 0.28)",
    glow: "rgba(236, 72, 153, 0.095)",
    text: "text-pink-300",
    dot: "bg-pink-400",
  },
  cyan: {
    border: "rgba(6, 182, 212, 0.30)",
    glow: "rgba(6, 182, 212, 0.10)",
    text: "text-cyan-300",
    dot: "bg-cyan-400",
  },
  indigo: {
    border: "rgba(99, 102, 241, 0.30)",
    glow: "rgba(99, 102, 241, 0.10)",
    text: "text-indigo-300",
    dot: "bg-indigo-400",
  },
};

function PerformanceMetricCard({ label, value, color = "blue", helper }) {
  const style = metricStyles[color] || metricStyles.blue;

  return (
    <div
      className="relative overflow-hidden border rounded-xl p-5 bg-zinc-900/30 min-h-[112px] card-hover"
      style={{
        borderColor: style.border,
        background: `linear-gradient(135deg, ${style.glow}, rgba(24, 24, 27, 0.44) 58%, rgba(9, 9, 11, 0.72))`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: style.border }} />
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="label-xs text-zinc-500">{label}</div>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      </div>
      <div className={`font-mono text-3xl font-semibold tracking-tight ${style.text}`}>{value}</div>
      {helper && <div className="text-xs text-zinc-600 mt-2">{helper}</div>}
    </div>
  );
}

function HappinessCard({ item }) {
  const rating = Number(item.rating || 0);
  const color = rating >= 8 ? metricStyles.green : rating >= 6 ? metricStyles.amber : metricStyles.red;

  return (
    <div
      className="relative overflow-hidden border rounded-xl bg-black/20 p-4 card-hover"
      style={{
        borderColor: color.border,
        background: `linear-gradient(135deg, ${color.glow}, rgba(24, 24, 27, 0.42) 62%, rgba(9, 9, 11, 0.74))`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color.border }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-xs text-zinc-500 mb-2">Anonymous Client Feedback</div>
          <div className="font-semibold text-white">{item.project_title}</div>
          <div className="text-xs text-zinc-500 mt-1">{item.project_type} · {item.created_at?.slice(0, 10) || "No date"}</div>
        </div>
        <div className={`font-mono text-2xl ${color.text}`}>{rating}/10</div>
      </div>

      {item.feedback ? (
        <p className="text-sm text-zinc-300 mt-4">{item.feedback}</p>
      ) : (
        <p className="text-sm text-zinc-600 mt-4">No written feedback.</p>
      )}

      {item.source === "happiness_score" && (
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div className="rounded-lg border border-white/5 bg-black/20 p-2"><span className="text-zinc-600">Fast:</span> {item.fast_enough || "—"}</div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-2"><span className="text-zinc-600">Clear:</span> {item.clear_communication || "—"}</div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-2"><span className="text-zinc-600">Final:</span> {item.happy_final || "—"}</div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-2"><span className="text-zinc-600">Again:</span> {item.work_again || "—"}</div>
        </div>
      )}

      <div className="text-xs text-zinc-600 mt-4">Client name hidden for privacy.</div>
    </div>
  );
}

export default function EditorPerformance() {
  const [p, setP] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [happiness, setHappiness] = useState([]);

  useEffect(() => {
    api.get("/performance/me").then(r => setP(r.data));
    api.get("/workflow/editor-payment-invoices/me")
      .then(r => setProofs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProofs([]));
    api.get("/workflow/editor-happiness/me")
      .then(r => setHappiness(Array.isArray(r.data) ? r.data : []))
      .catch(() => setHappiness([]));
  }, []);

  const score = p?.score ?? 0;
  const onTime = p?.on_time_rate ?? 0;
  const acceptance = p?.acceptance_rate ?? 0;
  const revision = p?.revision_rate ?? 0;
  const response = p?.response_rate ?? 0;
  const happinessAverage = useMemo(() => {
    if (!happiness.length) return 0;
    return happiness.reduce((sum, item) => sum + Number(item.rating || 0), 0) / happiness.length;
  }, [happiness]);

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label="Performance / 30-day" title="Your Metrics" subtitle="Color-coded performance overview. Client happiness feedback is anonymous." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <PerformanceMetricCard label="On-time Rate" value={`${onTime}%`} color={onTime >= 90 ? "green" : onTime >= 70 ? "amber" : "red"} helper="Delivery reliability" />
        <PerformanceMetricCard label="Acceptance Rate" value={`${acceptance}%`} color={acceptance >= 90 ? "green" : acceptance >= 70 ? "amber" : "red"} helper="Approved without issues" />
        <PerformanceMetricCard label="Videos / Week" value={p?.videos_per_week ?? 0} color="blue" helper="Weekly output" />
        <PerformanceMetricCard label="Revision Rate" value={`${revision}%`} color={revision > 30 ? "red" : revision > 15 ? "amber" : "green"} helper="Lower is better" />
        <PerformanceMetricCard label="Response Rate" value={`${response}%`} color={response >= 90 ? "green" : response >= 70 ? "amber" : "red"} helper="Communication speed" />
        <PerformanceMetricCard label="Avg Rating" value={`${p?.avg_rating ?? 0} ★`} color="purple" helper="Client/admin quality signal" />
        <PerformanceMetricCard label="Total Tasks" value={p?.total_tasks ?? 0} color="cyan" helper="All assigned work" />
        <PerformanceMetricCard label="Completed" value={p?.completed_tasks ?? 0} color="teal" helper="Finished projects" />
        <PerformanceMetricCard label="Overall Score" value={score} color={score >= 90 ? "green" : score >= 70 ? "amber" : "red"} helper="Combined performance score" />
      </div>

      <div className="border border-purple-500/20 rounded-xl bg-gradient-to-br from-purple-500/10 via-zinc-900/30 to-zinc-950 p-5 mb-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Client Happiness Feedback</h2>
            <p className="text-sm text-zinc-500 mt-1">Feedback from projects you edited. Client identity is hidden.</p>
          </div>
          <Badge tone={happiness.length ? "good" : "default"}>{happinessAverage ? `${happinessAverage.toFixed(1)}/10 avg` : "No score"}</Badge>
        </div>

        {happiness.length === 0 ? (
          <div className="border border-dashed border-purple-500/20 rounded-lg p-8 text-center text-sm text-zinc-500 bg-black/20">
            No happiness feedback yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {happiness.map((item) => <HappinessCard key={`${item.source}-${item.id}`} item={item} />)}
          </div>
        )}
      </div>

      <div className="border border-emerald-500/20 rounded-xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/30 to-zinc-950 p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Payment Proof Invoices</h2>
            <p className="text-sm text-zinc-500 mt-1">Auto-generated when Admin marks your editor payment as paid.</p>
          </div>
          <Badge tone={proofs.length ? "good" : "default"}>{proofs.length} proofs</Badge>
        </div>

        {proofs.length === 0 ? (
          <div className="border border-dashed border-emerald-500/20 rounded-lg p-8 text-center text-sm text-zinc-500 bg-black/20">
            No payment proof invoices yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {proofs.map((proof) => (
              <div key={proof.id} className="border border-emerald-500/20 rounded-lg bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="label-xs text-emerald-300 mb-2">Payment Proof</div>
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
