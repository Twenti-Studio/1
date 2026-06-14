import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useUserAuth } from "../../context/UserAuthContext";

export default function UserLogin() {
  const { user, login } = useUserAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  async function submitForgot(e) {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotUser.trim()) {
      setForgotMsg({ type: "err", text: "Isi username dulu." });
      return;
    }
    setForgotBusy(true);
    try {
      const r = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUser.trim() }),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setForgotMsg({ type: "ok", text: data.message });
      } else {
        setForgotMsg({ type: "err", text: data.error || "Gagal mengirim." });
      }
    } catch {
      setForgotMsg({ type: "err", text: "Tidak bisa terhubung ke server." });
    } finally {
      setForgotBusy(false);
    }
  }

  useEffect(() => {
    if (user) navigate(user.plan === "free" ? "/chat" : "/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      const target = result.user?.plan === "free" ? "/chat" : "/dashboard";
      navigate(target, { replace: true });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo className="h-10 w-auto" />
          <span className="text-2xl font-bold text-white">FiNot</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white">Masuk</h1>
            <p className="text-sm text-white/40 mt-1">
              Masuk untuk melihat dashboard keuanganmu
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
                placeholder="Masukkan username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPw ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setForgotOpen(true); setForgotUser(username); setForgotMsg(null); }}
            className="mt-3 w-full text-center text-xs text-white/50 hover:text-orange transition-colors"
          >
            Lupa password?
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-white/30">
              Belum punya akun?{" "}
              <a href="/chat" className="text-orange hover:underline">
                Mulai gratis
              </a>{" "}
              atau{" "}
              <a href="/pricing" className="text-orange hover:underline">
                berlangganan
              </a>.
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-xs text-white/30 hover:text-white/50 transition-colors">
            &larr; Kembali ke Beranda
          </a>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Reset Password</h2>
            <p className="text-xs text-white/50 mt-1 mb-4">
              Masukkan username kamu. Password baru akan dikirim ke Telegram (chat dari @finot_finance_bot).
            </p>

            {forgotMsg && (
              <div className={`mb-3 text-xs rounded-lg px-3 py-2 ${forgotMsg.type === "ok"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                }`}>
                {forgotMsg.text}
              </div>
            )}

            <form onSubmit={submitForgot} className="space-y-3">
              <input
                value={forgotUser}
                onChange={(e) => setForgotUser(e.target.value)}
                placeholder="Username"
                autoFocus
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-2.5 border border-border text-white/70 text-sm font-semibold rounded-lg hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={forgotBusy}
                  className="flex-1 py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark disabled:opacity-40"
                >
                  {forgotBusy ? "Mengirim..." : "Kirim Password Baru"}
                </button>
              </div>
            </form>

            <p className="text-[0.65rem] text-white/30 mt-4 text-center">
              Belum bisa terima Telegram? Buka @finot_finance_bot, ketik <code className="text-white/60">/resetweb</code> langsung di chat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
