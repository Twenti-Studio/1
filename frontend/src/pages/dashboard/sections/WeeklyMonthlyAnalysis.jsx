import {
    CalendarDaysIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    SparklesIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

const Spinner = () => (
  <div className="w-5 h-5 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
);

const TABS = [
  { key: "weekly", label: "Mingguan", feature: "weekly_summary" },
  { key: "monthly", label: "Bulanan", feature: "monthly_analysis" },
];

export default function WeeklyMonthlyAnalysis({ features = {} }) {
  const [tab, setTab] = useState("weekly");
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentData = tab === "weekly" ? weeklyData : monthlyData;
  const hasAccess =
    tab === "weekly"
      ? features.weekly_summary
      : features.monthly_analysis;

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        tab === "weekly"
          ? "/api/user/ai/weekly-analysis"
          : "/api/user/ai/monthly-analysis";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 403 || res.status === 429) {
        const err = await res.json();
        setError(err.detail);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (tab === "weekly") setWeeklyData(json.data);
      else setMonthlyData(json.data);
    } catch {
      setError("Gagal memuat analisis");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const fmt = (v) => `Rp${(v || 0).toLocaleString("id-ID")}`;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <ChartBarIcon className="w-4.5 h-4.5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Analisis Mendalam AI</h2>
          <p className="text-[0.7rem] text-white/40">
            Analisis keuangan mendalam oleh AI
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              tab === t.key
                ? "border-violet-500 bg-violet-500/15 text-violet-400"
                : "border-border bg-white/3 text-white/50 hover:text-white hover:border-white/20"
            }`}
          >
            <CalendarDaysIcon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!currentData && !loading && !error && (
        <div className="text-center py-6">
          {hasAccess ? (
            <button
              onClick={fetchAnalysis}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-violet-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-200"
            >
              <SparklesIcon className="w-4 h-4" />
              Analisis {tab === "weekly" ? "Minggu Ini" : "Bulan Ini"}
            </button>
          ) : (
            <div className="text-white/30 text-sm">
              <ShieldCheckIcon className="w-8 h-8 mx-auto mb-2 text-white/20" />
              {tab === "monthly"
                ? "Fitur ini tersedia untuk paket Elite"
                : "Fitur ini tersedia untuk paket Trial / Pro / Elite"}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Spinner />
          <span className="text-sm text-white/50">
            AI sedang menganalisis data {tab === "weekly" ? "7" : "30"} hari...
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-sm text-rose-400">
          {error}
          <button
            onClick={fetchAnalysis}
            className="block mt-2 text-xs text-white/50 hover:text-white underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {currentData && !loading && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">Pemasukan</p>
              <p className="text-sm font-bold text-emerald-400">
                {fmt(currentData.total_income)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">Pengeluaran</p>
              <p className="text-sm font-bold text-rose-400">
                {fmt(currentData.total_expense)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
              <p className="text-[0.65rem] text-white/40 mb-1">Net</p>
              <p
                className={`text-sm font-bold ${
                  (currentData.net || currentData.net_income || 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {fmt(currentData.net || currentData.net_income)}
              </p>
            </div>
          </div>

          {/* Top categories */}
          {(currentData.top_categories || currentData.top_expense_categories) && (
            <div>
              <h3 className="text-xs font-semibold text-white/50 mb-2">
                Kategori Teratas
              </h3>
              <div className="space-y-1.5">
                {(
                  currentData.top_categories ||
                  currentData.top_expense_categories ||
                  []
                )
                  .slice(0, 5)
                  .map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/3"
                    >
                      <span className="text-xs text-white/70">
                        {c.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">
                          {c.percentage}%
                        </span>
                        <span className="text-xs font-semibold text-white/80">
                          {fmt(c.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Insight */}
          {(currentData.insight || currentData.deep_insight) && (
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
              <p className="text-sm text-white/80 leading-relaxed">
                {currentData.deep_insight || currentData.insight}
              </p>
            </div>
          )}

          {/* Action items */}
          {(currentData.action_items || currentData.priority_actions) && (
            <div>
              <h3 className="text-xs font-semibold text-amber-400 mb-2">
                Langkah Selanjutnya
              </h3>
              <ul className="space-y-1">
                {(
                  currentData.action_items ||
                  currentData.priority_actions ||
                  []
                ).map((item, i) => (
                  <li
                    key={i}
                    className="text-xs text-white/60 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400/40"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Forecast (monthly only) */}
          {currentData.forecast_next_month && (
            <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/15">
              <h3 className="text-xs font-semibold text-sky-400 mb-2">
                Prediksi Bulan Depan
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[0.6rem] text-white/40">Pemasukan</p>
                  <p className="text-xs font-bold text-emerald-400">
                    {fmt(currentData.forecast_next_month.predicted_income)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-white/40">Pengeluaran</p>
                  <p className="text-xs font-bold text-rose-400">
                    {fmt(currentData.forecast_next_month.predicted_expense)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-white/40">Tabungan</p>
                  <p className="text-xs font-bold text-sky-400">
                    {fmt(currentData.forecast_next_month.predicted_saving)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={fetchAnalysis}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            ↻ Analisis ulang
          </button>
        </div>
      )}
    </div>
  );
}
