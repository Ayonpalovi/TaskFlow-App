import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/Layout";
import { Field, inputClass } from "@/components/ui/field";
import { api } from "@/lib/api";
import { STAGES, STAGE_DOT, TEMPERATURES, TEMPERATURE_DOT, TEMPERATURE_TONE, TEMPERATURE_LABEL } from "@/lib/growthUtils";

const NOTE_TYPES = [
  { key: "note", label: "Note" },
  { key: "call", label: "Call" },
  { key: "meeting", label: "Meeting" },
  { key: "email_sent", label: "Email" },
  { key: "dm_sent", label: "DM" },
  { key: "proposal_sent", label: "Proposal" },
];

export function LeadDetailDialog({ leadId, open, onOpenChange, onChanged }) {
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [followupForm, setFollowupForm] = useState({ due_date: "", description: "" });

  useEffect(() => {
    if (!open || !leadId) return;
    refresh();
  }, [open, leadId]);

  async function refresh() {
    const [leadRes, actRes, fuRes] = await Promise.all([
      api.get(`/growth/leads/${leadId}`),
      api.get(`/growth/leads/${leadId}/activities`),
      api.get(`/growth/followups`),
    ]);
    setLead(leadRes.data);
    setActivities(actRes.data);
    setFollowups(fuRes.data.filter((f) => f.lead_id === leadId));
  }

  async function updateField(fields) {
    const res = await api.put(`/growth/leads/${leadId}`, fields);
    setLead(res.data);
    onChanged?.();
    if (fields.stage || fields.temperature) refresh();
  }

  async function addNote() {
    if (!note.trim()) return;
    await api.post(`/growth/leads/${leadId}/activities`, { type: noteType, content: note });
    setNote("");
    refresh();
  }

  async function addFollowup() {
    if (!followupForm.due_date || !followupForm.description) return;
    await api.post(`/growth/leads/${leadId}/followups`, followupForm);
    setFollowupForm({ due_date: "", description: "" });
    refresh();
  }

  async function completeFollowup(id) {
    await api.patch(`/growth/followups/${id}/done`);
    refresh();
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {lead.name} {lead.company && <span className="text-zinc-500">· {lead.company}</span>}
            <Badge tone={TEMPERATURE_TONE[lead.temperature || "cold"]}>{TEMPERATURE_LABEL[lead.temperature || "cold"]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="followups" data-testid="tab-followups">Follow-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <label className="label-xs text-zinc-400 block mb-1.5">Stage</label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.key}
                    data-testid={`stage-option-${s.key}`}
                    onClick={() => updateField({ stage: s.key })}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all duration-200 ${
                      lead.stage === s.key ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[s.key]}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-xs text-zinc-400 block mb-1.5">Temperature</label>
              <div className="flex flex-wrap gap-2">
                {TEMPERATURES.map((t) => (
                  <button
                    key={t.key}
                    data-testid={`temperature-option-${t.key}`}
                    onClick={() => updateField({ temperature: t.key })}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all duration-200 ${
                      (lead.temperature || "cold") === t.key ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${TEMPERATURE_DOT[t.key]}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs text-zinc-500 block mb-1.5">Email</label>
                <p className="text-sm text-zinc-300">{lead.email || "—"}</p>
              </div>
              <div>
                <label className="label-xs text-zinc-500 block mb-1.5">Instagram</label>
                <p className="text-sm text-zinc-300">{lead.instagram || "—"}</p>
              </div>
              <div>
                <label className="label-xs text-zinc-500 block mb-1.5">Source</label>
                <p className="text-sm text-zinc-300">{lead.source}</p>
              </div>
              <div>
                <label className="label-xs text-zinc-500 block mb-1.5">Industry / niche</label>
                <p className="text-sm text-zinc-300">{lead.niche || "—"}</p>
              </div>
            </div>
            <Field label="Deal value ($)">
              <input
                className={inputClass}
                type="number"
                defaultValue={lead.value}
                onBlur={(e) => updateField({ value: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={3}
                defaultValue={lead.notes || ""}
                onBlur={(e) => updateField({ notes: e.target.value })}
              />
            </Field>
          </TabsContent>

          <TabsContent value="activity" className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <div className="mb-1.5 flex gap-1.5 flex-wrap">
                {NOTE_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setNoteType(t.key)}
                    data-testid={`note-type-${t.key}`}
                    className={`rounded-md border px-2 py-0.5 text-xs transition-all ${
                      noteType === t.key ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="What happened?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid="activity-note-input"
                />
                <Button onClick={addNote} data-testid="activity-note-submit">Add</Button>
              </div>
            </div>

            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="border-l-2 border-white/10 pl-3">
                  <div className="flex items-center gap-2">
                    <Badge>{a.type.replace(/_/g, " ")}</Badge>
                    <p className="font-mono text-xs text-zinc-600">{format(new Date(a.created_at), "MMM d, h:mma")}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{a.content}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="followups" className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex gap-2">
              <input
                type="date"
                value={followupForm.due_date}
                onChange={(e) => setFollowupForm((f) => ({ ...f, due_date: e.target.value }))}
                className={`${inputClass} w-40`}
              />
              <input
                placeholder="What's next?"
                value={followupForm.description}
                onChange={(e) => setFollowupForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
              />
              <Button onClick={addFollowup} data-testid="followup-add-button">Add</Button>
            </div>
            <div className="space-y-2">
              {followups.length === 0 && <p className="text-sm text-zinc-600">No follow-ups scheduled.</p>}
              {followups.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                  <div>
                    <p className={`text-sm ${f.done ? "text-zinc-600 line-through" : "text-zinc-300"}`}>{f.description}</p>
                    <p className="font-mono text-xs text-zinc-600">{f.due_date}</p>
                  </div>
                  {!f.done && (
                    <Button size="sm" variant="ghost" onClick={() => completeFollowup(f.id)} data-testid={`followup-done-${f.id}`}>
                      <Check size={14} /> Done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
