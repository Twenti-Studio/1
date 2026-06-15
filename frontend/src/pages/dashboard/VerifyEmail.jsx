import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { useUserAuth } from "../../context/UserAuthContext";

const OCCUPATIONS = [
  "Mahasiswa/Pelajar",
  "Karyawan Swasta",
  "PNS/ASN",
  "Wiraswasta/Pebisnis",
  "Freelancer",
  "Ibu Rumah Tangga",
  "Lainnya",
];

const inputCls =
  "w-full px-3 py-2.5 bg-ink border border-ledger-line rounded-lg text-sm text-cream placeholder-fog/40 focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { verifyEmail, submitOnboarding } = useUserAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("verifying"); // verifying | onboarding | error
  const [error, setError] = useState("");
  const ran = useRef(false);

  // onboarding form state
  const [fullName, setFullName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [fixedIncome, setFixedIncome] = useState("");
  const [dependents, setDependents] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ran.current) return; // guard against double-run (StrictMode)
    ran.current = true;
    (async () => {
      if (!token) {
        setError("Tautan tidak lengkap. Buka tautan dari email kamu.");
        setPhase("error");
        return;
      }
      const res = await verifyEmail(token);
      if (!res.success) {
        setError(res.error);
        setPhase("error");
        return;
      }
      if (res.user?.needs_onboarding) {
        setFullName(res.user.display_name || "");
        setPhase("onboarding");
      } else {
        navigate("/chat", { replace: true });
      }
    })();
  }, [token, verifyEmail, navigate]);

  async function handleOnboarding(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !occupation) {
      setError("Nama lengkap dan pekerjaan wajib diisi.");
      return;
    }
    setSaving(true);
    const res = await submitOnboarding({
      full_name: fullName.trim(),
      occupation,
      fixed_income: parseInt(fixedIncome || "0", 10) || 0,
      monthly_dependents: parseInt(dependents || "0", 10) || 0,
    });
    setSaving(false);
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
          {phase === "verifying" && (
            <div className="text-center py-6">
              <div className="w-8 h-8 mx-auto border-2 border-moss/30 border-t-moss rounded-full animate-spin" />
              <p className="text-sm text-fog mt-4">Memverifikasi email kamu…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-debit/10 flex items-center justify-center mb-4">
                <ExclamationTriangleIcon className="w-7 h-7 text-debit" />
              </div>
              <h1 className="text-lg font-display font-semibold text-cream">Tautan bermasalah</h1>
              <p className="text-sm text-fog mt-2">{error}</p>
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-orange text-white text-sm font-semibold hover:bg-orange-dark transition-colors"
              >
                Daftar ulang
              </a>
            </div>
          )}

          {phase === "onboarding" && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-credit/10 flex items-center justify-center mb-3">
                  <CheckCircleIcon className="w-6 h-6 text-credit" />
                </div>
                <span className="font-mono text-[0.6rem] tracking-[0.22em] uppercase text-fog">Email terverifikasi</span>
                <h1 className="text-xl font-display font-semibold text-cream mt-2">Lengkapi data diri</h1>
                <p className="text-sm text-fog mt-1">
                  Sedikit info untuk personalisasi insight keuanganmu.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-debit/10 border border-debit/30 rounded-lg text-sm text-debit text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleOnboarding} className="space-y-4">
                <div>
                  <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Nama lengkap</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Nama lengkapmu" required autoFocus />
                </div>
                <div>
                  <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Pekerjaan</label>
                  <select value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputCls} required>
                    <option value="" disabled>Pilih pekerjaan</option>
                    {OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Pemasukan tetap / bulan (Rp)</label>
                  <input type="number" min="0" inputMode="numeric" value={fixedIncome} onChange={(e) => setFixedIncome(e.target.value)} className={inputCls} placeholder="contoh: 3000000" />
                </div>
                <div>
                  <label className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-fog mb-1.5">Jumlah tanggungan</label>
                  <input type="number" min="0" inputMode="numeric" value={dependents} onChange={(e) => setDependents(e.target.value)} className={inputCls} placeholder="contoh: 0" />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {saving ? "Menyimpan…" : "Selesai & mulai pakai"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-4">
          <a href="/" className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-fog/70 hover:text-cream transition-colors">
            <ArrowLeftIcon className="w-3.5 h-3.5" /> Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
