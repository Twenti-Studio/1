import {
    ArrowTrendingUpIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    LightBulbIcon,
    ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

const ICON_MAP = {
  shield: ShieldCheckIcon,
  trending: ArrowTrendingUpIcon,
  alert: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const COLOR_MAP = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400/10" },
  sky: { text: "text-sky-400", bg: "bg-sky-400/10" },
  amber: { text: "text-amber-400", bg: "bg-amber-400/10" },
  rose: { text: "text-rose-400", bg: "bg-rose-400/10" },
};

export default function AIInsight() {
  const { data: insightData, loading: insightLoading } = useDashboardAPI("/insight");
  const { data: dashData, loading: dashLoading } = useDashboardAPI("/dashboard");

  const loading = insightLoading || dashLoading;
  const insights = insightData?.insights || [];
  const updatedAt = insightData?.updated_at || "-";
  const todayIncome = dashData?.today?.income || 0;
  const todayExpense = dashData?.today?.expense || 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-orange/15 flex items-center justify-center">
          <LightBulbIcon className="w-4.5 h-4.5 text-orange" />
        </div>
        <div>
          <h2 className="text-base font-bold">Insight Hari Ini</h2>
          <p className="text-[0.7rem] text-white/40">
            Diperbarui: {updatedAt}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((item, i) => {
            const Icon = ICON_MAP[item.icon] || InformationCircleIcon;
            const colors = COLOR_MAP[item.color] || COLOR_MAP.sky;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/6 transition-colors"
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-4.5 h-4.5 ${colors.text}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
            ↑ Pemasukan Hari Ini
          </div>
          <p className="text-lg font-bold mt-1">
            Rp{todayIncome.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center gap-1 text-rose-400 text-xs font-medium">
            ↓ Pengeluaran Hari Ini
          </div>
          <p className="text-lg font-bold mt-1">
            Rp{todayExpense.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
}
