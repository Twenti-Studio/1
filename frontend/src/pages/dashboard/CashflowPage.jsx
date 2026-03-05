import CashflowTrend from "./sections/CashflowTrend";
import SpendingBreakdown from "./sections/SpendingBreakdown";

export default function CashflowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Cashflow</h1>
        <p className="text-white/50 text-sm mt-1">
          Pantau arus uang masuk dan keluarmu.
        </p>
      </div>
      <SpendingBreakdown />
      <CashflowTrend />
    </div>
  );
}
