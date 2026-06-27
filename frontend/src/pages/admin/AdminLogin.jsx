import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";

const Spinner = ({ className = "w-4 h-4" }) => (
  <div className={`${className} border-2 border-white/30 border-t-white rounded-full animate-spin`} />
);

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Read the live field values (covers browser autofill that fills the DOM
    // but doesn't fire React onChange), falling back to state.
    const form = e.currentTarget;
    const u = (form.username?.value ?? username).trim();
    const p = (form.password?.value ?? password).trim();
    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (data.success) navigate("/admin/dashboard");
      else setError(data.error || "Login gagal");
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08152b] flex items-center justify-center p-4">
      <div className="bg-[#152052] border border-white/[0.08] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <Logo className="h-14 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-[#F5841F]">
            FiNot Admin
          </h1>
          <p className="text-sm text-white/40 mt-1">Masuk untuk mengelola FiNot</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-red-400">
            <ExclamationCircleIcon className="w-4 h-4" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1.5 font-medium">Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin"
              className="w-full px-4 py-3 bg-[#0c1330] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#F5841F] focus:ring-2 focus:ring-[#F5841F]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1.5 font-medium">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#0c1330] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#F5841F] focus:ring-2 focus:ring-[#F5841F]/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#F5841F] hover:bg-[#d9721a] text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner /> Masuk...
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>
        <p className="text-center text-[0.7rem] text-white/25 mt-6">
          Dikembangkan oleh Twenti Studio
        </p>
      </div>
    </div>
  );
}
