import PlanStatus from "./sections/PlanStatus";
import SubscriptionHistory from "./sections/SubscriptionHistory";

export default function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Langganan</h1>
        <p className="text-white/50 text-sm mt-1">
          Kelola plan dan riwayat pembayaranmu.
        </p>
      </div>
      <PlanStatus />
      <SubscriptionHistory />
    </div>
  );
}
