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
  const [showPassword, setShowPassword] = useState(false);

  if (user && user.role) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();

    setErr("");
    setBusy(true);

    try {
      await login(email, password);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2 overflow-hidden bg-[#05070f] text-white">
      {/* Animated mesh-gradient backdrop (pure CSS — no external image) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="auth-blob auth-blob--one" />
        <div className="auth-blob auth-blob--two" />
        <div className="auth-blob auth-blob--three" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,7,15,0.65)_100%)]" />
      </div>

      {/* Left hero */}
      <div className="hidden lg:flex relative">
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl grid place-items-center overflow-hidden ring-1 ring-white/10 bg-white/5 backdrop-blur">
              <img
                src="/motionholic-logo.png"
                alt="Motionholic OS"
                className="w-9 h-9 object-contain"
              />
            </div>

            <span className="font-semibold text-xl tracking-tight">
              Motionholic OS
            </span>
          </div>

          <div className="space-y-7 max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="label-xs text-zinc-300">Creative Agency OS / v1.0</span>
            </div>

            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight">
              The operating system for{" "}
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                video editing agencies
              </span>
              .
            </h1>

            <p className="text-zinc-400 text-lg leading-relaxed">
              Dispatch briefs. Manage editors. Track projects. Deliver videos.
              Keep your whole agency workflow in one command center.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
              {[
                { v: "03", k: "Roles" },
                { v: "12h", k: "Request Window" },
                { v: "30d", k: "Performance View" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur"
                >
                  <div className="font-mono text-2xl text-white">{s.v}</div>
                  <div className="text-zinc-500 label-xs mt-1">{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            © Motionholic OS.{" "}
            <a href="/showcase" className="text-zinc-400 hover:text-white transition-colors">
              Browse editor showcase →
            </a>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="relative z-10 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-9 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-7">
            <img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-lg tracking-tight">Motionholic OS</span>
          </div>

          <div className="label-xs text-blue-400 mb-2">Sign in</div>

          <h2 className="text-3xl font-semibold mb-2 tracking-tight">Welcome back</h2>

          <p className="text-zinc-400 mb-8 text-sm">
            Enter your credentials to access the workspace.
          </p>

          <form
            onSubmit={onSubmit}
            className="space-y-4"
            data-testid="login-form"
          >
            <div>
              <label className="label-xs text-zinc-400 block mb-2">
                Email
              </label>

              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50"
                placeholder="you@agency.com"
              />
            </div>

            <div>
              <label className="label-xs text-zinc-400 block mb-2">
                Password
              </label>

              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {err && (
              <div
                data-testid="login-error"
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl"
              >
                {err}
              </div>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={busy}
              className="group relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0051FF 0%, #2D71FF 100%)",
                boxShadow: "0 14px 34px rgba(0,81,255,0.30), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              <span className="relative z-10">
                {busy ? "Signing in…" : "Sign in"}
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </form>

          <div className="mt-6 text-sm text-zinc-400 text-center">
            Need an account? Contact the admin to create one for you.
          </div>
        </div>
      </div>
    </div>
  );
}
