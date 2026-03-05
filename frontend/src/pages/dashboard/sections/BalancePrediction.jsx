import {
    ClockIcon,
    ShieldCheckIcon,
    SparklesIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

const Spinner = () => (
  <div className="w-5 h-5 border-2 border-white/20 border-t-sky-400 rounded-full animate-spin" />
);

export default function BalancePrediction({ hasAccess = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/ai/balance-prediction", {
        credentials: "include",
      });
      if (res.status === 403 || res.status === 429) {
        const err = await res.json();
        setError(err.detail);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setError("Gagal memuat prediksi saldo");
    } finally {
      setLoading(false);
    }
  }, []);

  const fmt = (v) => `Rp${(v || 0).toLocaleString("id-ID")}`;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
          <ClockIcon className="w-4.5 h-4.5 text-sky-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Prediksi Umur Saldo</h2>
          <p className="text-[0.7rem] text-white/40">
            AI memprediksi berapa lama saldomu bertahan
          </p>
        </div>
      </div>

      {!data && !loading && !error && (
        <div className="text-center py-6">
          {hasAccess ? (
            <button
              onClick={fetchPrediction}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-sky-500 to-sky-600 text-white text-sm font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/20 transition-all duration-200"
            >
              <SparklesIcon className="w-4 h-4" /> Analisis Saldo AI
            </button>
          ) : (
            <div className="text-white/30 text-sm">
              <ShieldCheckIcon className="w-8 h-8 mx-auto mb-2 text-white/20" />
              Fitur ini tersedia untuk paket Trial / Pro / Elite
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Spinner />
          <span className="text-sm text-white/50">AI sedang menganalisis...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-sm text-rose-400">
          {error}
          <button
            onClick={fetchPrediction}
            className="block mt-2 text-xs text-white/50 hover:text-white underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">
                Rata-rata Pengeluaran/Hari
              </p>
              <p className="text-sm font-bold text-rose-400">
                {fmt(data.daily_avg_expense)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">
                Rata-rata Pemasukan/Hari
              </p>
              <p className="text-sm font-bold text-emerald-400">
                {fmt(data.daily_avg_income)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">
                Saldo Bertahan
              </p>
              <p className="text-sm font-bold text-sky-400">
                {data.predicted_days || 0} hari
              </p>
            </div>
          </div>

          {data.explanation && (
            <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/15">
              <p className="text-sm text-white/80 leading-relaxed">
                {data.explanation}
              </p>
            </div>
          )}

          <button
            onClick={fetchPrediction}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            ↻ Analisis ulang
          </button>
        </div>
      )}
    </div>
  );
}
