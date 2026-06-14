import { Link } from "react-router-dom";

const STEPS = [
  {
    num: "01",
    title: "Daftar & mulai chat dengan FiNot",
    desc: "Klik 'Mulai Gratis', buat akun dengan username & password, dan kamu langsung masuk ke chat app FiNot di browser. Tanpa verifikasi email yang ribet.",
    detail:
      "Mau pakai dari Telegram juga? Setelah masuk, hubungkan akunmu lewat Pengaturan → Linked Accounts. Riwayat chat tersinkron otomatis antara web app dan Telegram. WhatsApp segera hadir.",
  },
  {
    num: "02",
    title: "Catat pengeluaran & pemasukan",
    desc: 'Kirim pesan seperti "makan siang 35rb" atau "gajian 5jt". Bisa juga foto struk belanja atau kirim voice note.',
    detail:
      "AI otomatis mengenali jumlah, kategori (Makanan, Transport, Hiburan, dll), dan tanggal transaksi. Kamu tidak perlu memilih kategori secara manual.",
  },
  {
    num: "03",
    title: "FiNot menganalisis polamu",
    desc: "Di balik layar, AI menganalisis pola pengeluaranmu: mana yang rutin, mana yang impulsif, dan mana yang bisa dihemat.",
    detail:
      "FiNot membuat prediksi saldo, menghitung financial health score, dan menyiapkan insight yang personal untuk situasi keuanganmu.",
  },
  {
    num: "04",
    title: "Terima insight yang actionable",
    desc: "Dapatkan ringkasan harian, laporan mingguan setiap Senin, dan analisis mendalam setiap bulan — langsung di chatmu.",
    detail:
      "Tiap insight mencakup breakdown per kategori, perbandingan dengan periode sebelumnya, saran penghematan spesifik, dan proyeksi saldo ke depan.",
  },
];

const USE_CASES = [
  {
    label: "Mahasiswa",
    desc: "Pantau uang jajan bulanan dari orang tua. Tahu persis ke mana uang habis sebelum tanggal tua. Paket Gratis cukup untuk budget mahasiswa.",
  },
  {
    label: "Freelancer",
    desc: "Track income dari berbagai klien dalam satu tempat. Pisahkan pengeluaran bisnis vs pribadi. Lihat tren pemasukan mingguan dan bulanan.",
  },
  {
    label: "Karyawan",
    desc: "Kelola gaji bulanan dengan cerdas. Monitor cicilan, tagihan rutin, dan progress tabungan. Prediksi apakah gaji cukup sampai gajian berikutnya.",
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

export default function HowItWorks() {
  return (
    <div>
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-5">
        <div className="flex justify-center">
          <Eyebrow>Jurnal · 4 langkah</Eyebrow>
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-semibold text-cream leading-tight">
          Mulai dalam <span className="text-credit">30 detik.</span>
        </h1>
        <p className="text-fog max-w-xl mx-auto leading-relaxed">
          Dari nol sampai punya insight keuangan — semua otomatis lewat satu chat.
        </p>
      </section>

      {/* Steps — journal entries */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="relative">
          <div className="absolute left-[1.85rem] top-2 bottom-2 w-px bg-ledger-line hidden sm:block" />
          <ol className="space-y-4">
            {STEPS.map((step) => (
              <li key={step.num} className="relative flex gap-5">
                <div className="shrink-0 z-10">
                  <div className="w-[3.7rem] h-[3.7rem] rounded-xl bg-ink-soft border border-moss/40 flex flex-col items-center justify-center">
                    <span className="font-mono text-[0.5rem] tracking-[0.1em] text-fog uppercase">Jrnl</span>
                    <span className="font-display text-xl font-semibold text-credit leading-none">{step.num}</span>
                  </div>
                </div>
                <div className="flex-1 bg-ink-soft border border-ledger-line rounded-2xl p-5 hover:border-moss/40 transition-colors">
                  <h3 className="font-display text-lg font-semibold text-cream mb-2">{step.title}</h3>
                  <p className="text-cream/80 text-sm leading-relaxed mb-2">{step.desc}</p>
                  <p className="text-sm text-fog leading-relaxed">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10 space-y-3">
          <div className="flex justify-center">
            <Eyebrow>Cocok untuk siapa</Eyebrow>
          </div>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold text-cream">
            FiNot cocok untuk siapa?
          </h2>
          <p className="text-fog max-w-md mx-auto leading-relaxed">
            Siapa pun yang ingin lebih tahu ke mana perginya setiap rupiah.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-px bg-ledger-line rounded-2xl overflow-hidden border border-ledger-line">
          {USE_CASES.map((uc) => (
            <div key={uc.label} className="bg-ink-soft p-6 hover:bg-ink-2 transition-colors">
              <span className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-credit">
                {uc.label}
              </span>
              <p className="text-sm text-fog leading-relaxed mt-3">{uc.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange text-white font-semibold shadow-lg shadow-black/30 hover:bg-orange-dark hover:-translate-y-0.5 transition-all"
          >
            Mulai gratis sekarang
          </Link>
        </div>
      </section>
    </div>
  );
}
