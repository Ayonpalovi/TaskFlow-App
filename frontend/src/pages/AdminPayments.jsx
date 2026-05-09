import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

function Money({ value, tone = "default" }) {
  const toneClass = tone === "warn" ? "text-amber-400" : tone === "good" ? "text-emerald-400" : "text-white";
  return <span className={`font-mono ${toneClass}`}>${Number(value || 0).toLocaleString()}</span>;
}

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [tab, setTab] = useState("current");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setErr("");
      const [r, h, p] = await Promise.all([
        api.get("/payments"),
        api.get("/payments/history"),
        api.get("/workflow/editor-payment-invoices").catch(() => ({ data: [] })),
      ]);
      setRows(r.data);
      setHistory(h.data);
      setProofs(Array.isArray(p.data) ? p.data : []);
    } catch (e) {
      setErr("Failed to load editor payments.");
    }
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (eid) => {
    try {
      setLoading(true);
      setErr("");
      await api.post(`/payments/${eid}/mark-paid`);
      await api.post(`/workflow/editor-payments/${eid}/mark-paid`);
      await load();
      setTab("proofs");
    } catch (e) {
      setErr("Payment was not completed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalOwed = rows.filter(r => r.status === "unpaid").reduce((s, r) => s + r.amount_owed, 0);
  const totalPaid = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount_owed, 0);
  const totalProofs = proofs.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Payments" title="Editor Payments" subtitle="Track editor payments and automatically generate payment proof invoices when marked paid." />

      {err && <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Total Owed</div>
          <div className="font-mono text-3xl text-amber-400">${totalOwed.toLocaleString()}</div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Total Paid</div>
          <div className="font-mono text-3xl text-emerald-400">${totalPaid.toLocaleString()}</div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Payment Proofs</div>
          <div className="font-mono text-3xl">{proofs.length}</div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Proof Total</div>
          <div className="font-mono text-3xl text-blue-400">${totalProofs.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-white/10 overflow-x-auto">
        <button onClick={() => setTab("current")} data-testid="tab-current" className={`px-4 py-2 text-sm border-b-2 whitespace-nowrap ${tab === "current" ? "border-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Current Month</button>
        <button onClick={() => setTab("history")} data-testid="tab-history" className={`px-4 py-2 text-sm border-b-2 whitespace-nowrap ${tab === "history" ? "border-white" : "border-transparent text-zinc-400 hover:text-white"}`}>History</button>
        <button onClick={() => setTab("proofs")} data-testid="tab-payment-proofs" className={`px-4 py-2 text-sm border-b-2 whitespace-nowrap ${tab === "proofs" ? "border-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Payment Proof Invoices</button>
      </div>

      {tab === "current" && (
        <div className="border border-white/10 rounded-md bg-zinc-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left label-xs text-zinc-400">
                <th className="p-3">Editor</th><th className="p-3">Real name</th><th className="p-3">Rate / project</th>
                <th className="p-3">Completed</th><th className="p-3">Owed</th><th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.editor.id} className="border-t border-white/5" data-testid={`payment-row-${r.editor.id}`}>
                  <td className="p-3 flex items-center gap-2">
                    {r.editor.avatar_url && <img src={r.editor.avatar_url} className="w-7 h-7 rounded-md object-cover" alt="" />}
                    <span>{r.editor.anime_name}</span>
                  </td>
                  <td className="p-3 text-zinc-400">{r.editor.real_name}</td>
                  <td className="p-3"><Money value={r.charge_per_project} /></td>
                  <td className="p-3 font-mono">{r.completed_this_month}</td>
                  <td className="p-3"><Money value={r.amount_owed} tone="warn" /></td>
                  <td className="p-3"><Badge tone={r.status === "paid" ? "good" : "warn"}>{r.status}</Badge></td>
                  <td className="p-3">{r.status === "unpaid" && (
                    <button disabled={loading} onClick={() => markPaid(r.editor.id)} data-testid={`mark-paid-${r.editor.id}`} className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200 disabled:opacity-50">
                      {loading ? "Saving..." : "Mark paid + Generate Proof"}
                    </button>
                  )}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-zinc-500">No editors yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div className="border border-white/10 rounded-md bg-zinc-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left label-xs text-zinc-400">
                <th className="p-3">Month</th><th className="p-3">Editor</th><th className="p-3">Real</th>
                <th className="p-3">Completed</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Proof</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t border-white/5">
                  <td className="p-3 font-mono">{h.month}</td>
                  <td className="p-3">{h.editor_name}</td>
                  <td className="p-3 text-zinc-400">{h.real_name}</td>
                  <td className="p-3 font-mono">{h.completed}</td>
                  <td className="p-3"><Money value={h.amount} /></td>
                  <td className="p-3"><Badge tone={h.status === "paid" ? "good" : "warn"}>{h.status}</Badge></td>
                  <td className="p-3 text-zinc-400 text-xs">{h.invoice_number || "—"}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-zinc-500">No history yet. Resets on 5th of each month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "proofs" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proofs.map((proof) => (
            <div key={proof.id} className="border border-white/10 rounded-xl bg-zinc-900/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="label-xs text-zinc-500 mb-2">Payment Proof</div>
                  <div className="font-semibold">{proof.invoice_number}</div>
                  <div className="text-sm text-zinc-500 mt-1">{proof.editor_name} · {proof.month}</div>
                </div>
                <Badge tone="good">{proof.status}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500">Completed:</span> {proof.completed_projects}</div>
                <div><span className="text-zinc-500">Rate:</span> <Money value={proof.charge_per_project} /></div>
                <div><span className="text-zinc-500">Amount:</span> <Money value={proof.amount} tone="good" /></div>
                <div><span className="text-zinc-500">Paid:</span> {proof.paid_date?.slice(0, 10)}</div>
              </div>
              <div className="text-xs text-zinc-600 mt-4">Visible to Admin and this editor as payment proof.</div>
            </div>
          ))}
          {proofs.length === 0 && <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500 md:col-span-2 xl:col-span-3">No payment proofs yet. Mark an editor as paid to generate one automatically.</div>}
        </div>
      )}
    </Layout>
  );
}
