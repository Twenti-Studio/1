import { ArrowPathIcon, BoltIcon, CalendarDaysIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

export default function PlanStatus({ dashboardData }) {
  // If parent already fetched, reuse; otherwise fetch here
  const { data: fetchedData, loading } = useDashboardAPI("/dashboard", {
    skip: !!dashboardData,
  });
  const data = dashboardData || fetchedData;
  const ps = data?.plan_status;

  if (loading && !ps) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const plan = ps?.plan || "free";
  const creditsUsed = ps?.credits_used || 0;
  const creditsTotal = ps?.credits_total || 0;
  const creditsRemaining = ps?.credits_remaining || 0;
  const refillDate = ps?.refill_date || "-";
  const expiryDate = ps?.expiry_date || "-";
  const creditPercent = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <CreditCardIcon className="w-4.5 h-4.5 text-violet-400" />
        </div>
        <h2 className="text-base font-bold">Plan & Kredit</h2>
      </div>

      {/* Plan badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="px-3 py-1.5 bg-linear-to-r from-orange to-orange-dark text-white text-sm font-bold rounded-lg capitalize">
          {plan}
        </span>
        <span className="text-xs text-white/40">Aktif</span>
      </div>

      {/* Credit bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/60 flex items-center gap-1">
            <BoltIcon className="w-3 h-3 text-amber-400" /> Kredit Tersisa
          </span>
          <span className="font-semibold">
            {creditsRemaining}/{creditsTotal}
          </span>
        </div>
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-orange to-amber-400 transition-all duration-500"
            style={{ width: `${creditPercent}%` }}
          />
        </div>
        <p className="text-[0.65rem] text-white/30 mt-1">
          {creditsUsed} kredit digunakan periode ini
        </p>
      </div>

      {/* Dates */}
      <div className="space-y-2 mt-auto">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/3">
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <ArrowPathIcon className="w-3.5 h-3.5" /> Refill Kredit
          </span>
          <span className="text-xs font-semibold">{refillDate}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/3">
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <CalendarDaysIcon className="w-3.5 h-3.5" /> Berakhir
          </span>
          <span className="text-xs font-semibold">{expiryDate || "∞"}</span>
        </div>
      </div>
    </div>
  );
}
