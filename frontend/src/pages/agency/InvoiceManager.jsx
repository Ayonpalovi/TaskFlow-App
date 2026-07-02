import { useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../../components/Layout";

const STORE_KEY = "motionholic_os_invoices_v1";
const STATUSES = ["Unpaid", "Paid", "Overdue"];

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(invoices) {
  localStorage.setItem(STORE_KEY, JSON.stringify(invoices));
}

function money(v) {
  return `€${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function isOverdue(invoice) {
  if (invoice.status === "Paid") return false;
  if (!invoice.due_date) return false;
  return new Date(invoice.due_date) < new Date();
}

const emptyForm = { client: "", project: "", amount: "", due_date: "", notes: "" };

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState(loadStore);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const update = (next) => {
    setInvoices(next);
    saveStore(next);
  };

  const createInvoice = () => {
    if (!form.client.trim() || !form.amount) return;
    const invoice = {
      id: `inv_${Date.now()}`,
      number: `MH-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`,
      ...form,
      amount: Number(form.amount),
      status: "Unpaid",
      created_at: new Date().toISOString(),
    };
    update([invoice, ...invoices]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const markPaid = (id) => {
    update(invoices.map((i) => (i.id === id ? { ...i, status: "Paid", paid_at: new Date().toISOString() } : i)));
  };

  const removeInvoice = (id) => {
    update(invoices.filter((i) => i.id !== id));
  };

  const printInvoice = (invoice) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>${invoice.number}</title><style>body{font-family:Arial;padding:40px;color:#111}h1{color:#0051FF}.box{border:1px solid #ddd;padding:20px;border-radius:12px;margin:16px 0}</style></head><body><h1>Motionholic Invoice</h1><div class="box"><strong>Invoice:</strong> ${invoice.number}<br/><strong>Client:</strong> ${invoice.client}<br/><strong>Project:</strong> ${invoice.project || "—"}<br/><strong>Amount:</strong> ${money(invoice.amount)}<br/><strong>Status:</strong> ${invoice.status}<br/><strong>Due:</strong> ${invoice.due_date || "—"}</div><p>${invoice.notes || ""}</p><script>window.print()</script></body></html>`);
    win.document.close();
  };

  const rows = useMemo(
    () => invoices.map((i) => ({ ...i, status: i.status === "Paid" ? "Paid" : isOverdue(i) ? "Overdue" : "Unpaid" })),
    [invoices]
  );

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
    const unpaid = rows.filter((r) => r.status !== "Paid").reduce((s, r) => s + r.amount, 0);
    const overdue = rows.filter((r) => r.status === "Overdue").reduce((s, r) => s + r.amount, 0);
    return { paid, unpaid, overdue };
  }, [rows]);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Invoices" title="Invoice Manager" subtitle="Create, send, and track client invoices — separate from project finance in Workflow Suite.">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90">
          {showForm ? "Cancel" : "+ New invoice"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Paid" value={money(totals.paid)} tone="good" />
        <MetricCard label="Unpaid" value={money(totals.unpaid)} tone="warn" />
        <MetricCard label="Overdue" value={money(totals.overdue)} tone="bad" />
      </div>

      {showForm && (
        <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className="input-field" placeholder="Client name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            <input className="input-field" placeholder="Project" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
            <input className="input-field" type="number" placeholder="Amount (€)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className="input-field" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <input className="input-field lg:col-span-2" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="button" onClick={createInvoice} className="mt-3 px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Create invoice</button>
        </div>
      )}

      <div className="border border-white/10 rounded-md bg-zinc-900/20 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Project</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Due</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id} className="border-t border-white/5">
                <td className="p-3 font-mono text-xs">{inv.number}</td>
                <td className="p-3">{inv.client}</td>
                <td className="p-3 text-zinc-400">{inv.project || "—"}</td>
                <td className="p-3 font-mono">{money(inv.amount)}</td>
                <td className="p-3 text-zinc-400">{inv.due_date || "—"}</td>
                <td className="p-3"><Badge tone={inv.status === "Paid" ? "good" : inv.status === "Overdue" ? "bad" : "warn"}>{inv.status}</Badge></td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {inv.status !== "Paid" && <button type="button" onClick={() => markPaid(inv.id)} className="text-xs text-emerald-400 hover:underline">Mark paid</button>}
                    <button type="button" onClick={() => printInvoice(inv)} className="text-xs text-blue-400 hover:underline">Print</button>
                    <button type="button" onClick={() => removeInvoice(inv.id)} className="text-xs text-zinc-600 hover:text-red-400">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-zinc-600 text-sm">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; }`}</style>
    </Layout>
  );
}
