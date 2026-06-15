import { ArrowTopRightOnSquareIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSiteSettings } from "../context/SiteSettingsContext";
import Logo from "./Logo";

const NAV = [
  { to: "/", label: "Beranda" },
  { to: "/features", label: "Fitur" },
  { to: "/how-it-works", label: "Cara Kerja" },
  { to: "/pricing", label: "Harga" },
  { to: "/faq", label: "FAQ" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const siteSettings = useSiteSettings();
  const showTos = siteSettings?.legal_tos_enabled !== false;
  const showPP = siteSettings?.legal_privacy_enabled !== false;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-cream font-sans selection:bg-orange/30 selection:text-cream">
      {/* ─── Navbar ─── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-ink/85 backdrop-blur-md border-b border-ledger-line"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <Logo className="h-8 w-auto" glow />
              <span className="text-xl font-display font-semibold tracking-tight text-cream">
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
                      isActive ? "text-cream" : "text-fog hover:text-cream"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {n.label}
                      {isActive && (
                        <span className="absolute -bottom-0.5 left-3 right-3 h-px bg-credit" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <a
              href="/chat"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-sm font-semibold hover:bg-orange-dark hover:-translate-y-0.5 transition-all duration-200"
            >
              Mulai Gratis <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Buka menu"
              className="md:hidden text-fog hover:text-cream p-1.5 rounded-lg hover:bg-black/5 transition-colors"
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
          <div className="bg-ink-soft border-t border-ledger-line px-4 pb-4 pt-2">
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
                        ? "bg-black/5 text-cream"
                        : "text-fog hover:text-cream hover:bg-black/5"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <a
              href="/chat"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 rounded-lg bg-orange text-white text-sm font-semibold"
            >
              Mulai Gratis <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <Outlet />
      </main>

      {/* ─── Footer — closing ledger entry ─── */}
      <footer className="border-t border-ledger-line bg-ink-soft/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Logo className="h-7 w-auto" glow />
                <span className="font-display font-semibold text-lg text-cream">FiNot</span>
              </div>
              <p className="font-mono text-[0.7rem] text-fog max-w-xs leading-relaxed">
                Catat keuangan semudah ngobrol. Setiap chat jadi baris buku besar.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fog">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className="hover:text-cream transition-colors"
                >
                  {n.label}
                </NavLink>
              ))}
              {showTos && (
                <NavLink to="/legal/terms-of-service" className="hover:text-cream transition-colors">
                  Ketentuan Layanan
                </NavLink>
              )}
              {showPP && (
                <NavLink to="/legal/privacy-policy" className="hover:text-cream transition-colors">
                  Kebijakan Privasi
                </NavLink>
              )}
            </nav>
          </div>

          <div className="mt-8 pt-5 border-t border-ledger-line flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-mono text-[0.68rem] text-fog/70">
              © 2026 FiNot — dikembangkan oleh{" "}
              <span className="text-fog">Twenti Studio</span>
            </p>
            <p className="font-mono text-[0.68rem] text-fog/70 tnum">
              Saldo akhir: tenang terkendali
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
