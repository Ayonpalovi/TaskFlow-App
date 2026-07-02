import { useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../../components/Layout";

const STORE_KEY = "motionholic_os_referrals_v1";
const STATUSES = ["Pending", "Converted", "Rewarded"];

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(referrals) {
  localStorage.setItem(STORE_KEY, JSON.stringify(referrals));
}

const emptyForm = { referrer: "", referred_client: "", value: "", reward: "" };

export default function ReferralTracker() {
  const [referrals, setReferrals] = useState(loadStore);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const update = (next) => {
    setReferrals(next);
    saveStore(next);
  };

  const addReferral = () => {
    if (!form.referrer.trim() || !form.referred_client.trim()) return;
    const referral = { id: `ref_${Date.now()}`, ...form, value: Number(form.value || 0), status: "Pending", created_at: new Date().toISOString() };
    update([referral, ...referrals]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const setStatus = (id, status) => {
    update(referrals.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const removeReferral = (id) => {
    update(referrals.filter((r) => r.id !== id));
  };

  const leaderboard = useMemo(() => {
    const byReferrer = {};
    referrals.forEach((r) => {
      const key = r.referrer.trim();
      if (!byReferrer[key]) byReferrer[key] = { referrer: key, count: 0, converted: 0, value: 0 };
      byReferrer[key].count += 1;
      if (r.status !== "Pending") byReferrer[key].converted += 1;
      if (r.status === "Converted" || r.status === "Rewarded") byReferrer[key].value += Number(r.value || 0);
    });
    return Object.values(byReferrer).sort((a, b) => b.value - a.value || b.converted - a.converted);
  }, [referrals]);

  const totals = useMemo(() => {
    const converted = referrals.filter((r) => r.status !== "Pending");
    const value = converted.reduce((s, r) => s + Number(r.value || 0), 0);
    const pendingRewards = referrals.filter((r) => r.status === "Converted").length;
    return { total: referrals.length, converted: converted.length, value, pendingRewards };
  }, [referrals]);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Referrals" title="Referral Tracker" subtitle="Log who's sending clients your way, track conversions, and see who's earned a reward.">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90">
          {showForm ? "Cancel" : "+ Log referral"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Referrals" value={totals.total} />
        <MetricCard label="Converted" value={totals.converted} tone="good" />
        <MetricCard label="Revenue from Referrals" value={`€${totals.value.toLocaleString()}`} tone="blue" />
        <MetricCard label="Rewards Owed" value={totals.pendingRewards} tone="warn" />
      </div>

      {showForm && (
        <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input className="input-field" placeholder="Referrer name" value={form.referrer} onChange={(e) => setForm({ ...form, referrer: e.target.value })} />
            <input className="input-field" placeholder="Referred client" value={form.referred_client} onChange={(e) => setForm({ ...form, referred_client: e.target.value })} />
            <input className="input-field" type="number" placeholder="Project value (€)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <input className="input-field" placeholder="Reward (e.g. 10% cash)" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
          </div>
          <button type="button" onClick={addReferral} className="mt-3 px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Log referral</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-white/10 rounded-md bg-zinc-900/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Referrer</th>
                <th className="text-left p-3">Referred</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Reward</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-3">{r.referrer}</td>
                  <td className="p-3 text-zinc-400">{r.referred_client}</td>
                  <td className="p-3 font-mono">€{Number(r.value || 0).toLocaleString()}</td>
                  <td className="p-3 text-zinc-400">{r.reward || "—"}</td>
                  <td className="p-3">
                    <select className="text-xs bg-zinc-950 border border-white/10 rounded-md px-1.5 py-1" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3"><button type="button" onClick={() => removeReferral(r.id)} className="text-xs text-zinc-600 hover:text-red-400">Delete</button></td>
                </tr>
              ))}
              {referrals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-zinc-600 text-sm">No referrals logged yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="border border-white/10 rounded-md bg-zinc-900/20 p-4">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-500 mb-3">Leaderboard</div>
          <div className="flex flex-col gap-2">
            {leaderboard.map((l, i) => (
              <div key={l.referrer} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-zinc-500 w-4">{i + 1}</span>
                  <span className="truncate">{l.referrer}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={i === 0 ? "good" : "default"}>{l.converted}/{l.count}</Badge>
                  <span className="font-mono text-xs text-zinc-400">€{l.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && <div className="text-xs text-zinc-600">No data yet.</div>}
          </div>
        </div>
      </div>

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }`}</style>
    </Layout>
  );
}
