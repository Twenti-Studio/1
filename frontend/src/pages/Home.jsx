import {
  ArrowRightIcon,
  ChevronRightIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";

const HIGHLIGHTS = [
  {
    title: "Chat Biasa, Langsung Tercatat",
    desc: "Ketik 'makan siang 35rb' selayaknya chat ke teman — dan transaksimu langsung masuk ke catatan keuangan dengan kategori otomatis.",
  },
  {
    title: "Foto Struk, Otomatis Terbaca",
    desc: "Cukup foto struk belanja. AI kami membaca setiap item, menghitung total, dan mencatat semuanya tanpa kamu ketik satu huruf pun.",
  },
  {
    title: "Analisis AI Setiap Hari",
    desc: "Setiap hari kami kirimkan insight: ke mana uangmu pergi, mana yang bisa dihemat, dan prediksi kecukupan saldo.",
  },
  {
    title: "Data Aman & Terenkripsi",
    desc: "Seluruh data keuanganmu terenkripsi dan tersimpan aman. Kami tidak pernah membagikan data ke pihak ketiga manapun.",
  },
];

const STATS = [
  { value: "50+", label: "Pengguna Aktif" },
  { value: "10.000+", label: "Transaksi Tercatat" },
  { value: "99%", label: "Akurasi OCR Struk" },
  { value: "24/7", label: "AI Selalu Tersedia" },
];

const TESTIMONIALS = [
  {
    name: "Rina Sari",
    role: "Freelance Designer",
    text: "Dulu aku selalu lupa catat pengeluaran. Sejak pakai FiNot, tinggal chat aja sehabis bayar. Sekarang akhirnya tahu kenapa uang selalu habis di tengah bulan!",
    rating: 5,
  },
  {
    name: "Budi Prasetyo",
    role: "Mahasiswa S1",
    text: "Fitur scan struk-nya keren banget. Belanja di minimarket, foto struk, semua langsung ke-record. Aku bisa kasih lihat laporan ke orang tua juga.",
    rating: 5,
  },
  {
    name: "Dinda Ayu",
    role: "Karyawan Swasta",
    text: "Weekly summary setiap Senin bikin aku sadar pola pengeluaranku. Dalam 2 bulan pakai FiNot, berhasil pangkas jajan 30% dan mulai nabung rutin.",
    rating: 5,
  },
];

export default function Home() {
  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-navy-light/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-navy-light/30 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-32 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left space-y-6">
            {/* <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold tracking-wide">
              <Zap size={14} /> Asisten Keuangan AI #1 di Indonesia
            </span> */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold leading-tight">
              Kelola Keuangan{" "}
              <span className="text-white">
                Semudah Ngobrol
              </span>
            </h1>
            <p className="text-lg text-white/60 max-w-xl mx-auto lg:mx-0">
              FiNot adalah asisten AI di Telegram &amp; WhatsApp yang mencatat pengeluaranmu,
              membaca struk belanja, dan memberikan insight keuangan yang personal — semua lewat
              chat biasa, tanpa perlu buka aplikasi lain.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <a
                href="https://t.me/finot_finance_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 transition-all"
              >
                Coba Gratis Sekarang
              </a>
              <Link
                to="/features"
                className="inline-flex items-center gap-1.5 text-white/60 hover:text-white font-medium transition-colors"
              >
                Lihat Semua Fitur <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Chat mockup */}
          <div className="flex-1 max-w-md w-full">
            <div className="bg-card rounded-3xl border border-border p-5 shadow-2xl animate-pulse-glow">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                <Logo className="h-10 w-auto" glow />
                <div>
                  <p className="font-semibold text-sm">FiNot Bot</p>
                  <p className="text-xs text-green-400">Online</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-end">
                  <div className="bg-white/10 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]">
                    Makan siang 35rb di warteg
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-navy-light/50 text-white rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                    Tercatat!
                    <br />
                    <span className="text-white/60 text-xs">
                      Pengeluaran &bull; Makanan &bull; Rp35.000
                    </span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white/10 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]">
                    Sisa saldo bulan ini?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-navy-light/50 text-white rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                    Saldo: <span className="font-bold text-green-400">Rp1.245.000</span>
                    <br />
                    <span className="text-white/60 text-xs">
                      Prediksi cukup sampai tgl 28. Kurangi jajan 15% minggu ini ya!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HIGHLIGHTS ═══ */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="bg-card/70 backdrop-blur border border-border rounded-2xl p-5 hover:border-white/15 transition-colors group"
            >
              <h3 className="font-semibold mb-1">{h.title}</h3>
              <p className="text-sm text-white/50">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      {/* <section className="border-y border-border bg-navy-dark/40">
        <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl lg:text-4xl font-extrabold text-white">
                {s.value}
              </p>
              <p className="text-sm text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section> */}

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="max-w-6xl mx-auto px-6 py-5">
        <h2 className="text-2xl lg:text-3xl font-bold text-center mb-3">Apa Kata Mereka?</h2>
        <p className="text-center text-white/50 mb-12 max-w-lg mx-auto">
          Cerita nyata dari pengguna yang sudah merasakan kemudahan mencatat keuangan bersama FiNot.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-card border border-border rounded-2xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <StarIcon key={i} className="w-4 h-4 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-white/70 mb-4 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-navy-light flex items-center justify-center text-sm font-bold text-white/70">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-navy-dark to-navy opacity-90" />
        <div className="relative max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
          {/* <TrendingUp size={40} className="text-white/50 mx-auto" /> */}
          <h2 className="text-3xl lg:text-4xl font-bold">
            Siap Ambil Kendali{" "}
            <span className="text-white">
              Keuanganmu?
            </span>
          </h2>
          <p className="text-white/50 max-w-lg mx-auto">
            Mulai gratis sekarang. Tanpa kartu kredit, tanpa aplikasi tambahan — langsung chat di
            Telegram atau WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://t.me/finot_finance_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-transform"
            >
              Mulai Gratis di Telegram
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-white/15 text-white font-medium hover:bg-white/5 transition-colors"
            >
              Lihat Paket Harga <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
