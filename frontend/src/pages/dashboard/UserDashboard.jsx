import TrialBanner from "../../components/TrialBanner";
import { useDashboardAPI } from "../../hooks/useDashboardAPI";
import AIInsight from "./sections/AIInsight";
import AIToolsPanel from "./sections/AIToolsPanel";
import BalancePrediction from "./sections/BalancePrediction";
import CashflowTrend from "./sections/CashflowTrend";
import HealthScore from "./sections/HealthScore";
import PlanStatus from "./sections/PlanStatus";
import Recommendation from "./sections/Recommendation";
import Simulation from "./sections/Simulation";
import SpendingBreakdown from "./sections/SpendingBreakdown";
import SubscriptionHistory from "./sections/SubscriptionHistory";
import WeeklyMonthlyAnalysis from "./sections/WeeklyMonthlyAnalysis";

export default function UserDashboard() {
  const { data } = useDashboardAPI("/dashboard");
  const name = data?.user?.display_name || data?.user?.username || "User";
  const plan = data?.user?.plan || "free";
  const trialDaysLeft = data?.user?.trial_days_left;
  const features = data?.features || {};
  const hasAccess = plan !== "free";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Halo, <span className="text-orange">{name}</span> 👋
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Ini ringkasan keuanganmu hari ini.
        </p>
      </div>

      {/* Trial / Upgrade Banner */}
      <TrialBanner plan={plan} trialDaysLeft={trialDaysLeft} />

      {/* Row 1: AI Insight (with income/expense) + Plan Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIInsight />
        </div>
        <div>
          <PlanStatus dashboardData={data} />
        </div>
      </div>

      {/* Row 2: AI Recommendation (below insight/income-expense) */}
      <Recommendation dashboardData={data} />

      {/* Row 3: Balance Prediction + Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BalancePrediction hasAccess={hasAccess} />
        <HealthScore />
      </div>

      {/* Row 4: Spending */}
      <SpendingBreakdown />

      {/* Row 5: Cashflow */}
      <CashflowTrend />

      {/* Row 6: Weekly/Monthly AI Analysis */}
      <WeeklyMonthlyAnalysis features={features} />

      {/* Row 7: AI Tools Panel (13 additional AI features) */}
      <AIToolsPanel features={features} plan={plan} />

      {/* Row 8: Simulation */}
      <Simulation hasAccess={hasAccess} />

      {/* Row 9: Subscription History */}
      <SubscriptionHistory />
    </div>
  );
}
