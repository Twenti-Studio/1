import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useUserAuth } from "../../context/UserAuthContext";

export default function Register() {
  const { user, register } = useUserAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/chat", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(u)) {
      setError("Username 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);
    const result = await register(u, password, name.trim());
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
            <span className="font-mono text-[0.6rem] tracking-[0.22em] uppercase text-fog">Akun · Daftar</span>
            <h1 className="text-xl font-display font-semibold text-cream mt-2">Buka buku besarmu</h1>
            <p className="text-sm text-fog mt-1">
              Buat akun gratis dan langsung mulai mencatat.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-debit/10 border border-debit/30 rounded-lg text-sm text-debit text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Nama (opsional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
                placeholder="Nama panggilanmu"
              />
            </div>

            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss"
                placeholder="username unik (huruf kecil)"
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
                  placeholder="Minimal 6 karakter"
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
              {loading ? "Membuat akun..." : "Daftar & Mulai"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-fog">
              Sudah punya akun?{" "}
              <a href="/login" className="text-credit hover:underline">
                Masuk
              </a>
            </p>
            <p className="text-[0.65rem] text-fog/70 mt-3">
              Mau pakai dari Telegram? Hubungkan dari Pengaturan setelah masuk.
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="font-mono text-[0.7rem] text-fog/70 hover:text-cream transition-colors">
            ← Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
