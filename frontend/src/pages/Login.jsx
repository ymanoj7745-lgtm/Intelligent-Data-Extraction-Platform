import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fmtErr } from "@/lib/api";
import { Building2, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("bhardwaj@getsetai.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e2) {
      setErr(fmtErr(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">
      {/* Left panel — brand + copy */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border bg-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{backgroundImage:'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize:'24px 24px'}} />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-black flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">GetSet AI</div>
              <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mt-1">Companies Extractor</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-display text-5xl xl:text-6xl font-bold tracking-tighter leading-[0.95] text-slate-950">
            UK company data.<br/>
            <span className="bg-[#FACC15] text-black px-2 -mx-2 inline-block">No-website</span> finder built in.
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed max-w-md">
            Extract Companies House records region-by-region, enrich with contact data,
            and surface UK businesses without a public web presence — the ones your team wants first.
          </p>
        </div>
        <div className="relative z-10 text-[0.7rem] uppercase tracking-[0.15em] text-slate-400">
          Internal tool · Self-hosted · v0.1
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <form onSubmit={submit} className="w-full max-w-sm bg-white border border-border p-8" data-testid="login-form">
          <div className="mb-8">
            <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Sign in</div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-2">Use your team email + password</p>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Email</label>
          <input
            data-testid="login-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border px-3 py-2 rounded-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
            required
          />
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Password</label>
          <input
            data-testid="login-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border px-3 py-2 rounded-sm mb-6 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
            required
          />
          {err && (
            <div data-testid="login-error" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
              {err}
            </div>
          )}
          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-sm text-sm hover:bg-slate-800 transition-colors duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in →"}
          </button>
          <div className="mt-6 text-[0.7rem] uppercase tracking-[0.15em] text-slate-400 text-center">
            Access managed by admin
          </div>
        </form>
      </div>
    </div>
  );
}
