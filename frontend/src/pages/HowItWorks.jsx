import { ChevronDownIcon } from "@heroicons/react/24/outline";

const STEPS = [
  {
    num: "01",
    title: "Mulai Chat dengan FiNot",
    desc: "Buka Telegram dan cari @finot_finance_bot, lalu tekan START. Akunmu langsung aktif — tanpa registrasi, tanpa isi form, tanpa verifikasi email.",
    detail:
      "Kamu juga bisa klik langsung link t.me/finot_finance_bot dari halaman ini. FiNot juga tersedia di WhatsApp untuk kenyamananmu.",
  },
  {
    num: "02",
    title: "Catat Pengeluaran & Pemasukan",
    desc: 'Kirim pesan seperti "makan siang 35rb" atau "gajian 5jt". Bisa juga foto struk belanja atau kirim voice note.',
    detail:
      "AI secara otomatis mengenali jumlah, kategori (Makanan, Transport, Hiburan, dll), dan tanggal transaksi. Kamu tidak perlu memilih kategori secara manual.",
  },
  {
    num: "03",
    title: "FiNot Menganalisis Polamu",
    desc: "Di balik layar, AI kami menganalisis pola pengeluaranmu: mana yang rutin, mana yang impulsif, dan mana yang bisa dihemat.",
    detail:
      "Menggunakan GPT-4o Mini, FiNot membuat prediksi saldo, menghitung financial health score, dan menyiapkan insight yang personal untuk situasi keuanganmu.",
  },
  {
    num: "04",
    title: "Terima Insight yang Actionable",
    desc: "Dapatkan ringkasan harian, laporan mingguan setiap Senin, dan analisis mendalam setiap bulan — langsung di chatmu.",
    detail:
      "Setiap insight mencakup breakdown per kategori, perbandingan dengan periode sebelumnya, saran penghematan spesifik, dan proyeksi saldo ke depan.",
  },
];

const USE_CASES = [
  {
    title: "Mahasiswa",
    desc: "Pantau uang jajan bulanan dari orang tua. Tahu persis ke mana uang habis sebelum tanggal tua tiba. Paket Gratis cukup untuk budget mahasiswa.",
  },
  {
    title: "Freelancer",
    desc: "Track income dari berbagai klien dalam satu tempat. Pisahkan pengeluaran bisnis vs pribadi. Lihat tren pemasukan mingguan dan bulanan.",
  },
  {
    title: "Karyawan",
    desc: "Kelola gaji bulanan dengan cerdas. Monitor cicilan, tagihan rutin, dan progress tabungan. Prediksi apakah gaji cukup sampai tanggal gajian berikutnya.",
  },
];

export default function HowItWorks() {
  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 right-0 w-80 h-80 bg-navy-light/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
            4 Langkah Mudah
          </span>
          <h1 className="text-3xl lg:text-4xl font-bold">
            Mulai dalam{" "}
            <span className="text-white">
              30 Detik
            </span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Dari nol sampai punya insight keuangan — semua otomatis lewat satu chat.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-4xl mx-auto px-6 pb-10">
        <div className="relative">
          <div className="hidden lg:block absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/15 via-white/8 to-transparent" />
          <div className="space-y-8">
            {STEPS.map((step, idx) => (
              <div key={step.num} className="relative flex gap-6 items-start lg:pl-20">
                <div className="hidden lg:flex absolute left-0 w-16 h-16 rounded-2xl bg-card border border-border items-center justify-center">
                  <span className="text-xl font-bold text-white/70">{step.num}</span>
                </div>
                <div className="flex-1 bg-card border border-border rounded-2xl p-6 hover:border-white/15 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="lg:hidden w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <span className="text-sm font-bold text-white/70">{step.num}</span>
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-white/70 mb-2">{step.desc}</p>
                  <p className="text-sm text-white/40 leading-relaxed">{step.detail}</p>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronDownIcon
                    className="hidden lg:block absolute -bottom-5 left-7 w-5 h-5 text-white/20"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-border bg-navy-dark/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-3">FiNot Cocok untuk Siapa?</h2>
          <p className="text-center text-white/50 mb-10 max-w-md mx-auto">
            Siapapun yang ingin lebih tahu ke mana perginya setiap rupiah yang dihabiskan.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {USE_CASES.map((uc) => (
              <div
                key={uc.title}
                className="bg-card/60 border border-border rounded-2xl p-6 text-center hover:border-white/15 transition-colors"
              >
                <h3 className="font-semibold mb-2">{uc.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
