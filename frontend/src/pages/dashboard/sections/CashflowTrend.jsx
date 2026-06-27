import { ArrowTrendingUpIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

const PERIOD_MAP = { harian: "daily", mingguan: "weekly", bulanan: "monthly" };
const PERIODS = ["harian", "mingguan", "bulanan"];

function formatRp(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
  return `${(v / 1000).toFixed(0)}rb`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-dark border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-white/70 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-white/50">{p.name}:</span>
          <span className="font-semibold text-white">
            Rp{p.value.toLocaleString("id-ID")}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function CashflowTrend() {
  const [period, setPeriod] = useState("mingguan");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/user/cashflow?period=${PERIOD_MAP[period]}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Sesi berakhir, silakan login ulang"
            : `Gagal memuat data (error ${res.status})`
        );
      }
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data cashflow");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <ArrowTrendingUpIcon className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold">Cashflow Trend</h2>
            <p className="text-[0.7rem] text-white/40">
              Pemasukan vs Pengeluaran
            </p>
          </div>
        </div>

        <div className="flex bg-white/5 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                period === p
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-amber-400/70 mb-2" />
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/15 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-white/30 text-sm">
          Belum ada data cashflow
        </div>
      ) : (
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="label"
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
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-white/60 capitalize">
                    {value}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Pemasukan"
                stroke="#5DA9F6"
                strokeWidth={2}
                fill="#5DA9F6"
                fillOpacity={0.12}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Pengeluaran"
                stroke="#FB7185"
                strokeWidth={2}
                fill="#FB7185"
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
