import { Link, useNavigate } from "react-router-dom";

const FEATURES = [
  // ── Input (Gratis) ──
  {
    title: "Input Fleksibel: Chat, Foto, Voice",
    desc: "Chat biasa, foto struk, atau voice note — pilih cara yang paling nyaman. FiNot otomatis transkripsi, baca, kategorikan. Tanpa form rumit.",
    tag: "Gratis",
    section: "input"
  },
  {
    title: "Keamanan Berlapis",
    desc: "Kategori otomatis untuk jutaan merchant (Netflix, Gojek, Indomaret, dll). Data terenkripsi end-to-end — kami tidak pernah membaca atau membagikan datamu.",
    tag: "Gratis",
    section: "input"
  },
  
  // ── Free AI (1 credit) ──
  {
    title: "Daily Intelligence",
    desc: "Setiap pagi: ringkasan pengeluaran, kategori terbesar, burn rate (seberapa cepat uang habis), dan tips spesifik hari ini.",
    tag: "Free (1 credit)",
    section: "free"
  },
  {
    title: "Financial Health Scorecard",
    desc: "Skor kesehatan 0-100 berdasarkan: rasio pengeluaran, konsistensi mencatat, prediksi saldo sampai kapan, dan rekomendasi pertama.",
    tag: "Free (1 credit)",
    section: "free"
  },
  {
    title: "Smart Financial Watchdog",
    desc: "Auto-detect anomali pengeluaran, langganan berulang (Netflix, Spotify), overspending per kategori. Alert real-time, finansial cop-mu.",
    tag: "Free (1 credit)",
    section: "free"
  },
  
  // ── Pro AI (2-3 credit) ──
  {
    title: "Weekly Deep Dive",
    desc: "Setiap Senin: breakdown detail per kategori, tren vs minggu lalu, rekomendasi saving spesifik, dan smart budget suggestion.",
    tag: "Pro (2-3 credit)",
    section: "pro"
  },
  {
    title: "Goal-Based Saving & Budget",
    desc: "Mau beli laptop Rp8jt dalam 6 bulan? FiNot hitung target per minggu, buat budget realistic per kategori, dan pantau progress real-time.",
    tag: "Pro (2-3 credit)",
    section: "pro"
  },
  {
    title: "Expense Prediction & Payday Plan",
    desc: "Proyeksi bulan ini vs pola sebelumnya. Alokasi gaji otomatis: berapa untuk kebutuhan, tabungan, keinginan — berdasarkan pola riil kamu.",
    tag: "Pro (2-3 credit)",
    section: "pro"
  },
  
  // ── Elite AI (3-5 credit) ──
  {
    title: "Monthly Deep Analysis",
    desc: "Analisis mendalam setiap bulan: perbandingan 3 bulan, skor finansial, proyeksi risiko, dan action plan strategis untuk bulan depan.",
    tag: "Elite (4-5 credit)",
    section: "elite"
  },
  {
    title: "3-Month Forecast & Strategy",
    desc: "Proyeksi keuangan 3 bulan ke depan: income, expenses, balance, risiko, saran investasi — untuk planning jangka panjang yang realistic.",
    tag: "Elite (4 credit)",
    section: "elite"
  },
  {
    title: "Weekly Strategy & Chat AI",
    desc: "Strategi pengeluaran mingguan yang dipersonalisasi. Plus tanya apa saja soal keuanganmu — AI jawab berdasarkan data real transaksimu.",
    tag: "Elite (3 credit)",
    section: "elite"
  },
  {
    title: "Simulasi & Scenario Planning",
    desc: "Eksperimen: 'Apa kalau aku hemat jajan Rp500rb/bulan? Sampai kapan saldo cukup?' FiNot simulasi berbagai skenario finansialmu.",
    tag: "Elite (5 credit)",
    section: "elite"
  },
];

export default function Features() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-navy-light/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center space-y-4">
          <h1 className="text-3xl lg:text-4xl font-bold">
            Semua yang Kamu Butuhkan untuk{" "}
            <span className="text-white">
              Mengelola Uang
            </span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Dari pencatatan otomatis hingga prediksi keuangan berbasis AI — FiNot adalah
            satu-satunya alat keuangan yang kamu butuhkan.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              onClick={() => navigate("/pricing")}
              className="group relative bg-card/70 backdrop-blur rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/10"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '2px solid #191c22',
              }}

            >
              {/* Background overlay on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ backgroundColor: '#191c22' }} />

              <div className="relative z-10 flex items-start justify-between mb-4">
                <span
                  className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-md uppercase transition-all duration-300 ${f.tag.startsWith("Elite")
                    ? "bg-orange-500/20 text-orange-300 group-hover:bg-orange-500/40 group-hover:text-orange-200"
                    : f.tag.startsWith("Pro")
                      ? "bg-navy-light/30 text-blue-300 group-hover:bg-blue-500/30 group-hover:text-blue-200"
                      : f.tag.startsWith("Free")
                        ? "bg-green-500/15 text-green-400 group-hover:bg-green-500/30 group-hover:text-green-300"
                        : "bg-white/5 text-white/40 group-hover:bg-white/10"
                    }`}
                >
                  {f.tag}
                </span>
              </div>

              <h3 className="relative z-10 text-lg font-semibold mb-2 group-hover:text-white transition-colors duration-300">{f.title}</h3>
              <p className="relative z-10 text-sm text-white/50 leading-relaxed group-hover:text-white/70 transition-colors duration-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border bg-navy-dark/40 text-center py-16 px-6">
        <h2 className="text-2xl font-bold mb-3">Siap Mencoba?</h2>
        <p className="text-white/50 mb-6 max-w-md mx-auto">
          User baru langsung dapat <strong className="text-orange">Trial 7 hari gratis</strong> dengan akses semua 12 fitur AI.
          Upgrade ke Pro atau Elite kapan saja!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-transform"
          >
            Mulai Trial 7 Hari
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white/60 hover:text-white font-medium text-sm transition-colors"
          >
            Bandingkan Paket
          </Link>
        </div>
      </section>
    </div>
  );
}