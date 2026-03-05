import { CheckCircleIcon, PlusIcon, TicketIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Spinner = ({ className = "w-4 h-4" }) => (
  <div className={`${className} border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin`} />
);

export default function AdminVouchers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState({ target: "", plan: "pro", duration: 30 });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      const res = await fetch("/admin/api/vouchers");
      if (!res.ok) {
        navigate("/admin/login");
        return;
      }
      const data = await res.json();
      setVouchers(data.vouchers || []);
    } catch {
      navigate("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/admin/api/vouchers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ msg: `Voucher dibuat: ${data.code}`, type: "success" });
        setForm({ target: "", plan: "pro", duration: 30 });
        loadVouchers();
      } else {
        setToast({ msg: data.error || "Gagal", type: "error" });
      }
    } catch {
      setToast({ msg: "Network error", type: "error" });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[100]">
          <div
            className={`bg-white border rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium ${
              toast.type === "success"
                ? "border-green-200 text-green-700"
                : "border-red-200 text-red-700"
            }`}
          >
            {toast.type === "success" ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}{" "}
            {toast.msg}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <TicketIcon className="w-5 h-5 text-orange-500" /> Voucher Center
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Create Form */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-bold text-sm text-gray-800 flex items-center gap-2">
            <PlusIcon className="w-4 h-4 text-orange-500" /> Generate Voucher
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Target User (Telegram / WhatsApp)
              </label>
              <input
                type="text"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="@username atau +62..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Plan Type
              </label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/10 transition-all"
              >
                <option value="pro">Pro Plan</option>
                <option value="elite">Elite Plan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Duration
              </label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/10 transition-all"
              >
                <option value={30}>30 Hari (1 Bulan)</option>
                <option value={90}>90 Hari (3 Bulan)</option>
                <option value={365}>365 Hari (1 Tahun)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#1B2A6B] text-white text-sm font-semibold hover:bg-[#243380] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Spinner /> : <PlusIcon className="w-4 h-4" />}{" "}
              Generate
            </button>
          </form>
        </div>

        {/* Voucher List */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-bold text-sm text-gray-800">
            Recent Vouchers
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70">
                  <th className="text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase">Code</th>
                  <th className="text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase">Target</th>
                  <th className="text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase">Plan</th>
                  <th className="text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase">Created</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <code className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-xs font-mono">
                        {v.code}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{v.target_user || "-"}</td>
                    <td className="px-5 py-3 text-sm capitalize">
                      {v.plan} ({v.duration_days}d)
                    </td>
                    <td className="px-5 py-3">
                      {v.is_used ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[0.7rem] font-bold">
                          <XCircleIcon className="w-3 h-3" /> USED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-[0.7rem] font-bold">
                          <CheckCircleIcon className="w-3 h-3" /> ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString("id-ID") : "-"}
                    </td>
                  </tr>
                ))}
                {!vouchers.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-300 text-sm">
                      Belum ada voucher
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
