import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "Apa itu FiNot?",
    a: "FiNot adalah asisten keuangan berbasis AI yang bekerja melalui Telegram dan WhatsApp. Kamu cukup mengirim pesan chat biasa — seperti 'makan siang 35rb' — dan FiNot secara otomatis mencatat transaksimu, mengelompokkan ke kategori yang tepat, serta memberikan insight dan prediksi keuangan yang personal.",
  },
  {
    q: "Bagaimana cara mulai menggunakan FiNot?",
    a: "Sangat mudah! Buka Telegram, cari @finot_finance_bot, lalu tekan tombol START. Akunmu langsung aktif tanpa perlu registrasi, isi form, atau verifikasi email. Kamu bisa langsung mulai mencatat pengeluaran pertamamu dalam hitungan detik.",
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
    a: "Saat ini FiNot tersedia di Telegram dan sedang dalam tahap pengembangan untuk WhatsApp. Kami memilih platform chat karena kamu tidak perlu install aplikasi tambahan — cukup buka chat dan langsung pakai. Semua fitur identik di kedua platform.",
  },
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-navy-light/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center space-y-4">
          {/* <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
            <HelpCircle size={14} /> FAQ
          </span> */}
          <h1 className="text-3xl lg:text-4xl font-bold">
            Pertanyaan yang{" "}
            <span className="text-white">
              Sering Ditanyakan
            </span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Jawaban untuk hal-hal yang paling sering ditanyakan pengguna FiNot. Belum menemukan
            jawabanmu? Hubungi kami langsung.
          </p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className={`bg-card border rounded-2xl overflow-hidden transition-colors ${
                openIdx === idx ? "border-white/20" : "border-border"
              }`}
            >
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="flex items-center justify-between w-full px-5 py-4 text-left"
              >
                <span className="font-semibold text-sm pr-4">{faq.q}</span>
                <ChevronDownIcon
                  className={`w-4.5 h-4.5 text-white/40 shrink-0 transition-transform duration-300 ${
                    openIdx === idx ? "rotate-180 text-white" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIdx === idx ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-5 pb-4">
                  <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-navy-dark/40 text-center py-16 px-6">
        <h2 className="text-2xl font-bold mb-3">Masih Punya Pertanyaan?</h2>
        <p className="text-white/50 mb-6 max-w-md mx-auto">
          Langsung chat ke FiNot Bot — AI kami siap menjawab pertanyaanmu 24/7.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://t.me/finot_finance_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-transform"
          >
            Chat FiNot Bot
          </a>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/15 text-white font-medium hover:bg-white/5 transition-colors"
          >
            Lihat Paket Harga
          </Link>
        </div>
      </section>
    </div>
  );
}
