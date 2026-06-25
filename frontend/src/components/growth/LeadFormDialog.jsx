import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { api } from "@/lib/api";

const SOURCES = ["cold_email", "cold_dm", "referral", "inbound", "content", "other"];

export function LeadFormDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ name: "", company: "", email: "", instagram: "", source: "other", niche: "", value: "" });
  const [busy, setBusy] = useState(false);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/growth/leads", { ...form, value: Number(form.value) || 0 });
      onCreated(res.data);
      onOpenChange(false);
      setForm({ name: "", company: "", email: "", instagram: "", source: "other", niche: "", value: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input className={inputClass} data-testid="lead-name-input" value={form.name} onChange={set("name")} required />
            </Field>
            <Field label="Company">
              <input className={inputClass} value={form.company} onChange={set("company")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Instagram / social">
              <input className={inputClass} value={form.instagram} onChange={set("instagram")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <select id="source" value={form.source} onChange={set("source")} className={inputClass}>
                {SOURCES.map((s) => (
                  <option key={s} value={s} className="bg-zinc-950">
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Est. deal value ($)">
              <input className={inputClass} type="number" min="0" value={form.value} onChange={set("value")} />
            </Field>
          </div>
          <Field label="Niche / industry">
            <input
              className={inputClass}
              placeholder="e.g. e-commerce, real estate, coaching"
              value={form.niche}
              onChange={set("niche")}
            />
          </Field>
          <Button type="submit" data-testid="lead-create-submit" disabled={busy} className="w-full">
            {busy ? "Adding…" : "Add lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
