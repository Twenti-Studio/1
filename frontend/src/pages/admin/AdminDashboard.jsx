import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  BugAntIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  FireIcon,
  FunnelIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  PlusCircleIcon,
  PlusIcon,
  RocketLaunchIcon,
  SparklesIcon,
  TrophyIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Spinner = ({ className = "w-8 h-8" }) => (
  <div className={`${className} border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin`} />
);

/* ═══ Reusable Components ═══ */

function StatCard(props) {
  const c = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    navy: "bg-indigo-50 text-indigo-700",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all group relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.7rem] font-bold text-gray-400 uppercase tracking-wide">{props.label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c[props.color || "blue"]}`}>
          <props.icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-gray-900">{props.value}</p>
      {props.sub && <p className="text-xs text-gray-400 mt-1">{props.sub}</p>}
      {props.tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[0.65rem] rounded-lg whitespace-normal w-56 text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-lg">
          {props.tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function Badge({ type, children }) {
  const s = {
    free: "bg-gray-100 text-gray-600",
    pro: "bg-indigo-50 text-indigo-700",
    elite: "bg-orange-50 text-orange-600",
    active: "bg-green-50 text-green-600",
    paid: "bg-green-50 text-green-600",
    expired: "bg-red-50 text-red-600",
    trial: "bg-blue-50 text-blue-600",
    pending: "bg-yellow-50 text-yellow-600",
    warning: "bg-yellow-50 text-yellow-600",
    error: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.7rem] font-bold uppercase ${s[type] || s.free}`}
    >
      {children}
    </span>
  );
}

function Panel(props) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        {props.icon && <props.icon className="w-4 h-4 text-orange-500" />}
        <span className="font-bold text-sm text-gray-800">{props.title}</span>
      </div>
      <div className={props.noPad ? "" : "p-5"}>{props.children}</div>
    </div>
  );
}

const TH = "text-left px-5 py-3 text-[0.7rem] font-bold text-gray-400 uppercase tracking-wide";
const TD = "px-5 py-3 text-sm";
const TR = "border-b border-gray-50 hover:bg-gray-50/50";

function fmtRp(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

const TABS = [
  { id: "revenue", label: "Revenue", icon: ArrowTrendingUpIcon },
  { id: "subscriptions", label: "Subs", icon: TrophyIcon },
  { id: "ai", label: "AI Usage", icon: CpuChipIcon },
  { id: "logs", label: "Logs", icon: BugAntIcon },
  { id: "credits", label: "Credits", icon: AdjustmentsHorizontalIcon },
  { id: "broadcast", label: "Broadcast", icon: MegaphoneIcon },
  { id: "funnel", label: "Funnel", icon: FunnelIcon },
  { id: "users", label: "Users", icon: UsersIcon },
];

/* ═══ Main Dashboard ═══ */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("revenue");
  const [toast, setToast] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [creditForm, setCreditForm] = useState({
    userId: "",
    action: "add",
    amount: "",
    reason: "",
  });
  const [broadcastForm, setBroadcastForm] = useState({ target: "all", message: "" });
  const [creditErrors, setCreditErrors] = useState({});
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/admin/api/me");
        if (!me.ok) {
          navigate("/admin/login");
          return;
        }
        const res = await fetch("/admin/api/dashboard");
        if (!res.ok) {
          navigate("/admin/login");
          return;
        }
        setData(await res.json());
      } catch {
        navigate("/admin/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!creditForm.userId.trim()) errors.userId = true;
    if (!creditForm.amount && creditForm.action !== "reset") errors.amount = true;
    if (Object.keys(errors).length) {
      setCreditErrors(errors);
      return;
    }
    setCreditErrors({});
    try {
      const res = await fetch("/admin/api/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: creditForm.userId,
          action: creditForm.action,
          amount: parseInt(creditForm.amount) || 0,
          reason: creditForm.reason,
        }),
      });
      const d = await res.json();
      if (d.success) {
        showToast("Credit berhasil di-adjust");
        setCreditForm({ userId: "", action: "add", amount: "", reason: "" });
      } else showToast(d.error || "Gagal", "error");
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.message.trim()) {
      showToast("Pesan broadcast tidak boleh kosong", "error");
      return;
    }
    if (!confirmBroadcast) {
      setConfirmBroadcast(true);
      return;
    }
    setConfirmBroadcast(false);
    setBroadcastLoading(true);
    try {
      const res = await fetch("/admin/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(broadcastForm),
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Broadcast terkirim ke ${d.sent_count} user`);
        setBroadcastForm({ ...broadcastForm, message: "" });
      } else showToast(d.error || "Gagal", "error");
    } catch {
      showToast("Network error", "error");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const quickCredit = (action, amount) => {
    setCreditForm((prev) => ({
      ...prev,
      action,
      amount: amount.toString(),
      reason: `Quick ${action} ${amount}`,
    }));
    setCreditErrors(prev => prev.userId ? {} : prev);
    setTab("credits");
    // Focus the userId field after tab switch
    setTimeout(() => document.getElementById("credit-user-id")?.focus(), 100);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  if (!data) return null;

  const { revenue, recent_payments, subscriptions, ai_usage, logs, broadcast_stats, funnel, users } =
    data;

  const filteredUsers = users?.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.display_name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      u.id.includes(q)
    );
  });

  const inputCls =
    "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1B2A6B] focus:ring-2 focus:ring-[#1B2A6B]/10 transition-all";

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100]">
          <div
            className={`bg-white border rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium ${
              toast.type === "success"
                ? "border-green-200 text-green-700"
                : "border-red-200 text-red-700"
            }`}
          >
            {toast.type === "success" ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationTriangleIcon className="w-4 h-4" />}{" "}
            {toast.message}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.id
                ? "bg-[#1B2A6B] text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Revenue ═══ */}
      {tab === "revenue" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Total Revenue" value={fmtRp(revenue?.total_all_time)} sub="Sejak pertama kali" icon={BanknotesIcon} color="navy" tooltip="Total semua pembayaran yang berstatus 'paid' sejak awal. Ini pendapatan aktual yang sudah diterima." />
            <StatCard label="Bulan Ini" value={fmtRp(revenue?.this_month)} icon={CalendarDaysIcon} color="orange" tooltip="Pendapatan dari pembayaran bulan ini saja." />
            <StatCard label="Hari Ini" value={fmtRp(revenue?.today)} icon={BoltIcon} color="green" />
            <StatCard label="MRR" value={fmtRp(revenue?.mrr)} sub="Monthly Recurring" icon={ArrowTrendingUpIcon} color="blue" tooltip="Monthly Recurring Revenue — total harga plan dari semua subscriber aktif saat ini. MRR menunjukkan potensi pendapatan bulanan berulang, bukan pembayaran aktual." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Active Subs" value={revenue?.active_subs} icon={TrophyIcon} color="green" />
            <StatCard label="Expiring (7d)" value={revenue?.expiring_soon} icon={ClockIcon} color="red" />
            <StatCard label="Churn Rate" value={`${(revenue?.churn_rate || 0).toFixed(1)}%`} icon={ArrowTrendingDownIcon} color="red" />
          </div>
          <Panel title="Recent Payments" icon={BanknotesIcon} noPad>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70">
                  <th className={TH}>User</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent_payments?.length ? (
                  recent_payments.map((p, i) => (
                    <tr key={i} className={TR}>
                      <td className={`${TD} font-semibold`}>{p.user_name}</td>
                      <td className={TD}><Badge type={p.plan}>{p.plan}</Badge></td>
                      <td className={TD}>{fmtRp(p.amount)}</td>
                      <td className={TD}><Badge type={p.status}>{p.status}</Badge></td>
                      <td className={`${TD} text-xs text-gray-400`}>{p.created_at}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-300 text-sm">
                      Belum ada pembayaran
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {/* ═══ Subscriptions ═══ */}
      {tab === "subscriptions" && (
        <Panel title="Subscription Management" icon={TrophyIcon} noPad>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70">
                <th className={TH}>User</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Status</th>
                <th className={TH}>Expires</th>
                <th className={TH}>Last Payment</th>
                <th className={TH}>Usage</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.length ? (
                subscriptions.map((s, i) => (
                  <tr key={i} className={TR}>
                    <td className={TD}>
                      <div className="font-semibold">{s.display_name}</div>
                      <div className="text-xs text-gray-400">{s.username}</div>
                    </td>
                    <td className={TD}><Badge type={s.plan}>{s.plan}</Badge></td>
                    <td className={TD}><Badge type={s.payment_status}>{s.payment_status}</Badge></td>
                    <td className={`${TD} text-xs`}>{s.expired_at || "-"}</td>
                    <td className={`${TD} text-xs`}>{s.last_payment_date || "-"}</td>
                    <td className={TD}>
                      <strong>{s.total_usage_this_month}</strong>{" "}
                      <span className="text-gray-400">credits</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-300 text-sm">
                    Tidak ada subscription
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ═══ AI Usage ═══ */}
      {tab === "ai" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="AI Calls Today" value={ai_usage?.calls_today} icon={CpuChipIcon} color="navy" />
            <StatCard label="Est. Cost Today" value={`$${(ai_usage?.cost_today || 0).toFixed(2)}`} icon={CurrencyDollarIcon} color="orange" />
            <StatCard label="Calls This Month" value={ai_usage?.calls_month} icon={ChartBarIcon} color="blue" />
            <StatCard label="Unique Users" value={ai_usage?.unique_users_today} icon={UsersIcon} color="green" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Top 5 Heavy Users" icon={FireIcon} noPad>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/70">
                    <th className={TH}>User</th>
                    <th className={TH}>Calls</th>
                    <th className={TH}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {ai_usage?.top_users?.length ? (
                    ai_usage.top_users.map((u, i) => (
                      <tr key={i} className={TR}>
                        <td className={`${TD} font-semibold`}>{u.display_name}</td>
                        <td className={TD}>{u.call_count}</td>
                        <td className={`${TD} text-gray-400`}>${(u.est_cost || 0).toFixed(3)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-gray-300 text-sm">No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Panel>
            <Panel title="Usage by Source" icon={CpuChipIcon} noPad>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/70">
                    <th className={TH}>Source</th>
                    <th className={TH}>Count</th>
                    <th className={TH}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {ai_usage?.by_source?.length ? (
                    ai_usage.by_source.map((s, i) => (
                      <tr key={i} className={TR}>
                        <td className={`${TD} font-semibold capitalize`}>{s.source}</td>
                        <td className={TD}>{s.count}</td>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#1B2A6B] rounded-full"
                                style={{ width: `${s.pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-12 text-right">
                              {s.pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-gray-300 text-sm">No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Panel>
          </div>
        </>
      )}

      {/* ═══ Logs ═══ */}
      {tab === "logs" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Failed AI" value={logs?.failed_ai} sub="Last 24 hours" icon={CpuChipIcon} color="red" />
            <StatCard label="Failed OCR" value={logs?.failed_ocr} sub="Last 24 hours" icon={PhotoIcon} color="orange" />
            <StatCard label="System Errors" value={logs?.system_errors} sub="Last 24 hours" icon={ExclamationTriangleIcon} color="red" />
          </div>
          <Panel title="Recent Error Logs" icon={BugAntIcon}>
            {logs?.recent?.length ? (
              <div className="space-y-3">
                {logs.recent.map((l, i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        l.level === "error"
                          ? "bg-red-500"
                          : l.level === "warning"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{l.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {l.timestamp} &bull; {l.source}
                      </p>
                    </div>
                    <Badge type={l.level}>{l.level}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircleIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Tidak ada error dalam 24 jam terakhir</p>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* ═══ Credits ═══ */}
      {tab === "credits" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Adjust Credits" icon={AdjustmentsHorizontalIcon}>
            <form onSubmit={handleCreditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  User ID (Telegram / WhatsApp)
                </label>
                <input
                  id="credit-user-id"
                  type="text"
                  value={creditForm.userId}
                  onChange={(e) => {
                    setCreditForm({ ...creditForm, userId: e.target.value });
                    if (e.target.value) setCreditErrors((p) => ({ ...p, userId: false }));
                  }}
                  placeholder="e.g. 123456789"
                  className={`${inputCls} ${creditErrors.userId ? "!border-red-400 !ring-red-200" : ""}`}
                />
                {creditErrors.userId && (
                  <p className="text-xs text-red-500 mt-1">User ID wajib diisi</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Action</label>
                <select
                  value={creditForm.action}
                  onChange={(e) => setCreditForm({ ...creditForm, action: e.target.value })}
                  className={inputCls}
                >
                  <option value="add">Add Credits</option>
                  <option value="subtract">Subtract Credits</option>
                  <option value="reset">Reset Credits</option>
                  <option value="bonus">Give Bonus</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount</label>
                <input
                  type="number"
                  value={creditForm.amount}
                  onChange={(e) => {
                    setCreditForm({ ...creditForm, amount: e.target.value });
                    if (e.target.value) setCreditErrors((p) => ({ ...p, amount: false }));
                  }}
                  placeholder="Jumlah"
                  min="0"
                  className={`${inputCls} ${creditErrors.amount ? "!border-red-400 !ring-red-200" : ""}`}
                />
                {creditErrors.amount && (
                  <p className="text-xs text-red-500 mt-1">Jumlah wajib diisi</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Reason (opsional)
                </label>
                <input
                  type="text"
                  value={creditForm.reason}
                  onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                  placeholder="Alasan adjustment"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1B2A6B] text-white text-sm font-semibold hover:bg-[#243380] flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-4 h-4" /> Apply
              </button>
            </form>
          </Panel>
          <Panel title="Quick Actions" icon={BoltIcon}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Quick +10", sub: "Add 10 credits", icon: PlusIcon, color: "green", action: "add", amount: 10 },
                { label: "Quick +50", sub: "Add 50 credits", icon: PlusCircleIcon, color: "blue", action: "add", amount: 50 },
                { label: "Bonus +100", sub: "Give 100 bonus", icon: GiftIcon, color: "orange", action: "bonus", amount: 100 },
                { label: "Reset", sub: "Reset to default", icon: ArrowPathIcon, color: "red", action: "reset", amount: 0 },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => quickCredit(q.action, q.amount)}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                      q.color === "green"
                        ? "bg-green-50 text-green-600"
                        : q.color === "blue"
                          ? "bg-blue-50 text-blue-600"
                          : q.color === "orange"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-red-50 text-red-600"
                    }`}
                  >
                    <q.icon className="w-4.5 h-4.5" />
                  </div>
                  <p className="font-bold text-sm text-gray-800">{q.label}</p>
                  <p className="text-xs text-gray-400">{q.sub}</p>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ═══ Broadcast ═══ */}
      {tab === "broadcast" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Send Broadcast" icon={PaperAirplaneIcon}>
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Target</label>
                <select
                  value={broadcastForm.target}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target: e.target.value })}
                  className={inputCls}
                >
                  <option value="all">All Users</option>
                  <option value="premium">Premium (Pro + Elite)</option>
                  <option value="pro">Pro Only</option>
                  <option value="elite">Elite Only</option>
                  <option value="free">Free Only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Message</label>
                <textarea
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  rows={5}
                  required
                  placeholder="Ketik pesan broadcast..."
                  className={`${inputCls} resize-y`}
                />
              </div>
              <button
                type="submit"
                disabled={broadcastLoading}
                className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  confirmBroadcast
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#1B2A6B] hover:bg-[#243380]"
                } disabled:opacity-50`}
              >
                {broadcastLoading ? (
                  <Spinner className="w-4 h-4" />
                ) : confirmBroadcast ? (
                  <>Yakin kirim ke &quot;{broadcastForm.target}&quot;? Klik lagi</>
                ) : (
                  <><PaperAirplaneIcon className="w-4 h-4" /> Send Broadcast</>
                )}
              </button>
              {confirmBroadcast && (
                <button
                  type="button"
                  onClick={() => setConfirmBroadcast(false)}
                  className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Batal
                </button>
              )}
            </form>
          </Panel>
          <div className="grid grid-cols-3 gap-4 h-fit">
            <StatCard label="All Users" value={broadcast_stats?.all} icon={UsersIcon} color="navy" />
            <StatCard label="Premium" value={broadcast_stats?.premium} icon={TrophyIcon} color="orange" />
            <StatCard label="Free" value={broadcast_stats?.free} icon={UserIcon} color="blue" />
          </div>
        </div>
      )}

      {/* ═══ Funnel ═══ */}
      {tab === "funnel" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Signups" value={funnel?.total_signups} icon={UserPlusIcon} color="navy" />
            <StatCard label="Trial → Pro" value={`${(funnel?.trial_to_pro || 0).toFixed(1)}%`} sub={`${funnel?.pro_count} converted`} icon={ArrowTrendingUpIcon} color="green" />
            <StatCard label="Pro → Elite" value={`${(funnel?.pro_to_elite || 0).toFixed(1)}%`} sub={`${funnel?.elite_count} upgraded`} icon={RocketLaunchIcon} color="orange" />
            <StatCard label="Drop Rate" value={`${(funnel?.trial_drop_rate || 0).toFixed(1)}%`} icon={ArrowTrendingDownIcon} color="red" />
          </div>
          <Panel title="Conversion Funnel" icon={ChartBarIcon}>
            <div className="max-w-xl mx-auto space-y-5 py-4">
              {[
                { label: "All Signups", count: funnel?.total_signups, color: "bg-[#1B2A6B]" },
                { label: "Free Users", count: funnel?.free_count, color: "bg-gray-400" },
                { label: "Pro Users", count: funnel?.pro_count, color: "bg-[#243380]" },
                { label: "Elite Users", count: funnel?.elite_count, color: "bg-orange-500" },
              ].map((f) => {
                const max = funnel?.total_signups || 1;
                return (
                  <div key={f.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-700">{f.label}</span>
                      <span className="text-sm font-bold text-gray-900">{f.count}</span>
                    </div>
                    <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${f.color} rounded-lg transition-all`}
                        style={{ width: `${Math.max(((f.count || 0) / max) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}

      {/* ═══ Users ═══ */}
      {tab === "users" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total" value={users?.length} icon={UsersIcon} color="navy" />
            <StatCard label="Free" value={users?.filter((u) => u.plan === "free").length} icon={UserIcon} color="blue" />
            <StatCard label="Pro" value={users?.filter((u) => u.plan === "pro").length} icon={SparklesIcon} color="green" />
            <StatCard label="Elite" value={users?.filter((u) => u.plan === "elite").length} icon={TrophyIcon} color="orange" />
          </div>
          <Panel title="All Users" icon={UsersIcon} noPad>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari user..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1B2A6B]"
                />
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70">
                  <th className={TH}>User</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Credits</th>
                  <th className={TH}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers?.map((u, i) => (
                  <tr key={i} className={TR}>
                    <td className={TD}>
                      <div className="font-semibold">{u.display_name}</div>
                      <div className="text-xs text-gray-400">
                        {u.username} &bull; ID: {u.id}
                      </div>
                    </td>
                    <td className={TD}><Badge type={u.plan}>{u.plan}</Badge></td>
                    <td className={TD}>
                      <strong>{u.credits_remaining}</strong>{" "}
                      <span className="text-gray-400">/ {u.credits_total}</span>
                    </td>
                    <td className={`${TD} text-xs text-gray-400`}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID") : "-"}
                    </td>
                  </tr>
                ))}
                {!filteredUsers?.length && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-300 text-sm">
                      Tidak ada user
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </>
  );
}
