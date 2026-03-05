import { ChartPieIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
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

function formatRp(v) {
  return `Rp${(v / 1000).toFixed(0)}rb`;
}

export default function SpendingBreakdown() {
  const [view, setView] = useState("pie"); // pie | bar
  const { data, loading } = useDashboardAPI("/spending");

  const categories = data?.categories || [];
  const total = data?.total || categories.reduce((a, b) => a + b.value, 0);

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <ChartPieIcon className="w-4.5 h-4.5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-bold">Spending Breakdown</h2>
            <p className="text-[0.7rem] text-white/40">Bulan ini</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-white/30 text-sm">
          Belum ada data pengeluaran bulan ini
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
            {categories.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/3"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: d.color }}
                />
                <div className="min-w-0">
                  <p className="text-[0.65rem] text-white/40 truncate">{d.name}</p>
                  <p className="text-xs font-semibold">
                    Rp{d.value.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
