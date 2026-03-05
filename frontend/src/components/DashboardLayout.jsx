import {
  ArrowRightStartOnRectangleIcon,
  CalculatorIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import Logo from "./Logo";

// Main nav items (shown in bottom bar + desktop nav)
const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, end: true },
  { to: "/dashboard/cashflow", label: "Cashflow", icon: ChartBarIcon },
  { to: "/dashboard/simulasi", label: "Simulasi", icon: CalculatorIcon },
  { to: "/dashboard/transaksi", label: "Transaksi", icon: ClipboardDocumentListIcon },
];

// Profile menu items (shown in dropdown)
const PROFILE_MENU = [
  { to: "/dashboard/langganan", label: "Langganan", icon: CreditCardIcon },
  { to: "/dashboard/report", label: "Report", icon: ExclamationTriangleIcon },
  { to: "/dashboard/settings", label: "Pengaturan", icon: Cog6ToothIcon },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout, checkAuth } = useUserAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const mobileProfileRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Close profile dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      const isInside =
        (profileRef.current && profileRef.current.contains(e.target)) ||
        (mobileProfileRef.current && mobileProfileRef.current.contains(e.target));
      if (!isInside) setProfileOpen(false);
    }
    if (profileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  // First-login welcome banner
  useEffect(() => {
    if (user && !localStorage.getItem(`welcomed_${user.id}`)) {
      setShowWelcome(true);
    }
  }, [user]);

  function dismissWelcome() {
    if (user) localStorage.setItem(`welcomed_${user.id}`, "1");
    setShowWelcome(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Gate: only pro/elite can access dashboard
  if (user.plan === "free") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <Logo className="h-12 w-auto mx-auto" />
          <h1 className="text-2xl font-bold text-white">Akses Terbatas</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Dashboard hanya tersedia untuk pengguna <span className="text-orange font-semibold">Pro</span> dan{" "}
            <span className="text-orange font-semibold">Elite</span>. Upgrade sekarang untuk mengakses semua fitur analisis keuangan.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/pricing"
              className="px-6 py-3 bg-orange text-white font-semibold rounded-xl hover:bg-orange-dark transition-colors"
            >
              Lihat Paket Harga
            </a>
            <button
              onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
              className="text-sm text-white/40 hover:text-white transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avatarInitial = (user.display_name || user.username || "U").charAt(0).toUpperCase();
  const displayName = user.display_name || user.username || "User";
  const planLabel = user.plan || "free";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Desktop Top Navbar */}
      <header className="hidden md:flex fixed top-0 inset-x-0 z-50 h-14 bg-navy-dark/95 backdrop-blur-md border-b border-border items-center px-6">
        <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
          <Logo className="h-7 w-auto" />
          <span className="text-base font-bold text-white">FiNot</span>
          <span className="ml-1 px-2 py-0.5 bg-orange text-white text-[0.6rem] font-bold rounded-md uppercase">
            {planLabel}
          </span>
        </NavLink>

        <nav className="flex items-center gap-0.5 ml-6">
          {NAV_ITEMS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop Profile Dropdown */}
        <div className="ml-auto relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-orange/80 flex items-center justify-center text-[0.65rem] font-bold">
              {avatarInitial}
            </div>
            <span className="text-sm text-white/80">{displayName}</span>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-white/40 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-navy-dark border border-border rounded-xl shadow-xl shadow-black/30 overflow-hidden animate-fade-in-up z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-white/40 capitalize">{planLabel} Plan</p>
              </div>
              {PROFILE_MENU.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  onClick={() => setProfileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </NavLink>
              ))}
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-border"
              >
                <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-13 bg-navy-dark/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <Logo className="h-7 w-auto" />
          <span className="text-base font-bold text-white">FiNot</span>
        </NavLink>
        <div className="relative" ref={mobileProfileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-1.5"
          >
            <span className="px-2 py-0.5 bg-orange text-white text-[0.55rem] font-bold rounded-md uppercase">
              {planLabel}
            </span>
            <div className="w-7 h-7 rounded-full bg-orange/80 flex items-center justify-center text-xs font-bold">
              {avatarInitial}
            </div>
            <ChevronDownIcon className={`w-3 h-3 text-white/40 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-navy-dark border border-border rounded-xl shadow-xl shadow-black/30 overflow-hidden animate-fade-in-up z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-white/40 capitalize">{planLabel} Plan</p>
              </div>
              {PROFILE_MENU.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  onClick={() => setProfileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </NavLink>
              ))}
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-border"
              >
                <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Welcome Banner (first login) */}
      {showWelcome && (
        <div className="fixed top-14 md:top-14 inset-x-0 z-40 bg-orange/90 text-white px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm">
              Selamat datang! Segera ubah <strong>username</strong> dan <strong>password</strong> kamu di{" "}
              <NavLink to="/dashboard/settings" className="underline font-semibold" onClick={dismissWelcome}>
                Pengaturan
              </NavLink>.
            </p>
            <button onClick={dismissWelcome} className="shrink-0 p-1 hover:bg-white/20 rounded">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`md:pt-14 pt-13 pb-20 md:pb-6 ${showWelcome ? "mt-12" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-navy-dark/95 backdrop-blur-md border-t border-border safe-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {NAV_ITEMS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-14 ${isActive ? "text-orange" : "text-white/30"
                }`
              }
            >
              <n.icon className="w-5 h-5" />
              <span className="text-[0.55rem] font-medium">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}