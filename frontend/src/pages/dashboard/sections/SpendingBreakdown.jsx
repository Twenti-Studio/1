import { ChartPieIcon, EllipsisHorizontalIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

const UNCATEGORIZED = "tidak terkategori";

const PERIODS = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
];

function formatRp(v) {
  return `Rp${(v / 1000).toFixed(0)}rb`;
}

function isUncategorized(name) {
  return (name || "").trim().toLowerCase() === UNCATEGORIZED;
}

export default function SpendingBreakdown() {
  const [view, setView] = useState("pie"); // pie | bar
  const [period, setPeriod] = useState("monthly"); // daily | weekly | monthly
  const [openDetails, setOpenDetails] = useState(false);
  const detailsRef = useRef(null);

  const { data, loading, error, refetch } = useDashboardAPI("/spending", {
    params: { period },
  });

  const categories = data?.categories || [];
  const total = data?.total || categories.reduce((a, b) => a + b.value, 0);
  const periodLabel =
    data?.period_label ||
    PERIODS.find((p) => p.key === period)?.label ||
    "Bulan ini";

  // Close the details popover on outside click.
  useEffect(() => {
    if (!openDetails) return;
    function onClick(e) {
      if (detailsRef.current && !detailsRef.current.contains(e.target)) {
        setOpenDetails(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openDetails]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-navy-dark border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs font-semibold" style={{ color: d.payload.color }}>
          {d.name}
        </p>
        <p className="text-sm font-bold text-white">
          Rp{d.value.toLocaleString("id-ID")}
        </p>
        <p className="text-[0.65rem] text-white/40">
          {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}% dari total
        </p>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <ChartPieIcon className="w-4.5 h-4.5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-bold">Spending Breakdown</h2>
            <p className="text-[0.7rem] text-white/40">{periodLabel}</p>
          </div>
        </div>
        <div className="flex bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setView("pie")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              view === "pie"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Pie
          </button>
          <button
            onClick={() => setView("bar")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              view === "bar"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {/* Period filter: daily / weekly / monthly */}
      <div className="flex bg-white/5 rounded-lg p-0.5 mb-4 w-full sm:w-auto sm:inline-flex">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPeriod(p.key);
              setOpenDetails(false);
            }}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              period === p.key
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-amber-400/70 mb-2" />
          <p className="text-sm text-white/60">Gagal memuat data pengeluaran.</p>
          <p className="text-[0.7rem] text-white/30 mt-1">{error}</p>
          <button
            onClick={refetch}
            className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/15 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-white/30 text-sm text-center px-4">
          Belum ada data pengeluaran untuk periode ini
        </div>
      ) : (
        <>
          <div className="h-64 sm:h-72">
            {view === "pie" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {categories.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-white/60">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} barCategoryGap="20%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatRp}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {categories.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category list */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {categories.map((d, i) => {
              const uncat = isUncategorized(d.name);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/3 relative"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: d.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] text-white/40 truncate">{d.name}</p>
                    <p className="text-xs font-semibold">
                      Rp{d.value.toLocaleString("id-ID")}
                    </p>
                  </div>

                  {/* 3-dot menu only for 'tidak terkategori' */}
                  {uncat && d.details?.length > 0 && (
                    <div className="relative" ref={detailsRef}>
                      <button
                        type="button"
                        onClick={() => setOpenDetails((v) => !v)}
                        aria-label="Lihat rincian tidak terkategori"
                        className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                      </button>

                      {openDetails && (
                        <div className="absolute right-0 z-20 mt-1 w-64 max-w-[80vw] rounded-xl border border-border bg-navy-dark shadow-2xl p-3">
                          <p className="text-[0.7rem] font-semibold text-white/70 mb-2">
                            Rincian &quot;tidak terkategori&quot;
                          </p>
                          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                            {d.details.map((item, j) => (
                              <div
                                key={j}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-white/70 truncate flex-1">
                                  {item.label}
                                </span>
                                <span className="text-white/90 font-medium shrink-0">
                                  Rp{item.amount.toLocaleString("id-ID")}
                                </span>
                                <span className="text-[0.65rem] text-white/40 shrink-0 w-10 text-right">
                                  {item.percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[0.7rem]">
                            <span className="text-white/40">Total kategori ini</span>
                            <span className="text-white/80 font-semibold">
                              {d.percentage}% dari total
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
