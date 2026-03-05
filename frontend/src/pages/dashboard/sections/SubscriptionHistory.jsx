import {
    ArrowDownCircleIcon,
    ArrowDownTrayIcon,
    ArrowUpCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { useDashboardAPI } from "../../../hooks/useDashboardAPI";

const Spinner = () => <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />;

function StatusBadge({ status }) {
  const map = {
    active: {
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
      icon: CheckCircleIcon,
      label: "Aktif",
    },
    paid: {
      color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
      icon: CheckCircleIcon,
      label: "Lunas",
    },
    pending: {
      color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
      icon: ClockIcon,
      label: "Pending",
    },
    expired: {
      color: "text-white/40 bg-white/5 border-white/10",
      icon: ClockIcon,
      label: "Expired",
    },
  };
  const s = map[status] || map.paid;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.65rem] font-medium ${s.color}`}
    >
      <s.icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function TypeBadge({ type }) {
  if (type === "upgrade")
    return (
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-violet-400">
        <ArrowUpCircleIcon className="w-3 h-3" /> Upgrade
      </span>
    );
  if (type === "downgrade")
    return (
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-amber-400">
        <ArrowDownCircleIcon className="w-3 h-3" /> Downgrade
      </span>
    );
  if (type === "voucher")
    return (
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-emerald-400">
        <CheckCircleIcon className="w-3 h-3" /> Voucher
      </span>
    );
  return null;
}

export default function SubscriptionHistory() {
  const { data, loading } = useDashboardAPI("/subscriptions");
  const history = data?.history || [];

  function downloadInvoice(h) {
    const lines = [
      "════════════════════════════════════",
      "           INVOICE - FiNot          ",
      "════════════════════════════════════",
      "",
      `Invoice    : ${h.invoice}`,
      `Tanggal    : ${h.date}`,
      `Plan       : ${h.plan}`,
      `Status     : ${h.status}`,
      `Jumlah     : ${h.amount > 0 ? `Rp${h.amount.toLocaleString("id-ID")}` : "Gratis"}`,
      `Metode     : ${h.method}`,
      "",
      "────────────────────────────────────",
      "Terima kasih telah berlangganan FiNot!",
      "https://finot.twenti.studio",
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${h.invoice.replace("#", "")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-orange/15 flex items-center justify-center">
          <DocumentTextIcon className="w-4.5 h-4.5 text-orange" />
        </div>
        <div>
          <h2 className="text-base font-bold">Riwayat Langganan</h2>
          <p className="text-[0.7rem] text-white/40">
            Riwayat pembayaran & perubahan plan
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">
          Belum ada riwayat langganan
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-xs text-white/40">
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Jumlah</th>
                  <th className="pb-2 font-medium">Metode</th>
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className="text-sm hover:bg-white/2 transition-colors"
                  >
                    <td className="py-3 text-white/70">{h.date}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{h.plan}</span>
                        <TypeBadge type={h.type} />
                      </div>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="py-3 font-semibold">
                      {h.amount > 0 ? `Rp${h.amount.toLocaleString("id-ID")}` : "Gratis"}
                    </td>
                    <td className="py-3 text-white/50 text-xs">{h.method}</td>
                    <td className="py-3 text-white/50 text-xs font-mono">
                      {h.invoice}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => downloadInvoice(h)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                        title="Download Invoice"
                      >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-xl bg-white/3 border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/50">{h.date}</span>
                  <StatusBadge status={h.status} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{h.plan}</span>
                  <TypeBadge type={h.type} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-sm font-bold">
                      {h.amount > 0 ? `Rp${h.amount.toLocaleString("id-ID")}` : "Gratis"}
                    </p>
                    <p className="text-[0.65rem] text-white/40">{h.method}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.6rem] text-white/30 font-mono">
                      {h.invoice}
                    </span>
                    <button onClick={() => downloadInvoice(h)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
