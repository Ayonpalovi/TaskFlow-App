import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "@/lib/api";
import Layout, { PageHeader, MetricCard } from "@/components/Layout";

const tooltipStyle = { background: "#09090B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 };
const INDUSTRY_COLORS = ["#6366f1", "#a855f7", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f97316", "#ef4444"];

export default function GrowthAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/growth/analytics/overview").then((res) => setData(res.data));
  }, []);

  if (!data) {
    return (
      <Layout>
        <div className="text-sm text-zinc-500 font-mono">loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader label="Insights" title="Analytics" subtitle="Insights across your lead pipeline." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <MetricCard label="Total Leads" value={data.total_leads} />
        <MetricCard label="Hot Leads" value={data.hot_count} tone={data.hot_count > 0 ? "bad" : "default"} />
        <MetricCard label="Warm Leads" value={data.warm_count} tone="warn" />
        <MetricCard label="Cold Leads" value={data.cold_count} tone="blue" />
        <MetricCard label="Messages" value={data.messages_count} />
        <MetricCard label="Won Deals" value={data.won_count} tone="good" />
      </div>

      <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5 mt-4">
        <div className="label-xs text-zinc-500 mb-1">Growth Overview (12 months)</div>
        <p className="text-xs text-zinc-600 mb-4">Leads added and messages generated per month</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.growth_12mo}>
            <defs>
              <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="messagesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }} />
            <Area type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" strokeWidth={2} fill="url(#leadsFill)" />
            <Area type="monotone" dataKey="messages" name="Messages" stroke="#10b981" strokeWidth={2} fill="url(#messagesFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mt-4">
        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-1">Pipeline Funnel</div>
          <p className="text-xs text-zinc-600 mb-4">Leads per stage</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.pipeline_funnel} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-1">Lead Temperature</div>
          <p className="text-xs text-zinc-600 mb-4">Hot, warm, cold distribution</p>
          {data.temperature_distribution.length === 0 ? (
            <p className="text-sm text-zinc-600 py-16 text-center">No leads scored yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.temperature_distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {data.temperature_distribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="label-xs text-zinc-500 mb-1">Top Industries</div>
          <p className="text-xs text-zinc-600 mb-4">Most common lead industries</p>
          <div className="space-y-2">
            {data.top_industries.length === 0 && <p className="text-sm text-zinc-600">No industries tagged yet.</p>}
            {data.top_industries.map((row, i) => (
              <div key={row.industry} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length] }} />
                  <span className="text-sm text-zinc-300 truncate">{row.industry}</span>
                </div>
                <span className="font-mono text-xs text-zinc-500 rounded-full border border-white/10 px-2 py-0.5">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5 mt-4">
        <div className="label-xs text-zinc-500 mb-1">Message Types Generated</div>
        <p className="text-xs text-zinc-600 mb-4">Breakdown of outreach message types</p>
        {data.message_types.length === 0 ? (
          <p className="text-sm text-zinc-600 py-10 text-center">No messages logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.message_types}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="type" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Layout>
  );
}
