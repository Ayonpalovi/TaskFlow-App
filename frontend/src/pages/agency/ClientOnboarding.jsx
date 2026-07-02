import { useState } from "react";
import Layout, { PageHeader, Badge } from "../../components/Layout";

const STORE_KEY = "motionholic_os_onboarding_v1";
const STEPS = ["Brand", "Goals", "Style", "Logistics", "Review"];

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(entries) {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

const emptyForm = {
  brand_name: "",
  industry: "",
  website: "",
  video_goals: "",
  target_platforms: "",
  reference_links: "",
  brand_voice: "",
  turnaround: "",
  monthly_volume: "",
  contact_email: "",
  notes: "",
};

export default function ClientOnboarding() {
  const [entries, setEntries] = useState(loadStore);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const finish = () => {
    const entry = { id: `client_${Date.now()}`, ...form, created_at: new Date().toISOString() };
    const next = [entry, ...entries];
    setEntries(next);
    saveStore(next);
    setForm(emptyForm);
    setStep(0);
    setCreating(false);
  };

  const removeEntry = (id) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveStore(next);
  };

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Client Onboarding" title="Client Onboarding" subtitle="Guided 5-step intake to capture a new client's brand, goals, and logistics before kickoff.">
        <button type="button" onClick={() => { setCreating((v) => !v); setStep(0); }} className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90">
          {creating ? "Cancel" : "+ Onboard client"}
        </button>
      </PageHeader>

      {creating && (
        <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-mono ${i === step ? "bg-[#0051FF] text-white" : i < step ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${i === step ? "text-white" : "text-zinc-500"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="w-4 sm:w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <input className="input-field" placeholder="Brand / company name" value={form.brand_name} onChange={set("brand_name")} />
              <input className="input-field" placeholder="Industry" value={form.industry} onChange={set("industry")} />
              <input className="input-field sm:col-span-2" placeholder="Website URL" value={form.website} onChange={set("website")} />
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3">
              <textarea className="input-field min-h-[90px]" placeholder="Video goals — what are they trying to achieve?" value={form.video_goals} onChange={set("video_goals")} />
              <input className="input-field" placeholder="Target platforms (e.g. Instagram, TikTok, YouTube)" value={form.target_platforms} onChange={set("target_platforms")} />
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3">
              <input className="input-field" placeholder="Reference links (comma separated)" value={form.reference_links} onChange={set("reference_links")} />
              <textarea className="input-field min-h-[90px]" placeholder="Brand voice / tone / editing style notes" value={form.brand_voice} onChange={set("brand_voice")} />
            </div>
          )}
          {step === 3 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <input className="input-field" placeholder="Expected turnaround (e.g. 3 days)" value={form.turnaround} onChange={set("turnaround")} />
              <input className="input-field" placeholder="Monthly video volume" value={form.monthly_volume} onChange={set("monthly_volume")} />
              <input className="input-field sm:col-span-2" placeholder="Contact email" value={form.contact_email} onChange={set("contact_email")} />
            </div>
          )}
          {step === 4 && (
            <div className="grid gap-2 text-sm">
              <div><span className="text-zinc-500">Brand:</span> {form.brand_name || "—"} ({form.industry || "—"})</div>
              <div><span className="text-zinc-500">Goals:</span> {form.video_goals || "—"}</div>
              <div><span className="text-zinc-500">Platforms:</span> {form.target_platforms || "—"}</div>
              <div><span className="text-zinc-500">Turnaround:</span> {form.turnaround || "—"} · <span className="text-zinc-500">Volume:</span> {form.monthly_volume || "—"}</div>
              <div><span className="text-zinc-500">Contact:</span> {form.contact_email || "—"}</div>
              <textarea className="input-field min-h-[70px] mt-2" placeholder="Any final notes before kickoff" value={form.notes} onChange={set("notes")} />
            </div>
          )}

          <div className="flex items-center justify-between mt-5">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="px-3 py-2 rounded-md border border-white/10 text-sm disabled:opacity-30">Back</button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Next</button>
            ) : (
              <button type="button" onClick={finish} className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90">Complete onboarding</button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {entries.map((c) => (
          <div key={c.id} className="border border-white/10 rounded-md bg-zinc-900/20 p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">{c.brand_name || "Unnamed client"}</div>
                {c.industry && <Badge>{c.industry}</Badge>}
              </div>
              <div className="text-xs text-zinc-500 mt-1 truncate">{c.video_goals || "No goals recorded"}</div>
              <div className="text-xs text-zinc-600 mt-1">{c.target_platforms} {c.turnaround && `· ${c.turnaround} turnaround`}</div>
            </div>
            <button type="button" onClick={() => removeEntry(c.id)} className="text-xs text-zinc-600 hover:text-red-400 shrink-0">Delete</button>
          </div>
        ))}
        {entries.length === 0 && !creating && <div className="text-sm text-zinc-600 text-center py-10 border border-dashed border-white/10 rounded-md">No clients onboarded yet.</div>}
      </div>

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }`}</style>
    </Layout>
  );
}
