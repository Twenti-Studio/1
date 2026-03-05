import { BanknotesIcon, CalculatorIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const PRESETS = [5000, 10000, 20000, 50000];

export default function Simulation({ hasAccess = false }) {
  const { data: dash } = useDashboardAPI("/dashboard");
  const [amount, setAmount] = useState(10000);
  const [result, setResult] = useState(null);

  // AI scenario
  const [scenario, setScenario] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const balance = dash?.balance ?? 0;
  const monthIncome = dash?.this_month?.income ?? 0;
  const monthExpense = dash?.this_month?.expense ?? 0;

  function simulate(val) {
    const daily = val;
    const weekly = daily * 7;
    const monthly = daily * 30;
    const yearly = daily * 365;
    setResult({ daily, weekly, monthly, yearly });
  }

  function handlePreset(val) {
    setAmount(val);
    simulate(val);
  }

  function handleSubmit(e) {
    e.preventDefault();
    simulate(amount);
  }

  const fmt = (v) => (v < 0 ? "-Rp" + Math.abs(v).toLocaleString("id-ID") : "Rp" + v.toLocaleString("id-ID"));

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <CalculatorIcon className="w-4.5 h-4.5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">Simulasi Hemat</h2>
          <p className="text-[0.7rem] text-white/40">
            Berdasarkan saldo dan pemasukanmu bulan ini
          </p>
        </div>
      </div>

      {/* Real balance summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Saldo Saat Ini</p>
          <p className={`text-sm font-bold ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(balance)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Pemasukan Bulan Ini</p>
          <p className="text-sm font-bold text-sky-400">{fmt(monthIncome)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
          <p className="text-[0.65rem] text-white/40 mb-1">Pengeluaran Bulan Ini</p>
          <p className="text-sm font-bold text-orange">{fmt(monthExpense)}</p>
        </div>
      </div>

      {/* Presets */}
      <p className="text-xs text-white/50 mb-2">Kalau kamu hemat per hari:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => handlePreset(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              amount === p
                ? "border-orange bg-orange/15 text-orange"
                : "border-border bg-white/3 text-white/50 hover:text-white hover:border-white/20"
            }`}
          >
            Rp{p.toLocaleString("id-ID")}/hari
          </button>
        ))}
      </div>

      {/* Custom input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
            Rp
          </span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50 transition-colors"
            placeholder="Jumlah per hari"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-linear-to-r from-orange to-orange-dark text-white text-sm font-semibold rounded-lg hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 flex items-center gap-1.5"
        >
          <SparklesIcon className="w-3.5 h-3.5" /> Hitung
        </button>
      </form>

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 animate-fade-in-up">
            <ResultCard label="Per Minggu" amount={result.weekly} accent="text-sky-400" />
            <ResultCard label="Per Bulan" amount={result.monthly} accent="text-emerald-400" />
            <ResultCard label="Per 6 Bulan" amount={result.monthly * 6} accent="text-violet-400" />
            <ResultCard label="Per Tahun" amount={result.yearly} accent="text-amber-400" />
          </div>

          {/* Projected balance */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <BanknotesIcon className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400">Proyeksi Saldo</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[0.6rem] text-white/40">+1 Bulan</p>
                <p className="text-xs font-bold text-emerald-400">{fmt(balance + result.monthly)}</p>
              </div>
              <div>
                <p className="text-[0.6rem] text-white/40">+3 Bulan</p>
                <p className="text-xs font-bold text-emerald-400">{fmt(balance + result.monthly * 3)}</p>
              </div>
              <div>
                <p className="text-[0.6rem] text-white/40">+6 Bulan</p>
                <p className="text-xs font-bold text-emerald-400">{fmt(balance + result.monthly * 6)}</p>
              </div>
              <div>
                <p className="text-[0.6rem] text-white/40">+1 Tahun</p>
                <p className="text-xs font-bold text-emerald-400">{fmt(balance + result.yearly)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── AI Scenario Simulation ── */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <SparklesIcon className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold">Simulasi Skenario AI</h3>
        </div>
        {hasAccess ? (
          <>
            <p className="text-xs text-white/40 mb-3">
              Ketik skenario dalam bahasa natural, contoh: &quot;kurangi nongkrong 3x
              seminggu&quot; atau &quot;hemat makan 20rb per hari&quot;
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!scenario.trim()) return;
                setAiLoading(true);
                setAiError(null);
                try {
                  const res = await fetch("/api/user/ai/simulation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ scenario: scenario.trim() }),
                  });
                  if (res.status === 403 || res.status === 429) {
                    const err = await res.json();
                    setAiError(err.detail);
                    return;
                  }
                  if (!res.ok) throw new Error();
                  const json = await res.json();
                  setAiResult(json.data);
                } catch {
                  setAiError("Gagal menjalankan simulasi AI");
                } finally {
                  setAiLoading(false);
                }
              }}
              className="flex gap-2 mb-4"
            >
              <input
                type="text"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Contoh: kurangi nongkrong 3x seminggu"
                className="flex-1 px-3 py-2.5 bg-white/5 border border-border rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={aiLoading || !scenario.trim()}
                className="px-4 py-2.5 bg-linear-to-r from-violet-500 to-violet-600 text-white text-sm font-semibold rounded-lg hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-30"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <SparklesIcon className="w-3.5 h-3.5" /> Simulasi
                  </>
                )}
              </button>
            </form>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs text-rose-400 mb-4">
                {aiError}
              </div>
            )}

            {aiResult && !aiLoading && (
              <div className="space-y-3 animate-fade-in-up">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
                    <p className="text-[0.6rem] text-white/40 mb-1">Hemat/Kejadian</p>
                    <p className="text-xs font-bold text-violet-400">
                      {fmt(aiResult.estimated_saving_per_occurrence || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
                    <p className="text-[0.6rem] text-white/40 mb-1">Hemat/Bulan</p>
                    <p className="text-xs font-bold text-emerald-400">
                      {fmt(aiResult.monthly_saving || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
                    <p className="text-[0.6rem] text-white/40 mb-1">Hemat/Tahun</p>
                    <p className="text-xs font-bold text-amber-400">
                      {fmt(aiResult.yearly_saving || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
                    <p className="text-[0.6rem] text-white/40 mb-1">+Hari Saldo</p>
                    <p className="text-xs font-bold text-sky-400">
                      +{aiResult.extra_balance_days || 0} hari
                    </p>
                  </div>
                </div>
                {aiResult.message && (
                  <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
                    <p className="text-sm text-white/80 leading-relaxed">
                      {aiResult.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-white/30 text-sm">
            <ShieldCheckIcon className="w-6 h-6 mx-auto mb-1 text-white/20" />
            Simulasi AI tersedia untuk paket Trial / Pro / Elite
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, amount, accent }) {
  return (
    <div className="p-3 rounded-xl bg-white/3 border border-border text-center">
      <p className="text-[0.65rem] text-white/40 mb-1">{label}</p>
      <p className={`text-sm sm:text-base font-bold ${accent}`}>
        Rp{amount.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
