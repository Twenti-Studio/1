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
    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
    <div className="min-h-screen bg-gradient-to-br from-[#0c1330] to-[#0c1e3a] flex items-center justify-center p-4">
      <div className="bg-[#152052] border border-white/[0.08] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <Logo className="h-14 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#F5841F] to-[#ffb347] bg-clip-text text-transparent">
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F5841F] to-[#d9721a] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#F5841F]/25 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
