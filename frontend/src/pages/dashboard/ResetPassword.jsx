import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { useUserAuth } from "../../context/UserAuthContext";

const inputCls =
  "w-full px-3 py-2.5 pr-10 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { resetPassword } = useUserAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Tautan tidak lengkap. Buka tautan dari email kamu.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);
    const res = await resetPassword(token, password);
    setLoading(false);
    if (res.success) navigate("/chat", { replace: true });
    else setError(res.error);
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
            <span className="font-mono text-[0.6rem] tracking-[0.22em] uppercase text-fog">Akun · Reset</span>
            <h1 className="text-xl font-display font-semibold text-cream mt-2">Buat password baru</h1>
            <p className="text-sm text-fog mt-1">Masukkan password baru untuk akunmu.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-debit/10 border border-debit/30 rounded-lg text-sm text-debit text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Password baru</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Minimal 6 karakter"
                  required
                  autoFocus
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

            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Konfirmasi password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
                placeholder="Ulangi password baru"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {loading ? "Menyimpan…" : "Simpan & masuk"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <a href="/login" className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-fog/70 hover:text-cream transition-colors">
            <ArrowLeftIcon className="w-3.5 h-3.5" /> Kembali ke Masuk
          </a>
        </div>
      </div>
    </div>
  );
}
