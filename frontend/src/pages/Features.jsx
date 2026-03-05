import { Link } from "react-router-dom";

const FEATURES = [
  // ── Input (Gratis) ──
  {
    title: "Catat Lewat Chat",
    desc: 'Ketik "makan siang 35rb" selayaknya chat — FiNot langsung mencatat dengan kategori otomatis. Tanpa form, tanpa pilih-pilih.',
    tag: "Gratis",
  },
  {
    title: "Scan Struk (OCR)",
    desc: "Foto struk belanja — AI membaca item, hitung total, dan catat semua dalam hitungan detik. Akurasi OCR 99%.",
    tag: "Gratis",
  },
  {
    title: "Voice Note",
    desc: 'Kirim voice "beli bensin lima puluh ribu" — AI transkripsi, ekstrak jumlah & kategori, dan catat otomatis.',
    tag: "Gratis",
  },
  {
    title: "Kategori Otomatis",
    desc: 'AI mengenali "warteg" = Makanan, "gojek" = Transport, "Netflix" = Hiburan. Otomatis tanpa input manual.',
    tag: "Gratis",
  },
  {
    title: "Data Terenkripsi",
    desc: "Data keuanganmu terenkripsi dan aman. Kami tidak pernah membaca, membagikan, atau menjual datamu.",
    tag: "Gratis",
  },
  // ── Free AI (1 credit) ──
  {
    title: "Daily AI Insight",
    desc: "Setiap hari FiNot kirim ringkasan: total pengeluaran, kategori terbesar, perbandingan hari biasa, dan tips hemat yang spesifik.",
    tag: "Free (1 credit)",
  },
  {
    title: "Prediksi Umur Saldo",
    desc: "AI prediksi saldomu cukup sampai tanggal berapa. Plus estimasi berapa perlu dihemat agar sampai akhir bulan.",
    tag: "Free (1 credit)",
  },
  {
    title: "Burn Rate Analysis",
    desc: "Hitung kecepatan uangmu habis per hari. Tahu persis tempo pengeluaranmu dan kapan kamu perlu rem.",
    tag: "Free (1 credit)",
  },
  {
    title: "Financial Health Score",
    desc: "Skor 0-100: seberapa sehat keuanganmu berdasarkan rasio pengeluaran, konsistensi mencatat, dan pola menabung.",
    tag: "Free (1 credit)",
  },
  {
    title: "Spending Alert",
    desc: "Peringatan saat pengeluaran melebihi pola normal atau ada anomali transaksi yang perlu diwaspadai.",
    tag: "Free (1 credit)",
  },
  // ── Pro AI (2-3 credit) ──
  {
    title: "Weekly Summary",
    desc: "Setiap Senin: breakdown per kategori, tren vs minggu lalu, income vs outcome, dan rekomendasi mingguan.",
    tag: "Pro (3 credit)",
  },
  {
    title: "Saving Recommendation",
    desc: "AI analisis polamu dan kasih rekomendasi spesifik: kategori mana yang bisa dihemat dan berapa targetnya.",
    tag: "Pro (2 credit)",
  },
  {
    title: "Smart Budget Suggestion",
    desc: "AI buatkan budget otomatis per kategori berdasarkan pola 30 hari terakhir. Realistis dan bisa dicapai.",
    tag: "Pro (2 credit)",
  },
  {
    title: "Goal-based Saving",
    desc: 'Mau beli laptop Rp8 juta dalam 6 bulan? FiNot hitung berapa per minggu dan pantau progresnya.',
    tag: "Pro (2 credit)",
  },
  {
    title: "Expense Prediction",
    desc: "Prediksi pengeluaran bulan ini berdasarkan pola saat ini. Tahu lebih awal sebelum terlambat.",
    tag: "Pro (2 credit)",
  },
  {
    title: "Subscription Detector",
    desc: "Deteksi langganan berulang (Netflix, Spotify, dll). Alert pembayaran mendatang dan total bulanan.",
    tag: "Pro (2 credit)",
  },
  {
    title: "Overspending Alert",
    desc: "Peringatan per kategori kalau kamu sudah melebihi rata-rata. Finance cop pribadimu.",
    tag: "Pro (2 credit)",
  },
  // ── Elite AI (3-5 credit) ──
  {
    title: "Monthly Deep Analysis",
    desc: "Analisis mendalam bulanan: perbandingan 3 bulan, proyeksi bulan depan, skor finansial, dan action plan.",
    tag: "Elite (5 credit)",
  },
  {
    title: "Forecast 3 Bulan",
    desc: "Proyeksi keuangan 3 bulan ke depan: income, expenses, balance, risiko, dan strategi investasi.",
    tag: "Elite (4 credit)",
  },
  {
    title: "AI Financial Chat",
    desc: "Tanya apa saja soal keuanganmu. AI jawab berdasarkan data transaksimu yang real. Konsultan AI pribadimu.",
    tag: "Elite (3 credit)",
  },
  {
    title: "Weekly Strategy",
    desc: "Strategi pengeluaran mingguan yang disesuaikan dengan pola hidupmu. Bukan teori — ini praktis.",
    tag: "Elite (3 credit)",
  },
  {
    title: "Payday Planning",
    desc: "Alokasi gaji otomatis: berapa untuk kebutuhan, tabungan, dan keinginan. Berdasarkan pola riilmu.",
    tag: "Elite (3 credit)",
  },
];

export default function Features() {
  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-navy-light/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center space-y-4">
          {/* <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
            <Brain size={14} /> 12 Fitur Lengkap
          </span> */}
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

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-card/70 backdrop-blur border border-border rounded-2xl p-6 hover:border-white/15 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <span
                  className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-md uppercase ${f.tag.startsWith("Elite")
                    ? "bg-white/10 text-white/60"
                    : f.tag.startsWith("Pro")
                      ? "bg-navy-light/30 text-blue-300"
                      : f.tag.startsWith("Free")
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 text-white/40"
                    }`}
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border bg-navy-dark/40 text-center py-16 px-6">
        <h2 className="text-2xl font-bold mb-3">Siap Mencoba?</h2>
        <p className="text-white/50 mb-6 max-w-md mx-auto">
          User baru langsung dapat <strong className="text-orange">Trial 7 hari gratis</strong> dengan akses semua 22 fitur AI (35 kredit).
          Upgrade ke Pro atau Elite kapan saja!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://t.me/finot_finance_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-transform"
          >
            Mulai Trial 7 Hari
          </a>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-medium hover:bg-white/5 transition-colors"
          >
            Bandingkan Paket
          </Link>
        </div>
      </section>
    </div>
  );
}

