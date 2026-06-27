import {
    ArrowLeftIcon,
    ArrowPathRoundedSquareIcon,
    ArrowRightOnRectangleIcon,
    ArrowTrendingDownIcon,
    ArrowTrendingUpIcon,
    BanknotesIcon,
    BellIcon,
    ChatBubbleLeftRightIcon,
    ChartBarIcon,
    ChartPieIcon,
    ClipboardDocumentListIcon,
    Cog6ToothIcon,
    CreditCardIcon,
    CubeIcon,
    HeartIcon,
    LightBulbIcon,
    LinkIcon,
    LockClosedIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    PresentationChartLineIcon,
    QuestionMarkCircleIcon,
    UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useUserAuth } from "../context/UserAuthContext";

const API = "/api/user";

const TABS = [
    { id: "chat", label: "CHAT", icon: ChatBubbleLeftRightIcon },
    { id: "cashflow", label: "CASHFLOW", icon: ChartBarIcon },
    { id: "history", label: "HISTORY", icon: ClipboardDocumentListIcon },
    { id: "setting", label: "SETTING", icon: Cog6ToothIcon },
];

function rp(n) {
    if (n === null || n === undefined) return "Rp 0";
    return "Rp " + Number(n).toLocaleString("id-ID");
}

/**
 * Full-screen overlay shown when the user taps the chat header.
 * 4 tabs: Chat (closes drawer), Cashflow, History, Setting.
 * Dashboard (default landing) is the user-summary view above the tab bar.
 */
export default function FeaturesDrawer({ open, onClose }) {
    const [tab, setTab] = useState("dashboard");
    const [dashboard, setDashboard] = useState(null);

    useEffect(() => {
        if (!open) return;
        fetch(`${API}/dashboard`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then(setDashboard)
            .catch(() => { });
    }, [open]);

    function onTabClick(id) {
        if (id === "chat") {
            onClose();
            return;
        }
        setTab(id);
    }

    if (!open) return null;

    return (
        <div className="app-light fixed inset-0 z-50 bg-bg text-white flex flex-col animate-slide-up">
            {/* User header */}
            <UserHeader dashboard={dashboard} onBack={onClose} />

            {/* Tab bar */}
            <div className="flex-shrink-0 grid grid-cols-4 border-b border-border bg-navy-dark/80 backdrop-blur">
                {TABS.map((t) => {
                    const active = tab === "dashboard" ? false : tab === t.id;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => onTabClick(t.id)}
                            className={`flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-orange" : "text-white/40 hover:text-white/70"
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-orange/20" : "bg-white/5"}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-[0.6rem] font-semibold tracking-wider">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                {tab === "dashboard" && <DashboardContent data={dashboard} />}
                {tab === "cashflow" && <CashflowContent />}
                {tab === "history" && <HistoryContent />}
                {tab === "setting" && <SettingContent user={dashboard?.user} onClose={onClose} />}
            </div>
        </div>
    );
}

// ─── Persistent user header ─────────────────────────────

function UserHeader({ dashboard, onBack }) {
    const user = dashboard?.user;
    const planName = dashboard?.plan_status?.plan_name || "Free Plan";
    const isPremium = ["pro", "elite", "trial"].includes(user?.plan);

    return (
        <div
            className="flex-shrink-0 px-4 pt-4 pb-5 bg-navy-dark border-b border-border"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
            <div className="flex items-start gap-3">
                <button
                    onClick={onBack}
                    className="p-1.5 -ml-1.5 text-white/60 hover:text-white"
                    aria-label="Kembali ke chat"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="w-14 h-14 rounded-full bg-orange/20 flex items-center justify-center shrink-0">
                    <UserCircleIcon className="w-10 h-10 text-orange" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <p className="text-base font-bold text-white truncate">
                        {user?.display_name || user?.username || "User"}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                        {user?.username || "—"}
                    </p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 text-[0.6rem] font-bold rounded uppercase tracking-wider ${isPremium ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/60"
                        }`}>
                        {isPremium ? "Premium Member" : "Free Member"}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Dashboard tab (default landing) ────────────────────

function DashboardContent({ data }) {
    if (!data) return <LoadingShell />;
    const plan = data.plan_status || {};
    const today = data.today || {};

    return (
        <div className="px-4 py-4 space-y-3">
            {/* Insight Hari Ini */}
            <Card>
                <CardTitle icon={LightBulbIcon}>INSIGHT HARI INI</CardTitle>
                <p className="text-[0.65rem] text-white/40 mb-3">
                    Diperbaharui: {new Date().toLocaleDateString("id-ID")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <Tile label="Pemasukan Hari Ini" value={rp(today.income)} tone="up" />
                    <Tile label="Pengeluaran Hari Ini" value={rp(today.expense)} tone="down" />
                </div>
            </Card>

            {/* Plan & Kredit */}
            <Card>
                <div className="flex items-center justify-between">
                    <CardTitle icon={CubeIcon}>PLAN & KREDIT</CardTitle>
                    <span className="text-xs text-white/50">
                        {plan.credits_used || 0}/{plan.credits_total || 0}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-2 mb-3">
                    <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[0.65rem] font-bold rounded uppercase">
                        {(plan.plan || "free").toUpperCase()} Aktif
                    </span>
                </div>
                <p className="text-xs text-white/50 mb-1">Kredit tersisa</p>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                    <div
                        className="h-full bg-orange"
                        style={{
                            width: plan.credits_total
                                ? `${Math.min(100, Math.round(((plan.credits_total - plan.credits_used) / plan.credits_total) * 100))}%`
                                : "0%",
                        }}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.7rem]">
                    <div>
                        <p className="text-white/40">Refill Kredit</p>
                        <p className="font-semibold">{plan.refill_date || "—"}</p>
                    </div>
                    <div>
                        <p className="text-white/40">Berakhir</p>
                        <p className="font-semibold">{plan.expiry_date || "—"}</p>
                    </div>
                </div>
            </Card>

            {/* Score & Subs */}
            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardTitle icon={HeartIcon}>FINANCIAL SCORE</CardTitle>
                    <FinancialScore />
                </Card>
                <Card>
                    <CardTitle icon={ArrowPathRoundedSquareIcon}>RIWAYAT SUBS</CardTitle>
                    <p className="text-[0.65rem] text-white/40 mt-1 mb-2">
                        Riwayat pembayaran & perubahan plan
                    </p>
                    <SubscriptionMini />
                </Card>
            </div>
        </div>
    );
}

function FinancialScore() {
    const [score, setScore] = useState(null);
    useEffect(() => {
        fetch(`${API}/health-score`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setScore(d?.score))
            .catch(() => { });
    }, []);

    const display = score ?? 50;
    const tone = display >= 70 ? "BAIK" : display >= 50 ? "CUKUP" : "KURANG";

    return (
        <div className="flex flex-col items-center mt-2">
            <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="-rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(15,23,42,0.1)" strokeWidth="3" />
                    <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#F5841F" strokeWidth="3"
                        strokeDasharray={`${display}, 100`}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold">{display}</span>
                    <span className="text-[0.55rem] text-white/50 tracking-wider">{tone}</span>
                </div>
            </div>
        </div>
    );
}

function SubscriptionMini() {
    const [history, setHistory] = useState([]);
    useEffect(() => {
        fetch(`${API}/subscriptions`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setHistory(d?.history || []))
            .catch(() => { });
    }, []);

    if (history.length === 0) {
        return <p className="text-xs text-white/40 mt-2">Belum ada langganan.</p>;
    }
    const latest = history[0];
    const isActive = latest.status === "active";
    return (
        <div className="mt-2 space-y-1">
            <p className="text-[0.65rem] text-white/40">Jenis paket</p>
            <p className="text-sm font-semibold">{latest.plan}</p>
            <span className={`inline-block mt-1 px-1.5 py-0.5 text-[0.55rem] rounded font-semibold ${isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}`}>
                {isActive ? "AKTIF" : (latest.status || "—").toUpperCase()}
            </span>
        </div>
    );
}

// ─── Cashflow tab ───────────────────────────────────────

function CashflowContent() {
    const [period, setPeriod] = useState("weekly");
    const [spending, setSpending] = useState(null);
    const [cashflow, setCashflow] = useState(null);

    useEffect(() => {
        fetch(`${API}/spending`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then(setSpending)
            .catch(() => { });
    }, []);

    useEffect(() => {
        fetch(`${API}/cashflow?period=${period}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then(setCashflow)
            .catch(() => { });
    }, [period]);

    return (
        <div className="px-4 py-4 space-y-3">
            <Card>
                <CardTitle icon={ChartPieIcon}>SPENDING</CardTitle>
                <SpendingPie data={spending} />
            </Card>
            <Card>
                <div className="flex items-center justify-between mb-2">
                    <CardTitle icon={PresentationChartLineIcon}>CASHFLOW TREN</CardTitle>
                    <div className="flex gap-1 text-[0.6rem]">
                        {[
                            { v: "daily", l: "Days" },
                            { v: "weekly", l: "Weeks" },
                            { v: "monthly", l: "Months" },
                        ].map((opt) => (
                            <button
                                key={opt.v}
                                onClick={() => setPeriod(opt.v)}
                                className={`px-2.5 py-1 rounded-full font-semibold ${period === opt.v ? "bg-orange text-white" : "bg-white/5 text-white/50"
                                    }`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>
                <CashflowChart data={cashflow?.data || []} />
            </Card>
        </div>
    );
}

function SpendingPie({ data }) {
    const total = data?.total || 0;
    const cats = data?.categories || [];

    if (cats.length === 0) {
        return (
            <div className="text-center text-white/40 text-sm py-10">
                Belum ada pengeluaran bulan ini.
            </div>
        );
    }

    return (
        <div>
            <div className="h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={cats} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                            {cats.map((c, i) => (<Cell key={i} fill={c.color} />))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                            labelStyle={{ color: "#0f172a" }}
                            itemStyle={{ color: "#0f172a" }}
                            formatter={(v) => rp(v)}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[0.6rem] text-white/40">Total Spent</p>
                    <p className="text-base font-bold">{rp(total)}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
                {cats.slice(0, 6).map((c) => {
                    const pct = total ? Math.round((c.value / total) * 100) : 0;
                    return (
                        <div key={c.name} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="truncate text-white/70">{c.name} ({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CashflowChart({ data }) {
    if (!data.length) {
        return <div className="h-48 flex items-center justify-center text-white/40 text-sm">Belum ada data.</div>;
    }
    return (
        <div className="h-48 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <XAxis dataKey="label" stroke="rgba(15,23,42,0.45)" fontSize={10} />
                    <YAxis stroke="rgba(15,23,42,0.45)" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                        labelStyle={{ color: "#0f172a" }}
                        itemStyle={{ color: "#0f172a" }}
                        formatter={(v) => rp(v)}
                    />
                    <Line type="monotone" dataKey="income" stroke="#5DA9F6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expense" stroke="#F5841F" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── History tab ────────────────────────────────────────

function HistoryContent() {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");

    useEffect(() => {
        fetch(`${API}/transactions?limit=100`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setItems(d?.items || d?.transactions || []))
            .catch(() => { });
    }, []);

    const filtered = useMemo(() => {
        let arr = items;
        if (filter !== "all") arr = arr.filter((t) => t.intent === filter);
        if (query.trim()) {
            const q = query.toLowerCase();
            arr = arr.filter((t) =>
                (t.note || "").toLowerCase().includes(q) ||
                (t.category || "").toLowerCase().includes(q)
            );
        }
        return arr;
    }, [items, filter, query]);

    // Group by day label
    const grouped = useMemo(() => {
        const map = new Map();
        const now = new Date();
        const todayKey = now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const ydKey = yesterday.toDateString();
        for (const t of filtered) {
            const d = new Date(t.created_at || t.tx_date || Date.now());
            const key = d.toDateString();
            let label;
            if (key === todayKey) label = "Hari Ini";
            else if (key === ydKey) label = "Kemarin";
            else label = d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(t);
        }
        return Array.from(map.entries());
    }, [filtered]);

    return (
        <div className="px-4 py-4 space-y-3">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari transaksi..."
                    className="w-full bg-white/5 border border-border rounded-full pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-orange/50"
                />
            </div>
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
                {[
                    { v: "all", l: "Semua" },
                    { v: "income", l: "Pemasukan" },
                    { v: "expense", l: "Pengeluaran" },
                ].map((f) => (
                    <button
                        key={f.v}
                        onClick={() => setFilter(f.v)}
                        className={`px-3 py-1 rounded-full text-[0.7rem] font-semibold whitespace-nowrap ${filter === f.v ? "bg-orange text-white" : "bg-white/5 text-white/50"
                            }`}
                    >
                        {f.l}
                    </button>
                ))}
            </div>

            {grouped.length === 0 && (
                <div className="text-center text-white/40 text-sm py-10">
                    Belum ada transaksi yang cocok.
                </div>
            )}

            {grouped.map(([label, txs]) => (
                <div key={label}>
                    <p className="text-xs text-white/40 mb-2 mt-3">{label}</p>
                    <div className="space-y-2">
                        {txs.map((t) => (
                            <TxRow key={t.id} tx={t} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function TxRow({ tx }) {
    const isIncome = tx.intent === "income";
    return (
        <div className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isIncome ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                <BanknotesIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{tx.note || tx.category || "Transaksi"}</p>
                <p className="text-[0.65rem] text-white/40 truncate">
                    {tx.category}{tx.created_at ? ` • ${new Date(tx.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </p>
            </div>
            <div className={`text-sm font-bold ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                {isIncome ? "+" : "-"}{rp(tx.amount)}
            </div>
        </div>
    );
}

// ─── Setting tab ────────────────────────────────────────

function SettingContent({ user, onClose }) {
    const { logout } = useUserAuth();
    const navigate = useNavigate();
    const [panel, setPanel] = useState(null); // null | "security" | "linked" | "notif" | "currency" | "subs" | "help"

    async function handleLogout() {
        await logout();
        onClose();
        navigate("/login", { replace: true });
    }

    if (panel) {
        return <SettingSubPanel panel={panel} onBack={() => setPanel(null)} user={user} />;
    }

    const items = [
        { id: "security", icon: LockClosedIcon, label: "Account Security", sub: "Username & Password" },
        { id: "linked", icon: LinkIcon, label: "Linked Accounts", sub: "WhatsApp, Telegram" },
        { id: "notif", icon: BellIcon, label: "Notification Preferences" },
        { id: "currency", icon: BanknotesIcon, label: "Currency Settings", sub: "Default: IDR (Rp)" },
        { id: "subs", icon: CreditCardIcon, label: "Subscription Plan" },
        { id: "help", icon: QuestionMarkCircleIcon, label: "Help & Support" },
    ];

    return (
        <div className="px-4 py-4 space-y-2">
            {items.map((it) => (
                <button
                    key={it.id}
                    onClick={() => setPanel(it.id)}
                    className="w-full flex items-center gap-3 bg-white/5 rounded-xl px-3.5 py-3 text-left hover:bg-white/10 transition-colors"
                >
                    <div className="w-9 h-9 rounded-lg bg-orange/15 text-orange flex items-center justify-center shrink-0">
                        <it.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{it.label}</p>
                        {it.sub && <p className="text-[0.65rem] text-white/40">{it.sub}</p>}
                    </div>
                    <span className="text-white/30 text-lg leading-none">›</span>
                </button>
            ))}

            <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 mt-3 py-3 border border-rose-500/40 text-rose-400 rounded-xl font-semibold hover:bg-rose-500/10 transition-colors"
            >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Sign Out
            </button>

            <p className="text-center text-[0.65rem] text-white/30 mt-3">
                Version 0.0.1 (Build 1)
            </p>
        </div>
    );
}

// ─── Settings sub-panels ────────────────────────────────

function SettingSubPanel({ panel, onBack, user }) {
    const titles = {
        security: "Account Security",
        linked: "Linked Accounts",
        notif: "Notification Preferences",
        currency: "Currency Settings",
        subs: "Subscription Plan",
        help: "Help & Support",
    };

    return (
        <div className="px-4 py-4 space-y-3">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-white/60 text-sm hover:text-white mb-1"
            >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>{titles[panel] || "Pengaturan"}</span>
            </button>

            {panel === "security" && <AccountSecurityPanel user={user} />}
            {panel === "linked" && <LinkedAccountsPanel user={user} />}
            {panel === "notif" && <NotificationsPanel />}
            {panel === "currency" && <CurrencyPanel />}
            {panel === "subs" && <SubscriptionPanel user={user} />}
            {panel === "help" && <HelpPanel />}
        </div>
    );
}

function AccountSecurityPanel({ user }) {
    const [tab, setTab] = useState("password"); // "username" | "password"
    const [username, setUsername] = useState(user?.username || "");
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null); // { type: "ok"|"err", text }

    async function submitUsername(e) {
        e.preventDefault();
        if (!username.trim() || username === user?.username) return;
        setBusy(true); setMsg(null);
        try {
            const r = await fetch(`${API}/update-profile`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ web_login: username.trim() }),
            });
            const data = await r.json();
            if (r.ok && data.success) {
                setMsg({ type: "ok", text: "Username diperbarui. Login berikutnya pakai username baru." });
            } else {
                setMsg({ type: "err", text: data.error || "Gagal memperbarui." });
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa terhubung ke server." });
        } finally { setBusy(false); }
    }

    async function submitPassword(e) {
        e.preventDefault();
        setMsg(null);
        if (newPw.length < 6) {
            setMsg({ type: "err", text: "Password baru minimal 6 karakter." }); return;
        }
        if (newPw !== confirmPw) {
            setMsg({ type: "err", text: "Konfirmasi password tidak cocok." }); return;
        }
        setBusy(true);
        try {
            const r = await fetch(`${API}/change-password`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
            });
            const data = await r.json();
            if (r.ok && data.success) {
                setMsg({ type: "ok", text: "Password berhasil diubah." });
                setCurrentPw(""); setNewPw(""); setConfirmPw("");
            } else {
                setMsg({ type: "err", text: data.error || "Gagal mengubah password." });
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa terhubung ke server." });
        } finally { setBusy(false); }
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-lg p-1">
                {["username", "password"].map((t) => (
                    <button
                        key={t}
                        onClick={() => { setTab(t); setMsg(null); }}
                        className={`text-xs font-semibold py-2 rounded-md transition-colors ${tab === t ? "bg-orange text-white" : "text-white/50"}`}
                    >
                        {t === "username" ? "Username" : "Password"}
                    </button>
                ))}
            </div>

            {msg && (
                <div className={`text-xs rounded-lg px-3 py-2 ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                    {msg.text}
                </div>
            )}

            {tab === "username" ? (
                <form onSubmit={submitUsername} className="space-y-3">
                    <FormField label="Username">
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username baru"
                            autoComplete="username"
                            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange/50"
                        />
                    </FormField>
                    <button
                        type="submit"
                        disabled={busy || !username.trim() || username === user?.username}
                        className="w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark disabled:opacity-40 transition-colors"
                    >
                        {busy ? "Menyimpan..." : "Simpan Username"}
                    </button>
                </form>
            ) : (
                <form onSubmit={submitPassword} className="space-y-3">
                    <FormField label="Password Sekarang">
                        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange/50" />
                    </FormField>
                    <FormField label="Password Baru (min 6 karakter)">
                        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange/50" />
                    </FormField>
                    <FormField label="Konfirmasi Password Baru">
                        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange/50" />
                    </FormField>
                    <button
                        type="submit"
                        disabled={busy || !currentPw || !newPw || !confirmPw}
                        className="w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark disabled:opacity-40 transition-colors"
                    >
                        {busy ? "Mengubah..." : "Ubah Password"}
                    </button>
                </form>
            )}
        </div>
    );
}

function LinkedAccountsPanel() {
    const [status, setStatus] = useState(null); // { linked, telegram_id }
    const [link, setLink] = useState(null); // { code, deep_link }
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [msg, setMsg] = useState(null);

    async function loadStatus() {
        try {
            const r = await fetch(`${API}/telegram/status`, { credentials: "include" });
            if (r.ok) setStatus(await r.json());
        } catch { /* ignore */ }
    }

    useEffect(() => { loadStatus(); }, []);

    async function generateCode() {
        setBusy(true); setMsg(null); setCopied(false);
        try {
            const r = await fetch(`${API}/telegram/link-code`, {
                method: "POST", credentials: "include",
            });
            const data = await r.json();
            if (r.ok && data.success) {
                setLink(data);
            } else {
                setMsg({ type: "err", text: data.error || "Gagal membuat kode." });
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa terhubung ke server." });
        } finally { setBusy(false); }
    }

    async function unlink() {
        if (!window.confirm("Putuskan Telegram dari akun ini?")) return;
        setBusy(true); setMsg(null);
        try {
            const r = await fetch(`${API}/telegram/unlink`, {
                method: "POST", credentials: "include",
            });
            if (r.ok) { setLink(null); await loadStatus(); }
        } catch { /* ignore */ } finally { setBusy(false); }
    }

    function copyCode() {
        if (!link?.code) return;
        navigator.clipboard?.writeText(link.code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    const linked = status?.linked;

    return (
        <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0"><PaperAirplaneIcon className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">Telegram</p>
                        <p className="text-[0.65rem] text-white/40">
                            {linked ? `ID: ${status.telegram_id}` : "Belum terhubung"}
                        </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[0.6rem] font-bold rounded uppercase tracking-wider ${linked ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}`}>
                        {linked ? "Terhubung" : "Belum"}
                    </span>
                </div>

                {msg && (
                    <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${msg.type === "err" ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                        {msg.text}
                    </div>
                )}

                {linked ? (
                    <button
                        onClick={unlink}
                        disabled={busy}
                        className="mt-3 w-full py-2.5 border border-rose-500/40 text-rose-400 text-sm font-semibold rounded-lg hover:bg-rose-500/10 disabled:opacity-40"
                    >
                        Putuskan Telegram
                    </button>
                ) : link ? (
                    <div className="mt-3 space-y-3">
                        <ol className="text-[0.7rem] text-white/60 space-y-1 list-decimal list-inside">
                            <li>Tekan tombol di bawah untuk membuka bot Telegram.</li>
                            <li>Tekan <b className="text-white/80">START</b> di chat @finot_finance_bot.</li>
                            <li>Akun otomatis terhubung &amp; chat tersinkron.</li>
                        </ol>
                        <a
                            href={link.deep_link}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark"
                        >
                            Buka Telegram &amp; Hubungkan
                        </a>
                        <button
                            onClick={copyCode}
                            className="w-full text-center text-[0.7rem] text-white/50 hover:text-orange"
                        >
                            {copied ? "Kode disalin" : `Atau kirim manual: /start link_${link.code} (salin kode)`}
                        </button>
                        <p className="text-[0.6rem] text-white/30 text-center">Kode berlaku 15 menit.</p>
                    </div>
                ) : (
                    <button
                        onClick={generateCode}
                        disabled={busy}
                        className="mt-3 w-full py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark disabled:opacity-40"
                    >
                        {busy ? "Membuat kode..." : "Hubungkan Telegram"}
                    </button>
                )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 opacity-60">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-300 flex items-center justify-center shrink-0"><ChatBubbleLeftRightIcon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">WhatsApp</p>
                    <p className="text-[0.65rem] text-white/40">Segera hadir</p>
                </div>
                <span className="px-2 py-0.5 text-[0.6rem] font-bold rounded uppercase tracking-wider bg-white/10 text-white/50">
                    Belum
                </span>
            </div>

            <p className="text-[0.65rem] text-white/40 px-1">
                Menautkan Telegram membuat catatan transaksimu tersinkron antara web app FiNot
                dan chat bot Telegram (@finot_finance_bot).
            </p>
        </div>
    );
}

const NOTIF_PREFS_KEY = "finot_notif_prefs";

function NotificationsPanel() {
    const [prefs, setPrefs] = useState(() => {
        try {
            const raw = localStorage.getItem(NOTIF_PREFS_KEY);
            if (raw) return JSON.parse(raw);
        } catch { /* ignore */ }
        return {
            daily_insight: true,
            spending_alert: true,
            weekly_summary: true,
            payment_reminder: true,
        };
    });
    const [pushState, setPushState] = useState("checking");
    const [pushMessage, setPushMessage] = useState("");

    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setPushState("unsupported");
            return;
        }
        navigator.serviceWorker.ready
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => setPushState(subscription ? "enabled" : "disabled"))
            .catch(() => setPushState("disabled"));
    }, []);

    function urlBase64ToUint8Array(value) {
        const padding = "=".repeat((4 - (value.length % 4)) % 4);
        const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = window.atob(base64);
        return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
    }

    async function enablePush() {
        setPushMessage("");
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan.");

            const keyResponse = await fetch("/api/push/public-key");
            const keyData = await keyResponse.json();
            if (!keyResponse.ok || !keyData.enabled) {
                throw new Error("Web Push belum dikonfigurasi di server.");
            }

            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(keyData.public_key),
                });
            }

            const response = await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...subscription.toJSON(), prefs }),
            });
            if (!response.ok) throw new Error("Gagal menyimpan perangkat untuk notifikasi.");
            setPushState("enabled");
            setPushMessage("Notifikasi FiNot aktif di perangkat ini.");
        } catch (error) {
            setPushState("disabled");
            setPushMessage(error.message || "Gagal mengaktifkan notifikasi.");
        }
    }

    async function disablePush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await fetch("/api/push/unsubscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                await subscription.unsubscribe();
            }
            setPushState("disabled");
            setPushMessage("Notifikasi dinonaktifkan di perangkat ini.");
        } catch {
            setPushMessage("Gagal menonaktifkan notifikasi.");
        }
    }

    function toggle(key) {
        const next = { ...prefs, [key]: !prefs[key] };
        setPrefs(next);
        try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        if (pushState === "enabled") {
            navigator.serviceWorker.ready
                .then((registration) => registration.pushManager.getSubscription())
                .then((subscription) => subscription && fetch("/api/push/subscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...subscription.toJSON(), prefs: next }),
                }))
                .catch(() => {});
        }
    }

    const items = [
        { key: "daily_insight", label: "Insight Harian", sub: "Ringkasan keuangan tiap hari" },
        { key: "spending_alert", label: "Spending Alert", sub: "Notifikasi saat pengeluaran tidak wajar" },
        { key: "weekly_summary", label: "Ringkasan Mingguan", sub: "Laporan tiap Senin pagi" },
        { key: "payment_reminder", label: "Pengingat Pembayaran", sub: "Sebelum langganan berakhir" },
    ];

    return (
        <div className="bg-card border border-border rounded-2xl p-2 divide-y divide-border">
            <div className="px-3 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Notifikasi Perangkat</p>
                    <p className="text-[0.65rem] text-white/40">
                        {pushState === "enabled" ? "Aktif untuk browser/PWA ini" : "Terima pengingat saat FiNot ditutup"}
                    </p>
                </div>
                {pushState !== "unsupported" && (
                    <button
                        type="button"
                        onClick={pushState === "enabled" ? disablePush : enablePush}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold ${pushState === "enabled" ? "bg-white/10 text-white/70" : "bg-orange text-white"}`}
                    >
                        {pushState === "enabled" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                )}
            </div>
            {pushMessage && <p className="px-3 py-2 text-[0.68rem] text-sky-300">{pushMessage}</p>}
            {items.map((it) => (
                <div key={it.key} className="flex items-center gap-3 px-3 py-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{it.label}</p>
                        <p className="text-[0.65rem] text-white/40">{it.sub}</p>
                    </div>
                    <Switch checked={prefs[it.key]} onChange={() => toggle(it.key)} />
                </div>
            ))}
            <p className="text-[0.65rem] text-white/40 px-3 py-2">
                Preferensi tersimpan untuk perangkat ini. Push notification memerlukan HTTPS
                dan pada iPhone bekerja setelah FiNot ditambahkan ke Home Screen.
            </p>
        </div>
    );
}

function Switch({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-orange" : "bg-white/15"}`}
            aria-pressed={checked}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
    );
}

function CurrencyPanel() {
    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div>
                <p className="text-xs text-white/40 mb-2">Mata Uang Default</p>
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3.5 py-3">
                    <div className="w-9 h-9 rounded-lg bg-orange/15 text-orange flex items-center justify-center shrink-0 font-bold">Rp</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">IDR — Rupiah</p>
                        <p className="text-[0.65rem] text-white/40">Format: Rp 1.000.000</p>
                    </div>
                    <span className="text-emerald-400 text-xs font-semibold">Aktif</span>
                </div>
            </div>
            <p className="text-[0.65rem] text-white/40">
                Mata uang lain belum didukung. Semua transaksi otomatis dicatat dalam IDR.
            </p>
        </div>
    );
}

function SubscriptionPanel({ user }) {
    const [history, setHistory] = useState(null);
    useEffect(() => {
        fetch(`${API}/subscriptions`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setHistory(d?.history || []))
            .catch(() => { });
    }, []);

    const plan = user?.plan || "free";
    const planLabel = { free: "Free", trial: "Trial 7 Hari", pro: "Pro", elite: "Elite" }[plan] || plan;
    const isPaid = plan === "pro" || plan === "elite";

    return (
        <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-white/40 mb-1">Paket Aktif</p>
                <p className="text-xl font-bold text-orange">{planLabel}</p>
                {user?.trial_days_left != null && (
                    <p className="text-xs text-white/50 mt-1">Sisa trial: {user.trial_days_left} hari</p>
                )}
                <a
                    href="/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full text-center mt-3 py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark transition-colors"
                >
                    {isPaid ? "Perpanjang / Upgrade" : "Upgrade ke Pro / Elite"}
                </a>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-bold text-white/60 tracking-wider mb-3">RIWAYAT LANGGANAN</p>
                {history === null ? (
                    <p className="text-xs text-white/40">Memuat...</p>
                ) : history.length === 0 ? (
                    <p className="text-xs text-white/40">Belum ada riwayat langganan.</p>
                ) : (
                    <div className="space-y-2">
                        {history.slice(0, 5).map((h) => {
                            const active = h.status === "active";
                            return (
                                <div key={h.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold">{h.plan}</p>
                                        <p className="text-[0.65rem] text-white/40 truncate">
                                            {h.date} • {h.method}
                                            {h.amount > 0 ? ` • ${rp(h.amount)}` : ""}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[0.55rem] font-bold rounded shrink-0 ml-2 ${active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                                        {(h.status || "—").toUpperCase()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function HelpPanel() {
    return (
        <div className="space-y-3">
            <a
                href="/faq"
                target="_blank"
                rel="noreferrer"
                className="block bg-card border border-border rounded-2xl p-4 hover:bg-white/5 transition-colors"
            >
                <p className="text-sm font-semibold">FAQ</p>
                <p className="text-[0.65rem] text-white/40 mt-0.5">Pertanyaan umum seputar FiNot</p>
            </a>
            <a
                href="https://t.me/finot_finance_bot"
                target="_blank"
                rel="noreferrer"
                className="block bg-card border border-border rounded-2xl p-4 hover:bg-white/5 transition-colors"
            >
                <p className="text-sm font-semibold">Chat Bot Telegram</p>
                <p className="text-[0.65rem] text-white/40 mt-0.5">Akses FiNot juga dari Telegram</p>
            </a>
            <a
                href="mailto:support@finot.app?subject=Bantuan%20FiNot"
                className="block bg-card border border-border rounded-2xl p-4 hover:bg-white/5 transition-colors"
            >
                <p className="text-sm font-semibold">Hubungi Support</p>
                <p className="text-[0.65rem] text-white/40 mt-0.5">support@finot.app</p>
            </a>
            <p className="text-[0.65rem] text-white/40 px-1">
                Punya bug atau usulan? Buka halaman <a href="/dashboard/report" target="_blank" rel="noreferrer" className="text-orange underline">Report</a> di dashboard.
            </p>
        </div>
    );
}

function FormField({ label, children }) {
    return (
        <div>
            <label className="block text-[0.65rem] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">{label}</label>
            {children}
        </div>
    );
}

// ─── Small UI primitives ────────────────────────────────

function Card({ children }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4">{children}</div>
    );
}

function CardTitle({ icon: Icon, children }) {
    return (
        <div className="flex items-center gap-2 text-orange">
            {Icon ? <Icon className="w-4 h-4" /> : null}
            <span className="text-xs font-bold tracking-wider">{children}</span>
        </div>
    );
}

function Tile({ label, value, tone }) {
    const ToneIcon = tone === "up" ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    return (
        <div className={`rounded-xl px-3 py-3 ${tone === "up" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
            <p className="text-[0.6rem] text-white/50 mb-1 flex items-center gap-1">
                <ToneIcon className={`w-3 h-3 ${tone === "up" ? "text-emerald-400" : "text-rose-400"}`} />
                {label}
            </p>
            <p className={`text-base font-bold ${tone === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                {value}
            </p>
        </div>
    );
}

function LoadingShell() {
    return (
        <div className="px-4 py-4 space-y-3">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-28" />
            ))}
        </div>
    );
}
