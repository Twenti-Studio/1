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

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard", { replace: true });
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

          <div className="mt-6 text-center">
            <p className="text-xs text-white/30">
              Belum punya akun?{" "}
              <a href="/pricing" className="text-orange hover:underline">
                Berlangganan
              </a>{" "}
              untuk mendapat akses dashboard.
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-xs text-white/30 hover:text-white/50 transition-colors">
            &larr; Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
