import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const BLUE = "#0051FF";

export default function AcceptInvitePage() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const inviteToken = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/accept-invite", {
        token: inviteToken,
        password,
        confirm_password: confirmPassword,
      });
      if (data?.token) localStorage.setItem("taskflow_token", data.token);
      if (data?.user) setUser(data.user);
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-6">
      <div className="w-full max-w-md border border-white/10 rounded-3xl bg-zinc-900/40 p-7 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3 mb-8">
          <img src="/motionholic-logo.png" alt="Motionholic OS" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-sm font-semibold">Motionholic OS</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.25em]">Account setup</div>
          </div>
        </div>

        <div className="label-xs text-zinc-500 mb-2">Secure invite</div>
        <h1 className="text-3xl font-semibold tracking-tight">Set up your account</h1>
        <p className="text-sm text-zinc-400 mt-2 mb-6">Create your password to activate your Motionholic OS workspace access.</p>

        {!inviteToken && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-xl px-4 py-3 text-sm">Missing invite token. Please use the full invite link.</div>}
        {err && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-xl px-4 py-3 text-sm">{err}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label-xs text-zinc-400 block mb-2">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Create a password"
            />
          </div>

          <div>
            <label className="label-xs text-zinc-400 block mb-2">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Repeat password"
            />
          </div>

          <button type="submit" disabled={busy || !inviteToken} className="w-full text-white font-medium py-3 rounded-xl disabled:opacity-50 shadow-[0_0_28px_rgba(0,81,255,.22)]" style={{ background: BLUE }}>
            {busy ? "Activating…" : "Activate Account"}
          </button>
        </form>

        <div className="mt-6 text-xs text-zinc-600 leading-relaxed">After activation, you’ll be redirected to your correct dashboard automatically.</div>
      </div>
    </div>
  );
}
