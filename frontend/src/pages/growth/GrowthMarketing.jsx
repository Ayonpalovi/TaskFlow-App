import { useEffect, useState } from "react";
import { Plus, Megaphone } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import Layout, { PageHeader, Badge } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_TONE = { planning: "default", active: "good", paused: "warn", done: "blue" };
const CHANNELS = ["instagram", "cold_email", "cold_dm", "referral_program", "content_seo", "other"];

export default function GrowthMarketing() {
  const [campaigns, setCampaigns] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "instagram", status: "planning", notes: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/growth/campaigns");
    setCampaigns(res.data);
  }

  async function create(e) {
    e.preventDefault();
    await api.post("/growth/campaigns", form);
    setForm({ name: "", channel: "instagram", status: "planning", notes: "" });
    setOpen(false);
    load();
  }

  async function setStatus(id, status) {
    await api.put(`/growth/campaigns/${id}`, { status });
    load();
  }

  return (
    <Layout>
      <PageHeader label="Demand gen" title="Marketing" subtitle="Campaigns feeding your pipeline.">
        <Button onClick={() => setOpen(true)} data-testid="new-campaign-button">
          <Plus size={16} /> New campaign
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <div key={c.id} className="border border-white/10 rounded-md bg-zinc-900/30 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-blue-400" />
                <p className="font-medium text-zinc-100">{c.name}</p>
              </div>
              <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
            </div>
            <p className="text-xs text-zinc-500">{c.channel.replace("_", " ")}</p>
            {c.notes && <p className="mt-2 text-sm text-zinc-400">{c.notes}</p>}
            <div className="mt-3 flex items-center gap-4 border-t border-white/10 pt-3">
              <div>
                <p className="font-mono text-lg text-zinc-100">{c.leads_attributed}</p>
                <p className="label-xs text-zinc-600">leads</p>
              </div>
              <div>
                <p className="font-mono text-lg text-emerald-400">{c.leads_won}</p>
                <p className="label-xs text-zinc-600">won</p>
              </div>
              <select
                value={c.status}
                onChange={(e) => setStatus(c.id, e.target.value)}
                className="ml-auto rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
              >
                {Object.keys(STATUS_TONE).map((s) => (
                  <option key={s} value={s} className="bg-zinc-950">{s}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="col-span-full py-10 text-center text-zinc-600">No campaigns yet — plan your first push.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <Field label="Name *">
              <input className={inputClass} required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Channel">
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className={inputClass}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c} className="bg-zinc-950">{c.replace("_", " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes / content plan">
              <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
            <Button type="submit" className="w-full" data-testid="campaign-create-submit">Create campaign</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
