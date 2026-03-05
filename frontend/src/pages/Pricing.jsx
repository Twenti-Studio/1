import { ArrowLeftIcon, CheckIcon, QrCodeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";

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

/* ─── Plan Data ───────────────────────────────────────── */
const PLANS = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    period: "Selamanya",
    tagline: "5 AI credit/minggu — rasakan langsung kekuatan AI",
    color: "white/70",
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
    tagline: "30 kredit/minggu — lebih murah dari es teh manis",
    color: "blue-400",
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
    tagline: "100 kredit/minggu — analisis komprehensif tanpa batas",
    color: "orange",
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
  const [step, setStep] = useState("form"); // form → paying → success → failed
  const [contactType, setContactType] = useState("telegram");
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [_paymentId, setPaymentId] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (!contactId.trim()) {
      setError("Masukkan ID akun kamu");
      return;
    }
    if (!name.trim()) {
      setError("Masukkan nama kamu");
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
          contact_id: contactId.trim(),
          name: name.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQrUrl(data.qr_url);
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* ── Form step ── */}
        {step === "form" && (
          <div className="space-y-5">
            <div className="text-center">
              <Logo className="h-10 w-auto mx-auto mb-2" glow />
              <h3 className="text-xl font-bold">Upgrade ke {plan.name}</h3>
              <p className="text-white text-2xl font-extrabold mt-1">
                {formatRupiah(plan.price)}
                <span className="text-sm font-normal text-white/40">{plan.period}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-white/60 mb-2 font-medium">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama kamu"
                className="w-full px-4 py-3 bg-navy-dark border border-border rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2 font-medium">
                Kamu pakai FiNot di mana?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "telegram", label: "Telegram" },
                  { val: "whatsapp", label: "WhatsApp" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setContactType(opt.val)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${contactType === opt.val
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-border text-white/50 hover:border-white/20"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2 font-medium">
                {contactType === "telegram" ? "Username Telegram" : "Nomor WhatsApp"}
              </label>
              <input
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder={contactType === "telegram" ? "@username" : "+62812xxxxxxx"}
                className="w-full px-4 py-3 bg-navy-dark border border-border rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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

            <p className="text-[0.7rem] text-white/30 text-center">
              Pembayaran diproses melalui QRIS — mendukung semua e-wallet & mobile banking.
            </p>
          </div>
        )}

        {/* ── Paying step ── */}
        {step === "paying" && (
          <div className="text-center space-y-5">
            <h3 className="text-xl font-bold">Scan QRIS untuk Membayar</h3>
            <p className="text-sm text-white/50">
              Buka aplikasi e-wallet atau mobile banking, lalu scan QR code di bawah ini.
            </p>
            <div className="bg-white rounded-2xl p-4 inline-block">
              {qrUrl ? (
                <img src={qrUrl} alt="QRIS" className="w-56 h-56 object-contain" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-gray-400">
                  <Spinner className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <Spinner className="w-3.5 h-3.5" /> Menunggu pembayaran...
            </div>
            <p className="text-xs text-white/30">
              Total: {formatRupiah(plan.price)} &bull; Berlaku 10 menit
            </p>
            <button
              onClick={() => setStep("form")}
              className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Kembali
            </button>
          </div>
        )}

        {/* ── Success step ── */}
        {step === "success" && (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckIcon className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold">Pembayaran Berhasil!</h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto">
              Selamat! Kamu sekarang pengguna <span className="font-semibold text-white">{plan.name}</span>.
              Semua fitur premium sudah aktif.
            </p>
            {credentials && (
              <div className="bg-white/5 border border-border rounded-xl p-4 text-left space-y-2">
                <p className="text-xs text-white/40 text-center mb-2">Akun Dashboard Kamu</p>
                <div className="flex justify-between">
                  <span className="text-sm text-white/50">Username:</span>
                  <span className="text-sm font-mono font-semibold">{credentials.web_login}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/50">Password:</span>
                  <span className="text-sm font-mono font-semibold">{credentials.password}</span>
                </div>
                <p className="text-[0.65rem] text-amber-400 text-center mt-2">Simpan kredensial ini! Kamu bisa mengubahnya di Settings.</p>
              </div>
            )}
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20"
            >
              Masuk ke Dashboard
            </a>
          </div>
        )}

        {/* ── Failed step ── */}
        {step === "failed" && (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <XMarkIcon className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-bold">Pembayaran Gagal</h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto">
              Waktu pembayaran habis atau terjadi kesalahan. Silakan coba lagi.
            </p>
            <button
              onClick={() => setStep("form")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Pricing Page ───────────────────────────────── */
export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-navy-light/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center space-y-4">
          {/* <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
            <Crown size={14} /> Harga Transparan
          </span> */}
          <h1 className="text-3xl lg:text-4xl font-bold">
            Pilih Paket yang{" "}
            <span className="text-white">
              Sesuai Kebutuhanmu
            </span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            User baru dapat <strong className="text-orange">Trial 7 hari gratis</strong> (35 kredit, semua fitur).
            Setelah itu, mulai dari Rp0 atau upgrade kapan saja.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-3xl p-6 flex flex-col transition-all hover:-translate-y-1
                ${plan.popular ? "border-white/20 shadow-xl shadow-black/10" : "border-border"}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-orange to-orange-dark text-white text-[0.65rem] font-bold rounded-full uppercase tracking-wider">
                  Paling Populer
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">
                    {plan.price === 0 ? "Rp0" : formatRupiah(plan.price)}
                  </span>
                  <span className="text-sm text-white/40">{plan.period}</span>
                </div>
                <p className="text-xs text-white/40 mt-1">{plan.tagline}</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
                {plan.notIncluded.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <XMarkIcon className="w-4 h-4 text-white/20 mt-0.5 shrink-0" />
                    <span className="text-white/30">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.price === 0 ? (
                <a
                  href="https://t.me/finot_finance_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-3 rounded-xl border border-border text-white/60 font-semibold text-sm hover:bg-white/5 hover:border-white/20 transition-all"
                >
                  Mulai Gratis
                </a>
              ) : (
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.popular
                      ? "bg-gradient-to-r from-orange to-orange-dark text-white shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
                      : "border border-white/20 text-white/70 hover:bg-white/5"
                    }`}
                >
                  Pilih {plan.name}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 text-center space-y-3">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5 text-green-400" /> Bisa berhenti kapan saja
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5 text-green-400" /> QRIS semua bank & e-wallet
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5 text-green-400" /> Tanpa biaya tersembunyi
            </span>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-border bg-navy-dark/40">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">Perbandingan Lengkap</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-white/60">Fitur</th>
                  <th className="text-center py-3 px-4 font-semibold text-white/60">Gratis</th>
                  <th className="text-center py-3 px-4 font-semibold text-blue-400">Pro</th>
                  <th className="text-center py-3 px-4 font-semibold text-white/60">Elite</th>
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
                  <tr key={i} className="border-b border-border/50 hover:bg-white/2">
                    <td className="py-3 px-4 text-white/70">{feat}</td>
                    <td className="py-3 px-4 text-center text-white/40">{free}</td>
                    <td className="py-3 px-4 text-center text-white/70 font-medium">{pro}</td>
                    <td className="py-3 px-4 text-center text-white/70">{elite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Pertanyaan soal Harga</h2>
        <div className="space-y-4">
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
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-1">{faq.q}</h3>
              <p className="text-sm text-white/50">{faq.a}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/faq" className="text-white/50 text-sm font-medium hover:text-white hover:underline">
            Lihat semua FAQ →
          </Link>
        </div>
      </section>

      {/* Payment Modal */}
      {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
