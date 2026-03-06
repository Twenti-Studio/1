import { ArrowTopRightOnSquareIcon, CodeBracketIcon, HeartIcon, LightBulbIcon, ShieldCheckIcon, UsersIcon } from "@heroicons/react/24/outline";
import Logo from "../components/Logo";

const VALUES = [
  {
    icon: LightBulbIcon,
    title: "Simplicity First",
    desc: "Keuangan tidak harus rumit. Kami percaya bahwa mencatat pengeluaran harus semudah mengirim pesan ke teman.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Privasi & Keamanan",
    desc: "Data keuanganmu adalah milikmu. Kami tidak pernah membagikan, menjual, atau menggunakan data penggunamu untuk keperluan selain meningkatkan layanan FiNot.",
  },
  {
    icon: UsersIcon,
    title: "Untuk Semua Orang",
    desc: "FiNot dirancang untuk semua orang — dari mahasiswa yang baru belajar mengelola uang jajan hingga pekerja profesional yang ingin mengoptimalkan keuangan.",
  },
  {
    icon: HeartIcon,
    title: "Berbasis Kebutuhan Nyata",
    desc: "Setiap fitur kami bangun berdasarkan kebutuhan nyata pengguna Indonesia. Kami mendengarkan feedback dan terus berinovasi untuk memberikan pengalaman terbaik.",
  },
];

const TECH = [
  "FastAPI (Python)",
  "GPT-4o Mini",
  "Tesseract OCR",
  "Prisma ORM",
  "React + Vite",
  "Railway Cloud",
];

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-navy-light/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center space-y-6">
          <Logo className="h-16 w-auto mx-auto" glow />
          <h1 className="text-3xl lg:text-4xl font-bold">
            Tentang{" "}
            <span className="text-white">
              FiNot
            </span>
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-lg">
            FiNot lahir dari satu pertanyaan sederhana:{" "}
            <em className="text-white/70">
              &ldquo;Kenapa mencatat keuangan harus ribet?&rdquo;
            </em>
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-card border border-border rounded-3xl p-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-white/60" /> Misi Kami
          </h2>
          <p className="text-white/60 leading-relaxed">
            Sebagian besar orang Indonesia tahu bahwa mencatat keuangan itu penting — tapi kebanyakan berhenti
            dalam minggu pertama karena prosesnya membosankan. Buka aplikasi, isi form, pilih kategori,
            masukkan nominal... setiap hari. Tidak heran banyak yang menyerah.
          </p>
          <p className="text-white/60 leading-relaxed">
            FiNot mengubah pendekatan ini secara radikal. Alih-alih memaksa pengguna beradaptasi dengan
            aplikasi, kami membawa pencatatan keuangan ke tempat yang sudah pengguna pakai setiap hari:
            <span className="text-white font-medium"> chat</span>. Cukup ketik seperti biasa, kirim foto
            struk, atau kirim voice note — dan AI kami mengurus sisanya.
          </p>
          <p className="text-white/60 leading-relaxed">
            Misi kami adalah membuat <span className="text-white font-medium">setiap orang Indonesia</span> bisa
            mengelola keuangannya dengan mudah — tanpa perlu jadi ahli keuangan, tanpa aplikasi tambahan,
            dan tanpa effort ekstra.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-border bg-navy-dark/40 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-10">Yang Kami Pegang Teguh</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="bg-card/60 border border-border rounded-2xl p-6 hover:border-white/15 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <v.icon className="w-5.5 h-5.5 text-white/60" />
                </div>
                <h3 className="font-semibold mb-1">{v.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <CodeBracketIcon className="w-7 h-7 text-white/50 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Dibangun dengan Teknologi Modern</h2>
          <p className="text-white/50 text-sm">
            Infrastruktur yang andal untuk memastikan pengalaman terbaik.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {TECH.map((t) => (
            <span
              key={t}
              className="px-4 py-2 bg-card border border-border rounded-xl text-sm text-white/60 hover:border-white/20 transition-colors"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Twenti Studio */}
      <section className="border-t border-border bg-navy-dark/40 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-4">
          <h2 className="text-xl font-bold">
            Dikembangkan oleh{" "}
            <span className="text-white">
              Twenti Studio
            </span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Twenti Studio adalah studio pengembangan software berbasis di Indonesia yang berfokus pada
            produk AI dan otomasi. FiNot adalah flagship produk kami — diciptakan dengan passion untuk
            membantu setiap orang mengelola keuangan dengan lebih cerdas.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <a
              href="https://t.me/finot_finance_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white text-sm font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-transform"
            >
              Coba FiNot <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
