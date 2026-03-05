import {
    BanknotesIcon,
    BoltIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    ChatBubbleLeftRightIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CreditCardIcon,
    ExclamationTriangleIcon,
    FireIcon,
    FlagIcon,
    LightBulbIcon,
    LockClosedIcon,
    SparklesIcon,
    SunIcon
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-white/20 border-t-orange rounded-full animate-spin" />
);

/**
 * All 20 AI features organized in a grid.
 * Each feature has: id, title, desc, icon, endpoint, method, bodyField, featureGate, planMin
 */
const AI_FEATURES = [
  // ── Pro features ────────────────
  {
    id: "anomaly",
    title: "Anomaly Detection",
    desc: "Deteksi pengeluaran tidak normal",
    icon: ExclamationTriangleIcon,
    endpoint: "/api/user/ai/anomaly-detection",
    gate: "daily_insight",
    tier: "pro",
  },
  {
    id: "overspending",
    title: "Overspending Alert",
    desc: "Peringatan kategori boros",
    icon: ExclamationTriangleIcon,
    endpoint: "/api/user/ai/overspending-alert",
    gate: "daily_insight",
    tier: "pro",
  },
  {
    id: "expense-limit",
    title: "Expense Limit",
    desc: "Batas pengeluaran harian",
    icon: BoltIcon,
    endpoint: "/api/user/ai/expense-limit",
    gate: "daily_insight",
    tier: "pro",
  },
  {
    id: "savings-opportunity",
    title: "Savings Opportunity",
    desc: "Mencari peluang hemat",
    icon: LightBulbIcon,
    endpoint: "/api/user/ai/savings-opportunity",
    gate: "daily_insight",
    tier: "pro",
  },
  {
    id: "weekly-strategy",
    title: "Weekly Strategy",
    desc: "Strategi keuangan mingguan",
    icon: FlagIcon,
    endpoint: "/api/user/ai/weekly-strategy",
    gate: "weekly_summary",
    tier: "pro",
  },
  // ── Elite features ──────────────
  {
    id: "burn-rate",
    title: "Burn Rate",
    desc: "Kecepatan uang habis",
    icon: FireIcon,
    endpoint: "/api/user/ai/burn-rate",
    gate: "advanced_tracking",
    tier: "elite",
  },
  {
    id: "budget-suggestion",
    title: "Smart Budget",
    desc: "Rekomendasi budget per kategori",
    icon: ChartBarIcon,
    endpoint: "/api/user/ai/budget-suggestion",
    gate: "advanced_tracking",
    tier: "elite",
  },
  {
    id: "subscription-detector",
    title: "Subscription Detector",
    desc: "Deteksi langganan otomatis",
    icon: CreditCardIcon,
    endpoint: "/api/user/ai/subscription-detector",
    gate: "advanced_tracking",
    tier: "elite",
  },
  {
    id: "goal-saving",
    title: "Goal-based Saving",
    desc: "Target tabungan",
    icon: FlagIcon,
    endpoint: "/api/user/ai/goal-saving",
    method: "POST",
    bodyField: "goal",
    placeholder: "Contoh: Laptop Rp10.000.000",
    gate: "forecast_3month",
    tier: "elite",
  },
  {
    id: "payday-planning",
    title: "Payday Planning",
    desc: "Perencanaan alokasi gaji",
    icon: BanknotesIcon,
    endpoint: "/api/user/ai/payday-planning",
    gate: "forecast_3month",
    tier: "elite",
  },
  {
    id: "weekend-pattern",
    title: "Weekend Pattern",
    desc: "Pola belanja akhir pekan",
    icon: SunIcon,
    endpoint: "/api/user/ai/weekend-pattern",
    gate: "advanced_tracking",
    tier: "elite",
  },
  {
    id: "expense-prediction",
    title: "Expense Prediction",
    desc: "Prediksi pengeluaran bulan ini",
    icon: CalendarDaysIcon,
    endpoint: "/api/user/ai/expense-prediction",
    gate: "forecast_3month",
    tier: "elite",
  },
  {
    id: "ai-chat",
    title: "AI Financial Chat",
    desc: "Tanya jawab keuangan",
    icon: ChatBubbleLeftRightIcon,
    method: "POST",
    bodyField: "question",
    placeholder: "Kenapa uangku cepat habis bulan ini?",
    endpoint: "/api/user/ai/chat",
    gate: "priority_ai",
    tier: "elite",
  },
];

const fmt = (v) => `Rp${(v || 0).toLocaleString("id-ID")}`;

function FeatureCard({ feature, features, plan }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const hasAccess = plan === "trial" || plan === "elite" ||
    (plan === "pro" && feature.tier === "pro") ||
    features[feature.gate];

  const Icon = feature.icon;

  const fetchFeature = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts = { credentials: "include" };
      let url = feature.endpoint;

      if (feature.method === "POST") {
        opts.method = "POST";
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify({
          [feature.bodyField]: inputValue || feature.placeholder,
        });
      }

      const res = await fetch(url, opts);
      if (res.status === 403) {
        setError("Fitur ini memerlukan upgrade paket.");
        return;
      }
      if (res.status === 429) {
        setError("Kredit AI habis. Tunggu refill atau upgrade.");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
      setExpanded(true);
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [feature, inputValue]);

  const tierColors = {
    pro: "bg-sky-500/15 text-sky-400",
    elite: "bg-violet-500/15 text-violet-400",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tierColors[feature.tier] || "bg-orange/15 text-orange"}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{feature.title}</h3>
            <p className="text-[0.65rem] text-white/40">{feature.desc}</p>
          </div>
        </div>
        <span className={`text-[0.6rem] font-medium px-1.5 py-0.5 rounded shrink-0 ${
          feature.tier === "elite" ? "bg-violet-500/10 text-violet-400" : "bg-sky-500/10 text-sky-400"
        }`}>
          {feature.tier.toUpperCase()}
        </span>
      </div>

      {/* Input field for POST features */}
      {feature.method === "POST" && hasAccess && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={feature.placeholder}
          className="w-full mt-3 px-3 py-1.5 text-xs bg-navy border border-border rounded-lg focus:border-orange/40 focus:outline-none placeholder-white/25"
        />
      )}

      {/* Generate button */}
      <div className="mt-3">
        {!hasAccess ? (
          <div className="flex items-center gap-1.5 text-white/30 text-xs">
            <LockClosedIcon className="w-3.5 h-3.5" />
            <span>Upgrade ke {feature.tier === "elite" ? "Elite" : "Pro"}</span>
          </div>
        ) : (
          <button
            onClick={fetchFeature}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-orange hover:text-orange/80 disabled:text-white/30 transition-colors"
          >
            {loading ? (
              <Spinner />
            ) : (
              <SparklesIcon className="w-3.5 h-3.5" />
            )}
            {loading ? "Menganalisis..." : data ? "Generate Ulang" : "Analisis AI"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {/* Result display */}
      {data && expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 text-[0.65rem] text-white/40 hover:text-white/60 mb-2"
          >
            <ChevronUpIcon className="w-3 h-3" />
            <span>Tutup</span>
          </button>
          <ResultDisplay featureId={feature.id} data={data} />
        </div>
      )}
      {data && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 flex items-center gap-1 text-[0.65rem] text-white/40 hover:text-white/60"
        >
          <ChevronDownIcon className="w-3 h-3" />
          <span>Lihat hasil</span>
        </button>
      )}
    </div>
  );
}

/** Render result based on feature type */
function ResultDisplay({ data }) {
  if (!data) return null;

  // Generic key-value renderer for any data
  const renderKV = (obj) => {
    return Object.entries(obj).map(([key, val]) => {
      if (key === "error" || key === "raw") return null;
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        return (
          <div key={key} className="mt-2">
            <p className="text-[0.65rem] text-white/40 font-medium uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
            <div className="pl-2 border-l border-border mt-1">
              {renderKV(val)}
            </div>
          </div>
        );
      }
      if (Array.isArray(val)) {
        return (
          <div key={key} className="mt-2">
            <p className="text-[0.65rem] text-white/40 font-medium uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
            <ul className="mt-1 space-y-0.5">
              {val.map((item, i) => (
                <li key={i} className="text-xs text-white/70">
                  {typeof item === "string" ? (
                    <span>• {item}</span>
                  ) : typeof item === "object" ? (
                    <div className="pl-2 border-l border-border py-1">
                      {Object.entries(item).map(([k, v]) => (
                        <p key={k} className="text-xs">
                          <span className="text-white/40">{k.replace(/_/g, " ")}:</span>{" "}
                          <span className="text-white/80">
                            {typeof v === "number" ? fmt(v) : String(v)}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <span>• {String(item)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      // Simple value
      const displayVal = typeof val === "number" && val > 1000 ? fmt(val) : String(val);
      return (
        <p key={key} className="text-xs py-0.5">
          <span className="text-white/40">{key.replace(/_/g, " ")}:</span>{" "}
          <span className="text-white/80 font-medium">{displayVal}</span>
        </p>
      );
    });
  };

  // Feature-specific renderers for key fields
  const explanation = data.explanation || data.answer || data.deep_insight || data.strategy || data.insight || data.suggestion || data.top_tip;
  const hasSpecificText = !!explanation;

  return (
    <div className="space-y-1">
      {/* Highlight the main text field */}
      {hasSpecificText && (
        <div className="bg-navy rounded-lg p-3 mb-2">
          <p className="text-xs text-white/80 leading-relaxed">{explanation}</p>
        </div>
      )}
      {/* Render the rest */}
      <div className="text-xs space-y-0.5">
        {renderKV(
          Object.fromEntries(
            Object.entries(data).filter(
              ([k]) => !["explanation", "answer", "deep_insight", "strategy", "insight", "suggestion", "top_tip", "error", "raw"].includes(k)
            )
          )
        )}
      </div>
    </div>
  );
}

export default function AIToolsPanel({ features = {}, plan = "free" }) {
  const [showAll, setShowAll] = useState(false);

  // Split into pro and elite features
  const proFeatures = AI_FEATURES.filter((f) => f.tier === "pro");
  const eliteFeatures = AI_FEATURES.filter((f) => f.tier === "elite");

  // Show first 4 by default, all when expanded
  const visiblePro = showAll ? proFeatures : proFeatures.slice(0, 3);
  const visibleElite = showAll ? eliteFeatures : eliteFeatures.slice(0, 3);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange/15 flex items-center justify-center">
            <SparklesIcon className="w-4.5 h-4.5 text-orange" />
          </div>
          <div>
            <h2 className="text-base font-bold">AI Tools</h2>
            <p className="text-[0.7rem] text-white/40">
              {AI_FEATURES.length} fitur AI tersedia
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-orange hover:text-orange/80 transition-colors"
        >
          {showAll ? "Lebih sedikit" : "Lihat semua"}
        </button>
      </div>

      {/* Pro Features */}
      <div className="mb-4">
        <p className="text-[0.65rem] text-sky-400 font-semibold uppercase tracking-wider mb-2">
          Pro Features
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visiblePro.map((f) => (
            <FeatureCard key={f.id} feature={f} features={features} plan={plan} />
          ))}
        </div>
      </div>

      {/* Elite Features */}
      <div>
        <p className="text-[0.65rem] text-violet-400 font-semibold uppercase tracking-wider mb-2">
          Elite Features
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleElite.map((f) => (
            <FeatureCard key={f.id} feature={f} features={features} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
