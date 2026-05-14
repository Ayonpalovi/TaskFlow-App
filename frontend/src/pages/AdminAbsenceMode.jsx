import Layout, { PageHeader } from "../components/Layout";

export default function AdminAbsenceMode() {
  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Absence Mode" title="Absence Mode" subtitle="Temporary Moderator controls for Owner/Admin absence." />
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-100 font-semibold">
        Absence Mode Active — Moderator is managing operations.
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-900/30 p-5 text-sm text-zinc-300">
        Use this page to select a Moderator, set access duration, choose permissions, add an absence note, and turn Absence Mode off when the Owner/Admin returns.
      </div>
    </Layout>
  );
}
