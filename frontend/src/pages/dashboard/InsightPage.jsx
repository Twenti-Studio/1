import AIInsight from "./sections/AIInsight";
import HealthScore from "./sections/HealthScore";

export default function InsightPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">AI Insight</h1>
        <p className="text-white/50 text-sm mt-1">
          Analisis keuangan cerdas dari FiNot AI.
        </p>
      </div>
      <AIInsight />
      <HealthScore />
    </div>
  );
}
