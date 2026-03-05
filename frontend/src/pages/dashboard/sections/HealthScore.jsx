import { ArrowDownIcon, ArrowUpIcon, HeartIcon } from "@heroicons/react/24/outline";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

function getScoreColor(score) {
  if (score >= 80) return { ring: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5", label: "Sangat Baik" };
  if (score >= 60) return { ring: "text-sky-400", bg: "from-sky-500/20 to-sky-500/5", label: "Baik" };
  if (score >= 40) return { ring: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5", label: "Cukup" };
  return { ring: "text-rose-400", bg: "from-rose-500/20 to-rose-500/5", label: "Perlu Perhatian" };
}

export default function HealthScore() {
  const { data, loading } = useDashboardAPI("/health-score");

  const score = data?.score ?? 0;
  const label = data?.label || "-";
  const strengths = data?.strengths || [];
  const improvements = data?.improvements || [];

  const info = getScoreColor(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
          <HeartIcon className="w-4.5 h-4.5 text-rose-400" />
        </div>
        <h2 className="text-base font-bold">Financial Health Score</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Circular gauge */}
          <div className="relative shrink-0">
            <svg width="136" height="136" className="-rotate-90">
              <circle
                cx="68"
                cy="68"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
              />
              <circle
                cx="68"
                cy="68"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={`${info.ring} transition-all duration-1000`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
              <span className="text-3xl font-black">{score}</span>
              <span className={`text-xs font-semibold ${info.ring}`}>
                {label}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3 w-full">
            <div>
              <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mb-1.5">
                <ArrowUpIcon className="w-3.5 h-3.5" /> Kekuatan
              </h3>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-white/60 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-emerald-400/40"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-1.5">
                <ArrowDownIcon className="w-3.5 h-3.5" /> Perlu Ditingkatkan
              </h3>
              <ul className="space-y-1">
                {improvements.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-white/60 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400/40"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
