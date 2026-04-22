import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout({ children, allowed }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-zinc-950">
      <div className="text-zinc-500 text-sm font-mono">loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allowed && !allowed.includes(user.role)) return <Navigate to={`/${user.role}`} replace />;

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8 animate-fade-up">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ label, title, subtitle, children }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
      <div>
        {label && <div className="label-xs text-zinc-500 mb-2">{label}</div>}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-zinc-400 text-sm mt-1">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function MetricCard({ label, value, delta, tone = "default", mono = true }) {
  const toneCls =
    tone === "good" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-400" :
    tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30 card-hover">
      <div className="label-xs text-zinc-500 mb-3">{label}</div>
      <div className={`${mono ? "font-mono" : ""} text-3xl font-semibold ${toneCls}`}>{value}</div>
      {delta && <div className="text-xs text-zinc-500 mt-2">{delta}</div>}
    </div>
  );
}

export function toneFor(pct) {
  if (pct >= 90) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

export function Badge({ children, tone = "default", ...rest }) {
  const map = {
    default: "bg-zinc-800 text-zinc-300 border-white/10",
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    bad: "bg-red-500/10 text-red-400 border-red-500/20",
    admin: "bg-red-500/10 text-red-400 border-red-500/20",
    editor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    client: "bg-zinc-500/10 text-zinc-300 border-white/10",
  };
  return (
    <span {...rest} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[tone] || map.default}`}>
      {children}
    </span>
  );
}
