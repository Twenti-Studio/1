import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, MinusIcon, QrCodeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useSiteSettings } from "../context/SiteSettingsContext";

const Spinner = ({ className = "w-4 h-4" }) => (
  <div className={`${className} border-2 border-white/30 border-t-white rounded-full animate-spin`} />
);

/* ─── Helpers ─────────────────────────────────────────── */
function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.22em] uppercase text-fog">
      <span className="h-px w-6 bg-moss" />
      {children}
    </span>
  );
}

/* Renders a comparison-table cell: ✓ → check, — → dash, else the raw value. */
function Mark({ value }) {
  if (value === "✓") return <CheckIcon className="w-4 h-4 text-credit inline-block" aria-label="Termasuk" />;
  if (value === "—") return <MinusIcon className="w-4 h-4 text-fog/40 inline-block" aria-label="Tidak termasuk" />;
  return <span className="font-mono tnum">{value}</span>;
}

/* ─── Plan Data ───────────────────────────────────────── */
const PLANS = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    period: "Selamanya",
    tagline: "5 kredit AI/minggu — rasakan langsung kekuatan AI",
    accent: "credit",
    popular: false,
    features: [
      "Catat transaksi (teks, foto, voice)",
      "Kategori otomatis oleh AI",
      "5 kredit AI per minggu",
      "Daily Insight (1 credit)",
      "Prediksi Umur Saldo (1 credit)",
      "Burn Rate Analysis (1 credit)",
      "Financial Health Score (1 credit)",
      "Spending Alert (1 credit)",
      "Dashboard & riwayat transaksi",
    ],
    notIncluded: [
      "Weekly Summary & Analysis",
      "Monthly Deep Analysis",
      "AI Financial Chat",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19000,
    period: "/bulan",
    tagline: "30 kredit/minggu, lebih murah dari es teh manis",
    accent: "orange",
    popular: true,
    features: [
      "Semua fitur Free",
      "30 kredit AI per minggu",
      "Weekly Summary (3 credit)",
      "Saving Recommendation (2 credit)",
      "Smart Budget Suggestion (2 credit)",
      "Goal-based Saving (2 credit)",
      "Expense Prediction (2 credit)",
      "Subscription Detector (2 credit)",
      "Overspending Alert (2 credit)",
      "Saving Simulation (2 credit)",
    ],
    notIncluded: ["Monthly Deep Analysis", "AI Financial Chat"],
  },
  {
    id: "elite",
    name: "Elite",
    price: 49000,
    period: "/bulan",
    tagline: "100 kredit/minggu, analisis komprehensif tanpa batas",
    accent: "cream",
    popular: false,
    features: [
      "Semua fitur Pro",
      "100 kredit AI per minggu",
      "Monthly Deep Analysis (5 credit)",
      "Forecast 3 Bulan (4 credit)",
      "AI Financial Chat (3 credit)",
      "Weekly Strategy (3 credit)",
      "Payday Planning (3 credit)",
      "Weekend Pattern Analysis",
      "Priority support",
      "Early access fitur baru",
    ],
    notIncluded: [],
  },
];

/* ─── Payment Modal ───────────────────────────────────── */
function PaymentModal({ plan, onClose }) {
  const siteSettings = useSiteSettings();
  const legalRequired = siteSettings?.legal_tos_enabled !== false || siteSettings?.legal_privacy_enabled !== false;
  const [step, setStep] = useState("form"); // form → paying → success → failed
  const [contactType, setContactType] = useState("telegram");
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [desiredLogin, setDesiredLogin] = useState("");
  const [desiredPassword, setDesiredPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [paymentId, setPaymentId] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState("");
  const [tosAgreed, setTosAgreed] = useState(false);

  const inputCls =
    "w-full px-4 py-3 bg-ink border border-ledger-line rounded-xl text-cream text-sm placeholder:text-fog/40 focus:outline-none focus:border-moss focus:ring-2 focus:ring-moss/20 transition-all";

  const handlePay = async () => {
    if (!contactId.trim()) {
      setError("Masukkan ID akun kamu");
      return;
    }
    if (!name.trim()) {
      setError("Masukkan nama kamu");
      return;
    }
    if (desiredLogin.trim() && !/^[a-z0-9._-]{3,32}$/.test(desiredLogin.trim().toLowerCase())) {
      setError("Username 3-32 karakter, huruf kecil/angka/._- saja");
      return;
    }
    if (desiredPassword && desiredPassword.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (legalRequired && !tosAgreed) {
      setError("Kamu harus menyetujui Terms of Service dan Privacy Policy");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/landing/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          contact_type: contactType,
          contact_value: contactId.trim(),
          name: name.trim(),
          desired_login: desiredLogin.trim() || undefined,
          desired_password: desiredPassword || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQrUrl(data.trakteer_url);
        setPaymentId(data.payment_id);
        setStep("paying");
        pollStatus(data.payment_id);
      } else {
        setError(data.error || "Gagal membuat pembayaran");
      }
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/landing/payment/status/${id}`);
        const data = await res.json();
        if (data.status === "paid") {
          clearInterval(interval);
          if (data.credentials) setCredentials(data.credentials);
          setStep("success");
        } else if (data.status === "expired" || data.status === "failed") {
          clearInterval(interval);
          setStep("failed");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    // Cleanup after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ink-soft border border-moss/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-black/50 animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 text-fog hover:text-cream transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* ── Form step ── */}
        {step === "form" && (
          <div className="space-y-5">
            <div className="text-center">
              <Logo className="h-10 w-auto mx-auto mb-2" glow />
              <h3 className="text-xl font-display font-semibold text-cream">Upgrade ke {plan.name}</h3>
              <p className="text-cream text-2xl font-bold font-mono tnum mt-1">
                {formatRupiah(plan.price)}
                <span className="text-sm font-normal text-fog font-sans">{plan.period}</span>
              </p>
            </div>

            {error && (
              <div className="bg-debit/10 border border-debit/30 rounded-xl px-4 py-3 text-sm text-debit">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-fog mb-2 font-medium">Nama lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama kamu"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm text-fog mb-2 font-medium">Kamu pakai FiNot di mana?</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "telegram", label: "Telegram" },
                  { val: "whatsapp", label: "WhatsApp" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setContactType(opt.val)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      contactType === opt.val
                        ? "border-moss bg-moss/15 text-cream"
                        : "border-ledger-line text-fog hover:border-moss/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-fog mb-2 font-medium">
                {contactType === "telegram" ? "Username Telegram" : "Nomor WhatsApp"}
              </label>
              <input
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder={contactType === "telegram" ? "@username" : "+62812xxxxxxx"}
                className={inputCls}
              />
            </div>

            <div className="pt-2 border-t border-ledger-line">
              <p className="text-xs text-fog mb-3">
                Akun login untuk chat-app FiNot (di browser/mobile). Kosongkan untuk dibuatkan otomatis.
              </p>
              <div>
                <label className="block text-sm text-fog mb-2 font-medium">Username</label>
                <input
                  type="text"
                  value={desiredLogin}
                  onChange={(e) => setDesiredLogin(e.target.value)}
                  placeholder="contoh: andi.pratama"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm text-fog mb-2 font-medium">Password (min 6 karakter)</label>
                <input
                  type="password"
                  value={desiredPassword}
                  onChange={(e) => setDesiredPassword(e.target.value)}
                  placeholder="Password kamu sendiri"
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
            </div>

            {legalRequired && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tosAgreed}
                  onChange={(e) => setTosAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ledger-line accent-orange shrink-0"
                />
                <span className="text-xs text-fog leading-relaxed">
                  Saya menyetujui{" "}
                  {siteSettings?.legal_tos_enabled !== false && (
                    <a href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-credit hover:underline">Terms of Service</a>
                  )}
                  {siteSettings?.legal_tos_enabled !== false && siteSettings?.legal_privacy_enabled !== false && " dan "}
                  {siteSettings?.legal_privacy_enabled !== false && (
                    <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-credit hover:underline">Privacy Policy</a>
                  )}
                  {" "}FiNot.
                </span>
              </label>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner /> Memproses...
                </>
              ) : (
                <>
                  <QrCodeIcon className="w-4 h-4" /> Bayar dengan QRIS
                </>
              )}
            </button>

            <p className="text-[0.7rem] text-fog/70 text-center">
              Pembayaran diproses melalui QRIS, mendukung semua e-wallet & mobile banking.
            </p>
          </div>
        )}

        {/* ── Paying step ── */}
        {step === "paying" && (
          <div className="text-center space-y-4">
            <h3 className="text-xl font-display font-semibold text-cream">Lanjutkan pembayaran</h3>

            {qrUrl ? (
              <>
                <p className="text-sm text-fog">
                  Klik tombol di bawah untuk membuka halaman pembayaran QRIS. Setelah membayar,
                  kembali ke halaman ini, status akan terupdate otomatis.
                </p>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
                >
                  <QrCodeIcon className="w-5 h-5" /> Bayar via QRIS
                </a>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-fog text-sm">
                <Spinner className="w-4 h-4" /> Menyiapkan pembayaran...
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-fog text-sm">
              <Spinner className="w-3.5 h-3.5" /> Menunggu konfirmasi pembayaran...
            </div>
            <p className="text-xs text-fog/70 font-mono tnum">
              Total: {formatRupiah(plan.price)} · Berlaku 30 menit
            </p>

            <button
              onClick={() => setStep("form")}
              className="text-sm text-fog hover:text-cream transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Kembali
            </button>
          </div>
        )}

        {/* ── Success step ── */}
        {step === "success" && (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-credit/15 flex items-center justify-center">
              <CheckIcon className="w-8 h-8 text-credit" />
            </div>
            <h3 className="text-xl font-display font-semibold text-cream">Pembayaran berhasil!</h3>
            <p className="text-sm text-fog max-w-xs mx-auto">
              Selamat! Kamu sekarang pengguna <span className="font-semibold text-cream">{plan.name}</span>.
              Semua fitur premium sudah aktif.
            </p>
            {credentials && (
              <div className="bg-ink border border-ledger-line rounded-xl p-4 text-left space-y-2">
                <p className="text-xs text-fog text-center mb-2">Akun login kamu</p>
                <div className="flex justify-between">
                  <span className="text-sm text-fog">Username:</span>
                  <span className="text-sm font-mono font-semibold text-cream">{credentials.web_login}</span>
                </div>
                {credentials.password && (
                  <div className="flex justify-between">
                    <span className="text-sm text-fog">Password:</span>
                    <span className="text-sm font-mono font-semibold text-cream">{credentials.password}</span>
                  </div>
                )}
                <p className="text-[0.65rem] text-orange-light text-center mt-2">
                  {credentials.password
                    ? "Simpan kredensial ini! Kamu bisa mengubahnya di Settings."
                    : "Gunakan password yang sudah kamu pilih sebelumnya."}
                </p>
              </div>
            )}
            <button
              onClick={async () => {
                try {
                  const r = await fetch(`/api/landing/payment/auto-login/${paymentId}`, {
                    method: "POST", credentials: "include",
                  });
                  const data = await r.json();
                  window.location.href = data?.redirect || "/chat";
                } catch {
                  window.location.href = "/login";
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
            >
              Mulai chat sekarang <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Failed step ── */}
        {step === "failed" && (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-debit/15 flex items-center justify-center">
              <XMarkIcon className="w-8 h-8 text-debit" />
            </div>
            <h3 className="text-xl font-display font-semibold text-cream">Pembayaran gagal</h3>
            <p className="text-sm text-fog max-w-xs mx-auto">
              Waktu pembayaran habis atau terjadi kesalahan. Silakan coba lagi.
            </p>
            <button
              onClick={() => setStep("form")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark transition-all"
            >
              Coba lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Pricing Page ───────────────────────────────── */
const accentText = {
  credit: "text-credit",
  orange: "text-orange",
  cream: "text-cream",
};

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  return (
    <div>
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-5">
        <div className="flex justify-center">
          <Eyebrow>Daftar harga</Eyebrow>
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-semibold text-cream leading-tight">
          Pilih paket yang <span className="text-credit">sesuai kebutuhanmu.</span>
        </h1>
        <p className="text-fog max-w-xl mx-auto leading-relaxed">
          User baru dapat <strong className="text-credit font-semibold">trial 7 hari gratis</strong>{" "}
          (35 kredit, semua fitur). Setelah itu, mulai dari Rp0 atau upgrade kapan saja.
        </p>
      </section>

      {/* Plan cards */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-ink-soft rounded-3xl p-6 flex flex-col transition-all hover:-translate-y-1 ${
                plan.popular ? "border-2 border-orange/60 shadow-xl shadow-black/30" : "border border-ledger-line"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-orange text-white text-[0.62rem] font-bold rounded-full uppercase tracking-wider font-mono">
                  Paling Populer
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-display text-lg font-semibold text-cream">{plan.name}</h3>
                  <span className={`font-mono text-[0.62rem] uppercase tracking-[0.14em] ${accentText[plan.accent]}`}>
                    {plan.id}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold tnum text-cream">
                    {plan.price === 0 ? "Rp0" : formatRupiah(plan.price)}
                  </span>
                  <span className="text-sm text-fog">{plan.period}</span>
                </div>
                <p className="text-xs text-fog mt-1.5 leading-relaxed">{plan.tagline}</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6 pt-5 border-t border-ledger-line">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon className="w-4 h-4 text-credit mt-0.5 shrink-0" />
                    <span className="text-cream/80">{f}</span>
                  </li>
                ))}
                {plan.notIncluded.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <XMarkIcon className="w-4 h-4 text-fog/30 mt-0.5 shrink-0" />
                    <span className="text-fog/40 line-through">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.price === 0 ? (
                <a
                  href="/register"
                  className="block text-center py-3 rounded-xl bg-orange text-white font-semibold text-sm hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
                >
                  Mulai gratis
                </a>
              ) : (
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-orange text-white shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5"
                      : "border border-moss/50 text-cream hover:bg-moss/15"
                  }`}
                >
                  Pilih {plan.name}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[0.72rem] text-fog">
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-credit" /> Bisa berhenti kapan saja
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-credit" /> QRIS semua bank & e-wallet
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-credit" /> Tanpa biaya tersembunyi
          </span>
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8 space-y-3">
          <div className="flex justify-center">
            <Eyebrow>Buku besar fitur</Eyebrow>
          </div>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold text-cream">Perbandingan lengkap</h2>
        </div>
        <div className="overflow-x-auto border border-ledger-line rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ledger-line bg-ink-soft">
                <th className="text-left py-3 px-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-fog">Fitur</th>
                <th className="text-center py-3 px-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-credit">Gratis</th>
                <th className="text-center py-3 px-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-orange">Pro</th>
                <th className="text-center py-3 px-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-cream">Elite</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["AI Kredit per Minggu", "5", "30", "100"],
                ["Catat transaksi (teks/foto/voice)", "✓", "✓", "✓"],
                ["Kategori otomatis", "✓", "✓", "✓"],
                ["Dashboard & riwayat", "✓", "✓", "✓"],
                ["Daily Insight (1 cr)", "✓", "✓", "✓"],
                ["Prediksi Umur Saldo (1 cr)", "✓", "✓", "✓"],
                ["Burn Rate (1 cr)", "✓", "✓", "✓"],
                ["Health Score (1 cr)", "✓", "✓", "✓"],
                ["Spending Alert (1 cr)", "✓", "✓", "✓"],
                ["Weekly Summary (3 cr)", "—", "✓", "✓"],
                ["Saving Recommendation (2 cr)", "—", "✓", "✓"],
                ["Budget Suggestion (2 cr)", "—", "✓", "✓"],
                ["Goal Saving (2 cr)", "—", "✓", "✓"],
                ["Expense Prediction (2 cr)", "—", "✓", "✓"],
                ["Subscription Detector (2 cr)", "—", "✓", "✓"],
                ["Monthly Deep Analysis (5 cr)", "—", "—", "✓"],
                ["Forecast 3 Bulan (4 cr)", "—", "—", "✓"],
                ["AI Financial Chat (3 cr)", "—", "—", "✓"],
                ["Weekly Strategy (3 cr)", "—", "—", "✓"],
                ["Payday Planning (3 cr)", "—", "—", "✓"],
                ["Priority support", "—", "—", "✓"],
              ].map(([feat, free, pro, elite], i) => (
                <tr key={i} className="border-b border-ledger-line/60 last:border-0 hover:bg-ink-2/40">
                  <td className="py-2.5 px-4 text-cream/80">{feat}</td>
                  <td className="py-2.5 px-4 text-center text-fog"><Mark value={free} /></td>
                  <td className="py-2.5 px-4 text-center text-cream font-medium"><Mark value={pro} /></td>
                  <td className="py-2.5 px-4 text-center text-cream/80"><Mark value={elite} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="font-display text-2xl font-semibold text-center mb-8 text-cream">Pertanyaan soal harga</h2>
        <div className="border-t border-ledger-line">
          {[
            {
              q: "Ada trial gratis?",
              a: "Ya! User baru otomatis mendapat Trial 7 hari dengan akses ke semua fitur (35 kredit total). Setelah trial berakhir, kamu otomatis masuk Paket Gratis dengan 5 kredit per minggu.",
            },
            {
              q: "Apakah paket Gratis benar-benar gratis?",
              a: "Ya! Paket Gratis bisa kamu pakai selamanya dengan 5 kredit AI per minggu. Cukup untuk 5 fitur AI dasar setiap minggu.",
            },
            {
              q: "Bagaimana cara bayar?",
              a: "Semua pembayaran menggunakan QRIS. Kamu bisa bayar lewat GoPay, OVO, DANA, ShopeePay, atau mobile banking apapun yang mendukung QRIS.",
            },
            {
              q: "Bisa berhenti kapan saja?",
              a: "Tentu! Tidak ada kontrak. Kamu bisa berhenti berlangganan kapan saja. Fitur premium tetap aktif sampai periode berlangganan berakhir.",
            },
          ].map((faq, i) => (
            <div key={i} className="border-b border-ledger-line py-4">
              <h3 className="font-medium text-cream mb-1.5">{faq.q}</h3>
              <p className="text-sm text-fog leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/faq" className="inline-flex items-center gap-1.5 font-mono text-sm text-fog hover:text-cream transition-colors">
            Lihat semua FAQ <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Payment Modal */}
      {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
