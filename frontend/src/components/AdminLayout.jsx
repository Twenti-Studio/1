import { ArrowPathIcon, ArrowRightStartOnRectangleIcon, Bars3Icon, FlagIcon, Squares2X2Icon, TicketIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "./Logo";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: Squares2X2Icon },
  { to: "/admin/vouchers", label: "Vouchers", icon: TicketIcon },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/reports", label: "Reports", icon: FlagIcon },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/admin/api/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => {
        setAdmin(d.admin);
        setLoading(false);
      })
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch("/admin/api/logout");
    navigate("/admin/login");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-auto" />
              <span className="text-base font-bold text-gray-900 hidden sm:inline">FiNot</span>
              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[0.55rem] font-bold rounded uppercase">
                Admin
              </span>
            </div>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {ADMIN_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    }`
                  }
                >
                  <n.icon className="w-4 h-4" /> {n.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" /> Refresh
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200 ml-2">
              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-xs font-bold text-white">
                {admin?.[0]?.toUpperCase() || "A"}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden lg:inline">{admin}</span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition-colors"
                title="Keluar"
              >
                <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white pb-3">
            <nav className="px-4 pt-2 space-y-1">
              {ADMIN_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                    }`
                  }
                >
                  <n.icon className="w-4 h-4" /> {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 pt-3 mt-2 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-xs font-bold text-white">
                  {admin?.[0]?.toUpperCase() || "A"}
                </div>
                <span className="text-sm font-medium text-gray-700">{admin}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <ArrowRightStartOnRectangleIcon className="w-4 h-4" /> Keluar
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
