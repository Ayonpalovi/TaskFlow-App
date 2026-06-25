import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Layout, { PageHeader, Badge } from "@/components/Layout";
import { STAGES, STAGE_DOT, TEMPERATURE_TONE, formatMoney } from "@/lib/growthUtils";
import { LeadDetailDialog } from "@/components/growth/LeadDetailDialog";

export default function GrowthPipeline() {
  const [leads, setLeads] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/growth/leads");
    setLeads(res.data);
  }

  async function moveTo(leadId, stage) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    await api.put(`/growth/leads/${leadId}`, { stage });
    load();
  }

  return (
    <Layout>
      <PageHeader label="Pipeline" title="Pipeline" subtitle="Drag a lead to move it through the funnel." />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          const totalValue = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0);
          return (
            <div
              key={stage.key}
              data-testid={`kanban-column-${stage.key}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                const leadId = e.dataTransfer.getData("text/plain");
                if (leadId) moveTo(leadId, stage.key);
                setDragOverStage(null);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-md border bg-zinc-900/50 p-3 transition-all ${
                dragOverStage === stage.key ? "border-white/40 bg-zinc-800/50" : "border-white/10"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage.key]}`} />
                  <p className="label-xs text-zinc-400">{stage.label}</p>
                </div>
                <span className="font-mono text-xs text-zinc-500">{stageLeads.length}</span>
              </div>
              <p className="font-mono mb-2 px-1 text-xs text-zinc-600">{formatMoney(totalValue)}</p>

              <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                    onClick={() => setActiveLeadId(lead.id)}
                    data-testid={`kanban-card-${lead.id}`}
                    className="cursor-grab border border-white/10 bg-zinc-900/50 rounded-md p-3 hover:bg-zinc-900 transition-all active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100 truncate">{lead.name}</p>
                      {lead.temperature && lead.temperature !== "cold" && (
                        <Badge tone={TEMPERATURE_TONE[lead.temperature]} className="shrink-0">{lead.temperature}</Badge>
                      )}
                    </div>
                    {lead.company && <p className="text-xs text-zinc-500 truncate">{lead.company}</p>}
                    <p className="font-mono mt-1.5 text-xs text-blue-400">{formatMoney(lead.value)}</p>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-xs text-zinc-600 p-3 text-center border border-dashed border-white/5 rounded-md">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LeadDetailDialog
        leadId={activeLeadId}
        open={!!activeLeadId}
        onOpenChange={(o) => !o && setActiveLeadId(null)}
        onChanged={load}
      />
    </Layout>
  );
}
