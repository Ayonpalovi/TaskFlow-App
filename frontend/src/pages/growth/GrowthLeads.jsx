import { useEffect, useState } from "react";
import { Plus, MagnifyingGlass, UploadSimple } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import Layout, { PageHeader, Badge } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { STAGES, STAGE_TONE, TEMPERATURE_TONE, TEMPERATURE_LABEL, formatMoney } from "@/lib/growthUtils";
import { LeadFormDialog } from "@/components/growth/LeadFormDialog";
import { LeadDetailDialog } from "@/components/growth/LeadDetailDialog";
import { LeadImportDialog } from "@/components/growth/LeadImportDialog";

export default function GrowthLeads() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);

  useEffect(() => {
    load();
  }, [stageFilter]);

  async function load() {
    const res = await api.get("/growth/leads", { params: stageFilter ? { stage: stageFilter } : {} });
    setLeads(res.data);
  }

  const filtered = leads.filter((l) =>
    `${l.name} ${l.company || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader label="Pipeline source" title="Leads / CRM" subtitle="Every prospect, in one place.">
        <Button variant="secondary" onClick={() => setImportOpen(true)} data-testid="import-csv-button">
          <UploadSimple size={16} /> Import CSV
        </Button>
        <Button onClick={() => setCreateOpen(true)} data-testid="new-lead-button">
          <Plus size={16} /> New lead
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            placeholder="Search leads…"
            className="w-full bg-zinc-900 border border-white/10 rounded-md pl-8 pr-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="lead-search-input"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStageFilter("")}
            data-testid="stage-filter-all"
            className={`rounded-md border px-2.5 py-1 text-xs ${!stageFilter ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(s.key)}
              data-testid={`stage-filter-${s.key}`}
              className={`rounded-md border px-2.5 py-1 text-xs ${stageFilter === s.key ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-left text-zinc-500">
              <th className="label-xs px-4 py-2.5">Name</th>
              <th className="label-xs px-4 py-2.5">Stage</th>
              <th className="label-xs px-4 py-2.5">Temp</th>
              <th className="label-xs px-4 py-2.5">Source</th>
              <th className="label-xs px-4 py-2.5">Value</th>
              <th className="label-xs px-4 py-2.5">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setActiveLeadId(lead.id)}
                data-testid={`lead-row-${lead.id}`}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <p className="text-zinc-100">{lead.name}</p>
                  {lead.company && <p className="text-xs text-zinc-500">{lead.company}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STAGE_TONE[lead.stage]}>{STAGES.find((s) => s.key === lead.stage)?.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={TEMPERATURE_TONE[lead.temperature || "cold"]}>{TEMPERATURE_LABEL[lead.temperature || "cold"]}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-500">{lead.source}</td>
                <td className="font-mono px-4 py-3 text-zinc-300">{formatMoney(lead.value)}</td>
                <td className="px-4 py-3 text-zinc-600">{new Date(lead.last_activity_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                  No leads yet — add your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <LeadDetailDialog
        leadId={activeLeadId}
        open={!!activeLeadId}
        onOpenChange={(o) => !o && setActiveLeadId(null)}
        onChanged={load}
      />
    </Layout>
  );
}
