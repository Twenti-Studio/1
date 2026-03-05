import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowTrendingDownIcon,
    ArrowTrendingUpIcon,
    FunnelIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";

const Spinner = () => (
  <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
);

function IntentBadge({ intent }) {
  if (intent === "income")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.65rem] font-medium text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
        <ArrowTrendingUpIcon className="w-3 h-3" /> Pemasukan
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.65rem] font-medium text-rose-400 bg-rose-400/10 border-rose-400/20">
      <ArrowTrendingDownIcon className="w-3 h-3" /> Pengeluaran
    </span>
  );
}

export default function TransactionHistory() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [intent, setIntent] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "30");
      if (intent) params.set("intent", intent);
      if (category) params.set("category", category);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/user/transactions?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      if (data.categories) setCategories(data.categories);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, intent, category, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [intent, category, dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (intent) params.set("intent", intent);
      if (category) params.set("category", category);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/user/transactions/export?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();

      // Get filename from backend Content-Disposition header
      let filename = "rekap_finot.csv";
      const cd = res.headers.get("Content-Disposition");
      if (cd) {
        const match = cd.match(/filename=([^\s;]+)/);
        if (match) filename = match[1];
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Gagal export data");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setIntent("");
    setCategory("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = intent || category || dateFrom || dateTo;

  const selectCls =
    "bg-[#191c22] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50 [&>option]:bg-[#191c22] [&>option]:text-white";
  const inputCls =
    "bg-[#191c22] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange/50 focus:border-orange/50";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold">Riwayat Transaksi</h2>
          <p className="text-[0.7rem] text-white/40">
            {total} transaksi ditemukan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showFilters || hasFilters
                ? "border-orange bg-orange/15 text-orange"
                : "border-border bg-white/3 text-white/50 hover:text-white hover:border-white/20"
            }`}
          >
            <FunnelIcon className="w-3.5 h-3.5" /> Filter
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange" />
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-white/3 text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
          >
            {exporting ? (
              <Spinner />
            ) : (
              <>
                <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-5 p-4 rounded-xl bg-white/3 border border-border space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[0.65rem] text-white/40 mb-1">Jenis</label>
              <select value={intent} onChange={(e) => setIntent(e.target.value)} className={selectCls}>
                <option value="" style={{ background: '#191c22', color: '#fff' }}>Semua</option>
                <option value="income" style={{ background: '#191c22', color: '#fff' }}>Pemasukan</option>
                <option value="expense" style={{ background: '#191c22', color: '#fff' }}>Pengeluaran</option>
              </select>
            </div>
            <div>
              <label className="block text-[0.65rem] text-white/40 mb-1">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                <option value="" style={{ background: '#191c22', color: '#fff' }}>Semua</option>
                {categories.map((c) => (
                  <option key={c} value={c} style={{ background: '#191c22', color: '#fff' }}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[0.65rem] text-white/40 mb-1">Dari</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[0.65rem] text-white/40 mb-1">Sampai</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
            </div>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
            >
              <ArrowPathIcon className="w-3 h-3" /> Reset filter
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          {hasFilters ? "Tidak ada transaksi sesuai filter" : "Belum ada riwayat transaksi"}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-xs text-white/40">
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Jenis</th>
                  <th className="pb-2 font-medium">Kategori</th>
                  <th className="pb-2 font-medium text-right">Jumlah</th>
                  <th className="pb-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((t) => (
                  <tr key={t.id} className="text-sm hover:bg-white/2 transition-colors">
                    <td className="py-3 text-white/70">{t.date}</td>
                    <td className="py-3">
                      <IntentBadge intent={t.intent} />
                    </td>
                    <td className="py-3 text-white/60">{t.category}</td>
                    <td
                      className={`py-3 font-semibold text-right ${
                        t.intent === "income" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {t.intent === "income" ? "+" : "-"}Rp{t.amount.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 text-white/40 text-xs max-w-[200px] truncate">
                      {t.note || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {items.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-white/3 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/40">{t.date}</span>
                  <IntentBadge intent={t.intent} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/70">{t.category}</p>
                    {t.note && (
                      <p className="text-[0.65rem] text-white/30 truncate max-w-[200px]">{t.note}</p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      t.intent === "income" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {t.intent === "income" ? "+" : "-"}Rp{t.amount.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
              >
                Sebelumnya
              </button>
              <span className="text-xs text-white/40">
                {page} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
