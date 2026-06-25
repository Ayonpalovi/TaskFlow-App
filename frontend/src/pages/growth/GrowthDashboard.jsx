import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { api } from "@/lib/api";
import Layout, { PageHeader, MetricCard, Badge } from "@/components/Layout";
import { TEMPERATURE_TONE, TEMPERATURE_LABEL } from "@/lib/growthUtils";

const tooltipStyle = { background: "#09090B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 };

export default function GrowthDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/growth/dashboard/stats").then((res) => setStats(res.data));
  }, []);

  if (!stats) {
    return (
      <Layout>
        <div className="text-sm text-zinc-500 font-mono">loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader label="Overview" title="Dashboard" subtitle="Here's what's happening with your leads today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total Leads" value={stats.total_leads} />
        <MetricCard label="Active Leads" value={stats.active_leads} tone="blue" />
        <MetricCard label="Hot Leads" value={stats.hot_leads} tone={stats.hot_leads > 0 ? "bad" : "default"} />
        <MetricCard label="Contacted" value={stats.contacted} />
        <MetricCard label="Replied" value={stats.replied} />
        <MetricCard label="Meetings Booked" value={stats.meetings_booked} tone="blue" />
        <MetricCard label="Deals Won" value={stats.won_deals} tone="good" />
        <MetricCard label="Conversion Rate" value={`${stats.conversion_rate}%`} tone="good" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mt-4">
        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5 lg:col-span-2">
          <div className="label-xs text-zinc-500 mb-1">Lead Growth</div>
          <p className="text-xs text-zinc-600 mb-4">New leads added this week</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.lead_growth_7d}>
              <defs>
                <linearGradient id="leadGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
              <Area type="monotone" dataKey="leads" stroke="#3B82F6" strokeWidth={2} fill="url(#leadGrowthFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-1">Pipeline</div>
          <p className="text-xs text-zinc-600 mb-4">Conversion funnel</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineFromStage(stats.by_stage)} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-4">Recent Leads</div>
          <div className="space-y-1">
            {stats.recent_leads.length === 0 && <p className="text-sm text-zinc-600">No leads yet.</p>}
            {stats.recent_leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 grid place-items-center text-xs font-medium shrink-0">
                    {l.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{l.name}</p>
                    <p className="text-xs text-zinc-600 truncate">{l.company || l.niche || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={TEMPERATURE_TONE[l.temperature]}>{TEMPERATURE_LABEL[l.temperature]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-4">Activity Feed</div>
          <div className="space-y-3">
            {stats.recent_activities.length === 0 && <p className="text-sm text-zinc-600">Nothing yet.</p>}
            {stats.recent_activities.map((a) => (
              <div key={a.id} className="border-l-2 border-white/10 pl-3">
                <p className="text-sm text-zinc-300">{a.content}</p>
                <p className="font-mono mt-0.5 text-xs text-zinc-600">{format(new Date(a.created_at), "MMM d, h:mma")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function pipelineFromStage(byStage) {
  return [
    { stage: "New", count: byStage.new || 0 },
    { stage: "Contacted", count: byStage.contacted || 0 },
    { stage: "Qualified", count: byStage.qualified || 0 },
    { stage: "Proposal", count: byStage.proposal || 0 },
    { stage: "Negotiation", count: byStage.negotiation || 0 },
    { stage: "Won", count: byStage.won || 0 },
  ];
}
