import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { formatApiError } from "../lib/api";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login(email, password);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Login failed");
    } finally { setBusy(false); }
  };

  const fillDemo = (role) => {
    const map = {
      admin: ["admin@taskflow.com", "admin123"],
      editor: ["editor1@taskflow.com", "editor123"],
      client: ["client1@taskflow.com", "client123"],
    };
    setEmail(map[role][0]); setPassword(map[role][1]);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-950">
      {/* Left hero */}
      <div className="hidden lg:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/31650443/pexels-photo-31650443.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')] bg-cover bg-center opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950/80 to-zinc-950/40" />
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-md grid place-items-center">
              <span className="font-mono text-black font-bold text-lg">TF</span>
            </div>
            <span className="font-semibold text-xl tracking-tight">TaskFlow</span>
          </div>
          <div className="space-y-6 max-w-lg">
            <div className="label-xs text-zinc-400">Agency OS / v1.0</div>
            <h1 className="text-5xl font-bold leading-tight">
              The operating system for <span className="text-zinc-400">video editing agencies</span>.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Dispatch briefs. Rank editors. Ship videos. Close the loop with clients — all in one command center.
            </p>
            <div className="flex gap-6 pt-4 text-sm">
              <div><div className="font-mono text-2xl">03</div><div className="text-zinc-500 label-xs">Roles</div></div>
              <div><div className="font-mono text-2xl">12h</div><div className="text-zinc-500 label-xs">Request Window</div></div>
              <div><div className="font-mono text-2xl">30d</div><div className="text-zinc-500 label-xs">Perf Window</div></div>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">© TaskFlow. <a href="/showcase" className="hover:text-white transition-all">Browse editor showcase →</a></div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="label-xs text-zinc-500 mb-2">Sign in</div>
          <h2 className="text-3xl font-semibold mb-2">Welcome back</h2>
          <p className="text-zinc-400 mb-8 text-sm">Enter your credentials to access the workspace.</p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Email</label>
              <input
                data-testid="login-email-input"
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Password</label>
              <input
                data-testid="login-password-input"
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
                placeholder="••••••••"
              />
            </div>
            {err && <div data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">{err}</div>}
            <button
              data-testid="login-submit-button"
              type="submit" disabled={busy}
              className="w-full bg-white text-black font-medium py-3 rounded-md hover:bg-zinc-200 transition-all disabled:opacity-50"
            >{busy ? "Signing in..." : "Sign in"}</button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="label-xs text-zinc-500 mb-3">Quick demo access</div>
            <div className="grid grid-cols-3 gap-2">
              <button data-testid="demo-admin-button" onClick={() => fillDemo("admin")} className="text-xs py-2 bg-zinc-900 border border-white/10 rounded-md hover:bg-zinc-800 transition-all">Admin</button>
              <button data-testid="demo-editor-button" onClick={() => fillDemo("editor")} className="text-xs py-2 bg-zinc-900 border border-white/10 rounded-md hover:bg-zinc-800 transition-all">Editor</button>
              <button data-testid="demo-client-button" onClick={() => fillDemo("client")} className="text-xs py-2 bg-zinc-900 border border-white/10 rounded-md hover:bg-zinc-800 transition-all">Client</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
