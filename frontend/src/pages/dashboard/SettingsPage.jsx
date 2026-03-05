import { ArrowRightStartOnRectangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../../context/UserAuthContext";

export default function SettingsPage() {
  const { user, checkAuth, logout } = useUserAuth();
  const navigate = useNavigate();

  // Profile form
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [webLogin, setWebLogin] = useState(user?.username || "");
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [pwLoading, setPwLoading] = useState(false);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMsg({ type: "", text: "" });
    setProfileLoading(true);
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ display_name: displayName, web_login: webLogin }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg({ type: "success", text: "Profil berhasil diperbarui." });
        checkAuth(); // refresh user data in context
      } else {
        setProfileMsg({ type: "error", text: data.detail || "Gagal memperbarui profil." });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });

    if (newPw.length < 6) {
      setPwMsg({ type: "error", text: "Password baru minimal 6 karakter." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: "success", text: "Password berhasil diubah." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setPwMsg({ type: "error", text: data.detail || "Gagal mengubah password." });
      }
    } catch {
      setPwMsg({ type: "error", text: "Gagal menghubungi server." });
    } finally {
      setPwLoading(false);
    }
  }

  function Msg({ msg }) {
    if (!msg.text) return null;
    const cls =
      msg.type === "success"
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-rose-500/10 border-rose-500/20 text-rose-400";
    return <div className={`p-3 rounded-lg border text-sm ${cls}`}>{msg.text}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pengaturan</h1>
        <p className="text-sm text-white/40 mt-1">Kelola profil dan keamanan akunmu</p>
      </div>

      {/* Profile section */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold mb-4">Profil</h2>
        <Msg msg={profileMsg} />
        <form onSubmit={handleProfileSave} className="space-y-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Nama Tampilan</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
              placeholder="Nama kamu"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Username Login</label>
            <input
              type="text"
              value={webLogin}
              onChange={(e) => setWebLogin(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
              placeholder="username"
            />
            <p className="text-[0.65rem] text-white/30 mt-1">Username ini digunakan untuk login ke dashboard</p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileLoading}
              className="px-5 py-2 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50"
            >
              {profileLoading ? "Menyimpan..." : "Simpan Profil"}
            </button>
          </div>
        </form>
      </div>

      {/* Password section */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold mb-4">Ganti Password</h2>
        <Msg msg={pwMsg} />
        <form onSubmit={handlePasswordChange} className="space-y-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Password Saat Ini</label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
                placeholder="Password lama"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showCurrentPw ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Password Baru</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
                placeholder="Minimal 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showNewPw ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50"
              placeholder="Ulangi password baru"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwLoading}
              className="px-5 py-2 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50"
            >
              {pwLoading ? "Mengubah..." : "Ganti Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold mb-3">Informasi Akun</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-white/40">Plan</span>
            <span className="font-semibold capitalize">{user?.plan || "free"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-white/40">Username</span>
            <span className="font-mono text-white/70">{user?.username || "-"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-white/40">Nama</span>
            <span className="text-white/70">{user?.display_name || "-"}</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-semibold rounded-2xl hover:bg-red-500/20 transition-colors"
      >
        <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
        Keluar dari Akun
      </button>
    </div>
  );
}
