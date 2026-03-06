import { ArrowTopRightOnSquareIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Logo from "./Logo";

const NAV = [
  { to: "/", label: "Beranda" },
  { to: "/features", label: "Fitur" },
  { to: "/how-it-works", label: "Cara Kerja" },
  { to: "/pricing", label: "Harga" },
  { to: "/faq", label: "FAQ" },
  // { to: "/about", label: "Tentang" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Navbar ─── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-navy-dark/90 backdrop-blur-md border-b border-border shadow-lg shadow-black/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <Logo className="h-9 w-auto" glow />
              <span className="text-xl font-bold text-white">
                FiNot
              </span>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `relative px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive ? "text-white" : "text-white/50 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {n.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-white/70" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <a
              href="https://t.me/finot_finance_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-orange to-orange-dark text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200"
            >
              Mulai Gratis <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ${
            mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-navy-dark/95 backdrop-blur-md border-t border-border px-4 pb-4 pt-2">
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <a
              href="https://t.me/finot_finance_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 rounded-lg bg-gradient-to-r from-orange to-orange-dark text-white text-sm font-semibold"
            >
              Mulai Gratis <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <Outlet />
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-navy-dark/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-auto" glow />
              <span className="font-bold text-white">
                FiNot
              </span>
            </div>
            <nav className="flex flex-wrap justify-center gap-4 text-sm text-white/40">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className="hover:text-white/70 transition-colors"
                >
                  {n.label}
                </NavLink>
              ))}
              <span className="text-white/15">|</span>
              <NavLink to="/legal/terms-of-service" className="hover:text-white/70 transition-colors">Terms of Service</NavLink>
              <NavLink to="/legal/privacy-policy" className="hover:text-white/70 transition-colors">Privacy Policy</NavLink>
            </nav>
            <p className="text-xs text-white/30">
              &copy; 2026 FiNot &mdash; Dikembangkan oleh{" "}
              <span className="text-white/50">Twenti Studio</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
