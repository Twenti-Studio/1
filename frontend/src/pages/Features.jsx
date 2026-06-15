import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { Link, useNavigate } from "react-router-dom";

const FEATURES = [
  {
    title: "Input fleksibel: chat, foto, voice",
    desc: "Chat biasa, foto struk, atau voice note, pilih cara yang paling nyaman. FiNot transkripsi, baca, lalu kategorikan otomatis. Tanpa form rumit.",
    section: "input",
  },
  {
    title: "Keamanan berlapis",
    desc: "Kategori otomatis untuk jutaan merchant (Netflix, Gojek, Indomaret). Data terenkripsi end-to-end, kami tidak pernah membaca atau membagikan datamu.",
    section: "input",
  },
  {
    title: "Daily intelligence",
    desc: "Setiap pagi: ringkasan pengeluaran, kategori terbesar, burn rate (seberapa cepat uang habis), dan tips spesifik hari ini.",
    section: "free",
  },
  {
    title: "Financial health scorecard",
    desc: "Skor kesehatan 0–100 dari rasio pengeluaran, konsistensi mencatat, prediksi sampai kapan saldo cukup, dan rekomendasi pertama.",
    section: "free",
  },
  {
    title: "Smart financial watchdog",
    desc: "Deteksi otomatis anomali pengeluaran, langganan berulang (Netflix, Spotify), dan overspending per kategori. Alert real-time.",
    section: "free",
  },
  {
    title: "Weekly deep dive",
    desc: "Setiap Senin: breakdown detail per kategori, tren vs minggu lalu, rekomendasi saving spesifik, dan saran budget cerdas.",
    section: "pro",
  },
  {
    title: "Goal-based saving & budget",
    desc: "Mau beli laptop Rp8jt dalam 6 bulan? FiNot hitung target per minggu, buat budget realistis per kategori, dan pantau progress real-time.",
    section: "pro",
  },
  {
    title: "Expense prediction & payday plan",
    desc: "Proyeksi bulan ini vs pola sebelumnya. Alokasi gaji otomatis: berapa untuk kebutuhan, tabungan, dan keinginan, dari pola riilmu.",
    section: "pro",
  },
  {
    title: "Monthly deep analysis",
    desc: "Analisis mendalam tiap bulan: perbandingan 3 bulan, skor finansial, proyeksi risiko, dan action plan strategis untuk bulan depan.",
    section: "elite",
  },
  {
    title: "Forecast 3 bulan & strategi",
    desc: "Proyeksi keuangan 3 bulan ke depan: income, expenses, balance, risiko, dan saran, untuk planning jangka panjang yang realistis.",
    section: "elite",
  },
  {
    title: "Weekly strategy & chat AI",
    desc: "Strategi pengeluaran mingguan yang dipersonalisasi. Plus tanya apa saja soal keuanganmu, AI jawab berdasarkan data transaksimu.",
    section: "elite",
  },
  {
    title: "Simulasi & scenario planning",
    desc: "Eksperimen: 'Kalau aku hemat jajan Rp500rb/bulan, sampai kapan saldo cukup?' FiNot mensimulasikan berbagai skenario finansialmu.",
    section: "elite",
  },
];

const SECTIONS = [
  { id: "input", label: "Input & Keamanan", note: "Gratis", accent: "credit" },
  { id: "free", label: "AI Harian", note: "Gratis · 1 kredit", accent: "credit" },
  { id: "pro", label: "Analisis Pro", note: "Pro · 2–3 kredit", accent: "fog" },
  { id: "elite", label: "Strategi Elite", note: "Elite · 3–5 kredit", accent: "orange" },
];

const accentText = {
  credit: "text-credit",
  fog: "text-fog",
  orange: "text-orange",
};

function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.22em] uppercase text-fog">
      <span className="h-px w-6 bg-moss" />
      {children}
    </span>
  );
}

export default function Features() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-5">
        <div className="flex justify-center">
          <Eyebrow>Daftar kemampuan</Eyebrow>
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-semibold text-cream leading-tight">
          Semua yang kamu butuhkan
          <br />
          untuk <span className="text-credit">mengelola uang.</span>
        </h1>
        <p className="text-fog max-w-xl mx-auto leading-relaxed">
          Dari pencatatan otomatis hingga prediksi berbasis AI, disusun seperti buku besar,
          dikelompokkan per paket. Klik fitur untuk lihat paketnya.
        </p>
      </section>

      {/* Sections as ledger groups */}
      <section className="max-w-6xl mx-auto px-6 pb-20 space-y-12">
        {SECTIONS.map((sec) => {
          const items = FEATURES.filter((f) => f.section === sec.id);
          return (
            <div key={sec.id}>
              <div className="flex items-baseline justify-between border-b border-ledger-line pb-3 mb-5">
                <h2 className="font-display text-xl font-semibold text-cream">{sec.label}</h2>
                <span className={`font-mono text-[0.68rem] tracking-[0.14em] uppercase ${accentText[sec.accent]}`}>
                  {sec.note}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((f) => (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => navigate("/pricing")}
                    className="group text-left bg-ink-soft border border-ledger-line rounded-2xl p-5 hover:border-moss/50 hover:bg-ink-2 transition-all"
                  >
                    <h3 className="font-display text-base font-semibold text-cream mb-2 flex items-start justify-between gap-2">
                      {f.title}
                      <ArrowRightIcon className="w-4 h-4 text-fog/50 group-hover:text-credit transition-colors shrink-0 mt-0.5" />
                    </h3>
                    <p className="text-sm text-fog leading-relaxed">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-ink-soft border border-moss/40 rounded-3xl px-8 py-12 text-center space-y-4">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold text-cream">Siap mencoba?</h2>
          <p className="text-fog max-w-md mx-auto leading-relaxed">
            User baru langsung dapat <strong className="text-credit font-semibold">trial 7 hari gratis</strong>{" "}
            dengan akses semua 12 fitur AI. Upgrade ke Pro atau Elite kapan saja.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-1">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
            >
              Mulai trial 7 hari
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 px-5 py-3.5 text-fog hover:text-cream font-medium transition-colors"
            >
              Bandingkan paket <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
