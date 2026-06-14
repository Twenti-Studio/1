import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "Apa itu FiNot?",
    a: "FiNot adalah asisten keuangan berbasis AI. Kamu pakai langsung lewat aplikasi chat di browser (web app FiNot) — cukup daftar akun dan langsung mulai. Kalau mau, akunmu juga bisa dihubungkan ke Telegram dari dalam app supaya bisa catat transaksi dari sana. Cukup kirim pesan chat biasa — seperti 'makan siang 35rb' — dan FiNot otomatis mencatat transaksimu, mengelompokkan ke kategori yang tepat, serta memberi insight dan prediksi keuangan personal.",
  },
  {
    q: "Bagaimana cara mulai menggunakan FiNot?",
    a: "Klik tombol 'Mulai Gratis' di halaman ini, daftar dengan username & password, dan kamu langsung masuk ke chat app FiNot. Tanpa verifikasi email yang ribet. Setelah masuk, kalau ingin pakai dari Telegram, buka menu Pengaturan → Linked Accounts dan hubungkan Telegram-mu — riwayat chat akan tersinkron otomatis di kedua tempat.",
  },
  {
    q: "Apakah FiNot benar-benar gratis?",
    a: "Ya! Paket Gratis memperbolehkan kamu mencatat hingga 5 transaksi per hari lewat chat, menikmati kategorisasi otomatis, prediksi saldo, dan simulasi tabungan — semuanya gratis selamanya. Jika butuh fitur lebih seperti scan struk OCR, voice note, dan analisis AI harian, kamu bisa upgrade ke Pro (Rp19.000/bulan) atau Elite (Rp49.000/bulan).",
  },
  {
    q: "Apa bedanya paket Pro dan Elite?",
    a: "Paket Pro cocok untuk kebanyakan pengguna: unlimited pencatatan text, OCR struk 10x/hari, voice note 10x/hari, daily insight, weekly summary, dan Financial Health Score. Elite menambahkan unlimited OCR & voice note, monthly deep analysis dengan perbandingan 3 bulan, proyeksi bulan depan, action plan personal, dan priority support dengan respon kurang dari 1 jam.",
  },
  {
    q: "Bagaimana cara membayar?",
    a: "Semua pembayaran menggunakan QRIS — yang berarti kamu bisa bayar lewat GoPay, OVO, DANA, ShopeePay, LinkAja, atau mobile banking apapun yang mendukung QRIS. Setelah memilih paket dan memasukkan username kamu, akan muncul QR code yang tinggal kamu scan. Pembayaran terverifikasi otomatis dalam hitungan detik.",
  },
  {
    q: "Apakah data keuangan saya aman?",
    a: "Sangat aman. Seluruh data transaksimu dienkripsi saat transit dan saat disimpan. Kami tidak pernah membaca, membagikan, atau menjual data penggunamu ke pihak manapun. Server kami diamankan dengan standar keamanan terkini. Kamu juga bisa menghapus seluruh datamu kapan saja dengan mengirim perintah ke bot.",
  },
  {
    q: "Bisa kirim foto struk belanja?",
    a: "Bisa! Fitur Scan Struk menggunakan teknologi OCR + AI untuk membaca struk belanja dari minimarket, restoran, atau toko online. AI membaca setiap item, menghitung total, dan mencatat semuanya dalam hitungan detik dengan akurasi hingga 99%. Fitur ini tersedia untuk pengguna Pro (10x/hari) dan Elite (unlimited).",
  },
  {
    q: "Apakah bisa voice note?",
    a: "Tentu! Terlalu sibuk mengetik? Kirim voice note seperti \"beli bensin lima puluh ribu\" — AI mengenali ucapanmu, mengekstrak jumlah dan kategori, lalu mencatatnya otomatis. Tersedia untuk Pro (10x/hari) dan Elite (unlimited).",
  },
  {
    q: "Bisa berhenti berlangganan kapan saja?",
    a: "Tentu! Tidak ada kontrak atau commitment jangka panjang. Kamu bisa berhenti kapan saja. Fitur premium tetap aktif sampai periode berlangganan yang sudah dibayar berakhir. Setelah itu, akunmu kembali ke paket Gratis tanpa kehilangan data transaksi.",
  },
  {
    q: "FiNot tersedia di platform apa saja?",
    a: "FiNot berjalan sebagai web app yang bisa kamu buka langsung di browser (dan dipasang sebagai PWA di HP). Selain itu, akunmu bisa dihubungkan ke Telegram dari dalam app supaya bisa catat transaksi dari sana juga — semua tersinkron. Integrasi WhatsApp sedang dalam pengembangan.",
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

export default function Faq() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div>
      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-5">
        <div className="flex justify-center">
          <Eyebrow>Pertanyaan umum</Eyebrow>
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-semibold text-cream leading-tight">
          Yang sering <span className="text-credit">ditanyakan.</span>
        </h1>
        <p className="text-fog max-w-xl mx-auto leading-relaxed">
          Jawaban untuk hal-hal yang paling sering ditanyakan pengguna FiNot. Belum
          menemukan jawabanmu? Langsung chat ke FiNot.
        </p>
      </section>

      {/* Accordion */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="border-t border-ledger-line">
          {FAQS.map((faq, idx) => {
            const open = openIdx === idx;
            return (
              <div key={idx} className="border-b border-ledger-line">
                <button
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="flex items-center gap-4 w-full py-4 text-left group"
                  aria-expanded={open}
                >
                  <span className="font-mono text-[0.7rem] text-credit tnum pt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className={`flex-1 font-medium text-[0.95rem] transition-colors ${open ? "text-cream" : "text-cream/85 group-hover:text-cream"}`}>
                    {faq.q}
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-fog shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-credit" : ""}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[30rem] opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <p className="text-sm text-fog leading-relaxed pb-5 pl-9 pr-6">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-ink-soft border border-moss/40 rounded-3xl px-8 py-12 text-center space-y-4">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold text-cream">
            Masih punya pertanyaan?
          </h2>
          <p className="text-fog max-w-md mx-auto leading-relaxed">
            Langsung chat ke FiNot — AI kami siap menjawab 24/7.
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
              Lihat paket harga →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
