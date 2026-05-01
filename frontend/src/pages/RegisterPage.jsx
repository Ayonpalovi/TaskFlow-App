import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";

export default function RegisterPage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm_password: "", code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role) return <Navigate to={`/${user.role}`} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { data } = await api.post("/auth/register", f);
      if (data.token) localStorage.setItem("taskflow_token", data.token);
      setUser(data.user);
      nav(`/${data.user.role}`);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Registration failed");
    } finally { setBusy(false); }
  };

  const inp = "w-full bg-zinc-900 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-950">
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
          <div className="space-y-4 max-w-lg">
            <div className="label-xs text-zinc-400">Editor onboarding</div>
            <h1 className="text-5xl font-bold leading-tight">Join the <span className="text-zinc-400">collective</span>.</h1>
            <p className="text-zinc-400 text-lg">Anonymous identity. Verified output. XP, badges, levels — and a real paycheck.</p>
            <div className="flex gap-6 pt-4 text-sm">
              <div><div className="font-mono text-2xl">+10 XP</div><div className="text-zinc-500 label-xs">Per delivery</div></div>
              <div><div className="font-mono text-2xl">+5 XP</div><div className="text-zinc-500 label-xs">On-time bonus</div></div>
              <div><div className="font-mono text-2xl">4</div><div className="text-zinc-500 label-xs">Levels</div></div>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">Access by invite code only.</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="label-xs text-zinc-500 mb-2">Create account</div>
          <h2 className="text-3xl font-semibold mb-2">Sign up as editor</h2>
          <p className="text-zinc-400 mb-8 text-sm">You need a valid access code to register.</p>

          <form onSubmit={submit} className="space-y-4" data-testid="register-form">
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Name</label>
              <input data-testid="register-name" required className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Email</label>
              <input data-testid="register-email" type="email" required className={inp} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Password</label>
              <input data-testid="register-password" type="password" required className={inp} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
            </div>
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Confirm password</label>
              <input data-testid="register-confirm" type="password" required className={inp} value={f.confirm_password} onChange={e => setF({ ...f, confirm_password: e.target.value })} />
            </div>
            <div>
              <label className="label-xs text-zinc-400 block mb-2">Write the code</label>
              <input data-testid="register-code" required className={inp} placeholder="Access code" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} />
            </div>
            {err && <div data-testid="register-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">{err}</div>}
            <button data-testid="register-submit" type="submit" disabled={busy} className="w-full bg-white text-black font-medium py-3 rounded-md hover:bg-zinc-200 transition-all disabled:opacity-50">
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-sm text-zinc-400">
            Already have an account? <Link to="/login" data-testid="login-link" className="text-white hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
