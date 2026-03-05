import { SparklesIcon } from "@heroicons/react/24/outline";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

export default function Recommendation() {
  const { data, loading } = useDashboardAPI("/recommendation");

  const recommendation = data?.recommendation;
  const balance = data?.balance ?? 0;
  const income = data?.this_month?.income ?? 0;
  const expense = data?.this_month?.expense ?? 0;

  const fmt = (v) =>
    v < 0
      ? `-Rp${Math.abs(v).toLocaleString("id-ID")}`
      : `Rp${v.toLocaleString("id-ID")}`;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <SparklesIcon className="w-4.5 h-4.5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Rekomendasi Keuangan</h2>
          <p className="text-[0.7rem] text-white/40">
            Analisis AI berdasarkan data transaksi 30 hari terakhir
          </p>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Saldo</p>
          <p
            className={`text-sm font-bold ${
              balance >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {fmt(balance)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Pemasukan</p>
          <p className="text-sm font-bold text-sky-400">{fmt(income)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Pengeluaran</p>
          <p className="text-sm font-bold text-orange">{fmt(expense)}</p>
        </div>
      </div>

      {/* Recommendation paragraph */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : recommendation ? (
        <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
          <p className="text-sm text-white/80 leading-relaxed">{recommendation}</p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/3 border border-border">
          <p className="text-sm text-white/40">
            Belum ada data yang cukup untuk memberikan rekomendasi. Mulai catat
            transaksimu lewat bot Telegram.
          </p>
        </div>
      )}
    </div>
  );
}
