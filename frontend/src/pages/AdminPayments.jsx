import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("current");

  const load = async () => {
    const [r, h] = await Promise.all([api.get("/payments"), api.get("/payments/history")]);
    setRows(r.data); setHistory(h.data);
  };
  useEffect(() => { load(); }, []);

  const markPaid = async (eid) => { await api.post(`/payments/${eid}/mark-paid`); load(); };

  const totalOwed = rows.filter(r => r.status === "unpaid").reduce((s, r) => s + r.amount_owed, 0);
  const totalPaid = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount_owed, 0);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Payments" title="Editor Payments" subtitle="Track what each editor is owed this month. Resets every 5th." />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Total Owed</div>
          <div className="font-mono text-3xl text-amber-400">${totalOwed.toLocaleString()}</div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Total Paid</div>
          <div className="font-mono text-3xl text-emerald-400">${totalPaid.toLocaleString()}</div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-500 mb-2">Editors</div>
          <div className="font-mono text-3xl">{rows.length}</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-white/10">
        <button onClick={() => setTab("current")} data-testid="tab-current" className={`px-4 py-2 text-sm border-b-2 ${tab === "current" ? "border-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Current Month</button>
        <button onClick={() => setTab("history")} data-testid="tab-history" className={`px-4 py-2 text-sm border-b-2 ${tab === "history" ? "border-white" : "border-transparent text-zinc-400 hover:text-white"}`}>History</button>
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
                  <td className="p-3 font-mono">${r.charge_per_project}</td>
                  <td className="p-3 font-mono">{r.completed_this_month}</td>
                  <td className="p-3 font-mono text-amber-400">${r.amount_owed.toLocaleString()}</td>
                  <td className="p-3"><Badge tone={r.status === "paid" ? "good" : "warn"}>{r.status}</Badge></td>
                  <td className="p-3">{r.status === "unpaid" && (
                    <button onClick={() => markPaid(r.editor.id)} data-testid={`mark-paid-${r.editor.id}`} className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200">Mark paid</button>
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
                <th className="p-3">Completed</th><th className="p-3">Amount</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t border-white/5">
                  <td className="p-3 font-mono">{h.month}</td>
                  <td className="p-3">{h.editor_name}</td>
                  <td className="p-3 text-zinc-400">{h.real_name}</td>
                  <td className="p-3 font-mono">{h.completed}</td>
                  <td className="p-3 font-mono">${h.amount?.toLocaleString()}</td>
                  <td className="p-3"><Badge tone={h.status === "paid" ? "good" : "warn"}>{h.status}</Badge></td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-zinc-500">No history yet. Resets on 5th of each month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
