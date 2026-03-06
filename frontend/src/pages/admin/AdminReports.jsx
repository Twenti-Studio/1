import { useEffect, useState } from "react";

const API = "/admin/api";
const STATUS_LABELS = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
};
const STATUS_COLORS = {
    open: "#f59e0b",
    in_progress: "#3b82f6",
    resolved: "#22c55e",
    closed: "#6b7280",
};

export default function AdminReports() {
    const [reports, setReports] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [replyingId, setReplyingId] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [replyStatus, setReplyStatus] = useState("resolved");
    const [sending, setSending] = useState(false);

    const fetchReports = async () => {
        try {
            const url = filter
                ? `${API}/reports?status=${filter}`
                : `${API}/reports`;
            const res = await fetch(url, { credentials: "include" });
            const data = await res.json();
            setReports(data.reports || []);
            setCounts(data.counts || {});
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [filter]);

    const handleReply = async (reportId) => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            await fetch(`${API}/reports/${reportId}/reply`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reply: replyText, status: replyStatus }),
            });
            setReplyingId(null);
            setReplyText("");
            fetchReports();
        } catch {
            alert("Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    const updateStatus = async (reportId, status) => {
        try {
            await fetch(`${API}/reports/${reportId}/status?status=${status}`, {
                method: "PUT",
                credentials: "include",
            });
            fetchReports();
        } catch {
            /* ignore */
        }
    };

    return (
        <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
                📋 User Reports
            </h1>

            {/* Status tabs */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {[
                    { key: "", label: `Semua (${counts.total || 0})` },
                    { key: "open", label: `Open (${counts.open || 0})` },
                    {
                        key: "in_progress",
                        label: `In Progress (${counts.in_progress || 0})`,
                    },
                    { key: "resolved", label: "Resolved" },
                    { key: "closed", label: "Closed" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filter === tab.key
                                ? "border-2 border-orange-500 bg-orange-50 text-orange-700"
                                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-gray-400">Loading...</p>
            ) : reports.length === 0 ? (
                <p className="text-gray-400">No reports found.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {reports.map((r) => (
                        <div
                            key={r.id}
                            className="bg-white border border-gray-200 rounded-xl p-4"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                        {r.subject}
                                    </h3>
                                    <div className="text-xs text-gray-500">
                                        👤 {r.user_name} ({r.user_plan.toUpperCase()}) ·{" "}
                                        {r.category.toUpperCase()} · {r.created_at?.split("T")[0]}
                                    </div>
                                </div>

                                <span
                                    style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        background: `${STATUS_COLORS[r.status]}22`,
                                        color: STATUS_COLORS[r.status],
                                        textTransform: "uppercase",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {STATUS_LABELS[r.status] || r.status}
                                </span>
                            </div>

                            {/* Message */}
                            <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                                {r.message}
                            </p>

                            {/* Existing admin reply */}
                            {r.admin_reply && (
                                <div className="p-2.5 rounded-lg bg-green-50 border-l-3 border-green-500 mb-3">
                                    <div className="text-xs font-semibold text-green-600 mb-1">
                                        ✅ Admin Reply
                                    </div>
                                    <p className="text-sm text-gray-700 m-0">
                                        {r.admin_reply}
                                    </p>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => {
                                        setReplyingId(replyingId === r.id ? null : r.id);
                                        setReplyText(r.admin_reply || "");
                                        setReplyStatus("resolved");
                                    }}
                                    className="px-3 py-1.5 rounded-md border border-orange-500 bg-transparent text-orange-500 text-xs cursor-pointer hover:bg-orange-50"
                                >
                                    💬 {r.admin_reply ? "Update Reply" : "Reply"}
                                </button>

                                {r.status === "open" && (
                                    <button
                                        onClick={() => updateStatus(r.id, "in_progress")}
                                        className="px-3 py-1.5 rounded-md border border-blue-500 bg-transparent text-blue-500 text-xs cursor-pointer hover:bg-blue-50"
                                    >
                                        🔄 Mark In Progress
                                    </button>
                                )}

                                {r.status !== "closed" && (
                                    <button
                                        onClick={() => updateStatus(r.id, "closed")}
                                        className="px-3 py-1.5 rounded-md border border-gray-400 bg-transparent text-gray-500 text-xs cursor-pointer hover:bg-gray-50"
                                    >
                                        ✖ Close
                                    </button>
                                )}
                            </div>

                            {/* Reply form */}
                            {replyingId === r.id && (
                                <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Tulis balasan untuk user..."
                                        rows={3}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm resize-y font-[inherit] mb-2 box-border focus:outline-none focus:border-orange-400"
                                    />
                                    <div className="flex gap-2 items-center">
                                        <select
                                            value={replyStatus}
                                            onChange={(e) => setReplyStatus(e.target.value)}
                                            className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 text-xs"
                                        >
                                            <option value="in_progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                        <button
                                            onClick={() => handleReply(r.id)}
                                            disabled={sending}
                                            className="px-4 py-1.5 rounded-md border-none bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {sending ? "Sending..." : "Send Reply"}
                                        </button>
                                        <button
                                            onClick={() => setReplyingId(null)}
                                            className="px-3 py-1.5 rounded-md border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer hover:bg-gray-100"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
