import Layout, { PageHeader, Badge } from "../components/Layout";

export default function ModeratorDashboard() {
  return (
    <Layout allowed={["moderator"]}>
      <PageHeader label="Moderator / Operations" title="Agency Manager Dashboard" subtitle="Limited operations dashboard for managing projects while the Owner/Admin is absent." />
      <div className="mb-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-100 font-semibold">
        Absence Mode Active — Moderator is managing operations.
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Projects</div><div className="mt-3 text-3xl font-semibold">Limited</div></div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Access</div><div className="mt-3"><Badge tone="blue">Temporary</Badge></div></div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Owner Controls</div><div className="mt-3"><Badge tone="bad">Blocked</Badge></div></div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-900/30 p-5 text-sm text-zinc-300">
        Moderator can support project operations, deadlines, team workload, client progress, file reviews, and client replies only when Absence Mode is enabled by the Owner/Admin.
      </div>
    </Layout>
  );
}
