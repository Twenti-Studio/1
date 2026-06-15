import { ArrowRightIcon, StarIcon } from "@heroicons/react/24/solid";
import { Link } from "react-router-dom";
import LedgerPosting from "../components/marketing/LedgerPosting";

const HIGHLIGHTS = [
  {
    code: "Chat",
    title: "Chat biasa, langsung tercatat",
    desc: "Ketik 'makan siang 35rb' seperti chat ke teman, transaksimu masuk ke buku besar dengan kategori otomatis.",
  },
  {
    code: "OCR",
    title: "Foto struk, otomatis terbaca",
    desc: "Foto struk belanja. AI membaca tiap item, menghitung total, dan mencatat semuanya tanpa kamu ketik.",
  },
  {
    code: "Insight",
    title: "Analisis AI setiap hari",
    desc: "Setiap hari: ke mana uangmu pergi, mana yang bisa dihemat, dan prediksi sampai kapan saldo cukup.",
  },
  {
    code: "Aman",
    title: "Data terenkripsi",
    desc: "Seluruh datamu terenkripsi dan tersimpan aman. Kami tidak pernah membagikannya ke pihak mana pun.",
  },
];

const TESTIMONIALS = [
  {
    name: "Faisal",
    role: "Mahasiswa S1",
    text: "Dulu aku selalu lupa catat pengeluaran. Sejak pakai FiNot, tinggal chat aja sehabis bayar. Akhirnya tahu kenapa uang selalu habis di tengah bulan.",
    rating: "5,0",
  },
  {
    name: "Kristian",
    role: "Pekerja Swasta",
    text: "Fitur scan struk-nya keren banget. Belanja di minimarket, foto struk, semua langsung ke-record. Bisa kasih lihat laporan ke orang tua juga.",
    rating: "5,0",
  },
  {
    name: "Andi",
    role: "Mahasiswa S1",
    text: "Ringkasan tiap Senin bikin aku sadar pola pengeluaran. Dalam 2 bulan, berhasil pangkas jajan 30% dan mulai nabung rutin.",
    rating: "5,0",
  },
];

function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.22em] uppercase text-fog">
      <span className="h-px w-6 bg-moss" />
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-moss/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 items-center gap-14">
          <div className="space-y-7 text-center lg:text-left">
            <h1 className="font-display text-[2.6rem] leading-[1.06] sm:text-5xl xl:text-[3.7rem] font-bold tracking-tight text-cream">
              Ngatur duit harusnya{" "}
              <span className="text-credit">segampang nge-chat.</span>
            </h1>
            <p className="text-lg text-fog max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Ketik kayak chat biasa, <span className="text-cream">“makan siang 35rb”</span>,
              FiNot langsung nyatet, ngategoriin, dan nunjukin ke mana uangmu pergi.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
              >
                Mulai gratis sekarang
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-1.5 text-fog hover:text-cream font-medium transition-colors"
              >
                Lihat cara kerja <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
            <p className="font-mono text-[0.7rem] text-fog/70">
              Tanpa kartu kredit · Trial 7 hari semua fitur
            </p>
          </div>

          {/* Signature: chat → buku besar */}
          <div className="w-full max-w-md mx-auto lg:ml-auto">
            <LedgerPosting />
          </div>
        </div>
      </section>

      {/* ═══ HIGHLIGHTS ═══ */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="mb-8">
          <Eyebrow>Empat hal yang FiNot kerjakan</Eyebrow>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-ledger-line rounded-2xl overflow-hidden border border-ledger-line">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="bg-ink-soft p-6 hover:bg-ink-2 transition-colors"
            >
              <span className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-credit">
                {h.code}
              </span>
              <h3 className="font-display text-lg font-semibold mt-3 mb-2 text-cream">{h.title}</h3>
              <p className="text-sm text-fog leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-12 space-y-3">
          <div className="flex justify-center">
            <Eyebrow>Catatan pengguna</Eyebrow>
          </div>
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-cream">
            Apa kata mereka?
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="bg-ink-soft border border-ledger-line rounded-2xl p-6 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-sm font-semibold text-cream tnum">{t.rating}</span>
                <StarIcon className="w-4 h-4 text-amber-500" />
              </div>
              <blockquote className="text-sm text-cream/85 leading-relaxed flex-1">
                “{t.text}”
              </blockquote>
              <figcaption className="flex items-center gap-3 mt-5 pt-4 border-t border-ledger-line">
                <span className="w-9 h-9 rounded-full bg-ink-2 flex items-center justify-center text-sm font-display font-semibold text-credit">
                  {t.name[0]}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-cream">{t.name}</span>
                  <span className="block font-mono text-[0.65rem] text-fog">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ═══ CTA, closing entry ═══ */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="relative bg-ink-soft border border-moss/40 rounded-3xl px-8 py-14 text-center overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-moss/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative space-y-5">
            <Eyebrow>Mulai hari ini</Eyebrow>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold text-cream max-w-2xl mx-auto leading-tight">
              Siap ambil kendali <span className="text-credit">keuanganmu?</span>
            </h2>
            <p className="text-fog max-w-lg mx-auto leading-relaxed">
              Gratis, tanpa kartu kredit. Daftar dan langsung pakai di browser. Mau pakai
              dari Telegram? Bisa dihubungkan dari dalam app.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-1">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
              >
                Mulai gratis sekarang
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-3.5 text-fog hover:text-cream font-medium transition-colors"
              >
                Lihat paket harga <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
