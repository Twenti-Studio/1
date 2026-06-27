import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useUserAuth } from "../../context/UserAuthContext";

export default function UserLogin() {
  const { user, login, requestPasswordReset } = useUserAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  async function submitForgot(e) {
    e.preventDefault();
    setForgotMsg(null);
    const em = forgotEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setForgotMsg({ type: "err", text: "Masukkan email yang valid." });
      return;
    }
    setForgotBusy(true);
    const res = await requestPasswordReset(em);
    setForgotBusy(false);
    if (res.success) {
      setForgotMsg({ type: "ok", text: res.message });
    } else {
      setForgotMsg({ type: "err", text: res.error || "Gagal mengirim." });
    }
  }

  useEffect(() => {
    if (user) navigate("/chat", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate("/chat", { replace: true });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo className="h-10 w-auto" glow />
          <span className="text-2xl font-display font-semibold text-cream">FiNot</span>
        </div>

        <div className="bg-ink-soft border border-ledger-line rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className="font-mono text-[0.6rem] tracking-[0.22em] uppercase text-fog">Akun · Masuk</span>
            <h1 className="text-xl font-display font-semibold text-cream mt-2">Masuk ke buku besarmu</h1>
            <p className="text-sm text-fog mt-1">
              Lanjutkan mencatat dan lihat insight keuanganmu.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-debit/10 border border-debit/30 rounded-lg text-sm text-debit text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
                placeholder="Masukkan username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fog hover:text-cream"
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
            onClick={() => { setForgotOpen(true); setForgotEmail(""); setForgotMsg(null); }}
            className="mt-3 w-full text-center text-xs text-fog hover:text-credit transition-colors"
          >
            Lupa password?
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-fog">
              Belum punya akun?{" "}
              <a href="/register" className="text-credit hover:underline">
                Daftar gratis
              </a>{" "}
              atau{" "}
              <a href="/pricing" className="text-credit hover:underline">
                berlangganan
              </a>.
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-fog/70 hover:text-cream transition-colors">
            <ArrowLeftIcon className="w-3.5 h-3.5" /> Kembali ke Beranda
          </a>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="bg-ink-soft border border-moss/40 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-display font-semibold text-cream">Reset password</h2>
            <p className="text-xs text-fog mt-1 mb-4">
              Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.
            </p>

            {forgotMsg && (
              <div className={`mb-3 text-xs rounded-lg px-3 py-2 ${forgotMsg.type === "ok"
                ? "bg-credit/10 text-credit border border-credit/30"
                : "bg-debit/10 text-debit border border-debit/30"
                }`}>
                {forgotMsg.text}
              </div>
            )}

            <form onSubmit={submitForgot} className="space-y-3">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="kamu@email.com"
                autoFocus
                className="w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-2.5 border border-ledger-line text-fog text-sm font-semibold rounded-lg hover:bg-black/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={forgotBusy}
                  className="flex-1 py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark disabled:opacity-40"
                >
                  {forgotBusy ? "Mengirim..." : "Kirim tautan reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
