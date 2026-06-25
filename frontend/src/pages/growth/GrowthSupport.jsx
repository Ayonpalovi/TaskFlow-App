import { useEffect, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import Layout, { PageHeader, Badge } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketDetailDialog } from "@/components/growth/TicketDetailDialog";

const STATUS_TONE = { open: "warn", in_progress: "blue", resolved: "good" };
const PRIORITY_TONE = { low: "default", normal: "default", high: "bad" };

export default function GrowthSupport() {
  const [tickets, setTickets] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState({ subject: "", client_name: "", priority: "normal", description: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/growth/tickets");
    setTickets(res.data);
  }

  async function create(e) {
    e.preventDefault();
    await api.post("/growth/tickets", form);
    setForm({ subject: "", client_name: "", priority: "normal", description: "" });
    setOpen(false);
    load();
  }

  return (
    <Layout>
      <PageHeader label="Client care" title="Support" subtitle="Client inquiries and revisions.">
        <Button onClick={() => setOpen(true)} data-testid="new-ticket-button">
          <Plus size={16} /> New ticket
        </Button>
      </PageHeader>

      <div className="space-y-2">
        {tickets.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveId(t.id)}
            data-testid={`ticket-row-${t.id}`}
            className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-zinc-900/30 px-4 py-3 hover:bg-zinc-900/60 transition-all"
          >
            <div>
              <p className="text-sm text-zinc-100">{t.subject}</p>
              <p className="text-xs text-zinc-500">{t.client_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
              <Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
            </div>
          </div>
        ))}
        {tickets.length === 0 && <p className="py-10 text-center text-zinc-600">No tickets — all quiet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <Field label="Subject *">
              <input className={inputClass} required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </Field>
            <Field label="Client *">
              <input className={inputClass} required value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className={inputClass}
              >
                {["low", "normal", "high"].map((p) => (
                  <option key={p} value={p} className="bg-zinc-950">{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <Button type="submit" className="w-full" data-testid="ticket-create-submit">Create ticket</Button>
          </form>
        </DialogContent>
      </Dialog>

      <TicketDetailDialog ticketId={activeId} open={!!activeId} onOpenChange={(o) => !o && setActiveId(null)} onChanged={load} />
    </Layout>
  );
}
