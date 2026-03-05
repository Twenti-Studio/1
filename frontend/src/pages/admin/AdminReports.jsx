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
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
                📋 User Reports
            </h1>

            {/* Status tabs */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 20,
                    flexWrap: "wrap",
                }}
            >
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
                        style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border:
                                filter === tab.key
                                    ? "2px solid #f97316"
                                    : "1px solid rgba(255,255,255,0.1)",
                            background:
                                filter === tab.key ? "rgba(249,115,22,0.15)" : "transparent",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p style={{ color: "#888" }}>Loading...</p>
            ) : reports.length === 0 ? (
                <p style={{ color: "#888" }}>No reports found.</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {reports.map((r) => (
                        <div
                            key={r.id}
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: 16,
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 8,
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                <div>
                                    <h3
                                        style={{
                                            fontSize: "0.95rem",
                                            fontWeight: 600,
                                            margin: "0 0 4px",
                                        }}
                                    >
                                        {r.subject}
                                    </h3>
                                    <div style={{ fontSize: "0.75rem", color: "#888" }}>
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
                            <p
                                style={{
                                    fontSize: "0.85rem",
                                    color: "rgba(255,255,255,0.7)",
                                    marginBottom: 12,
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {r.message}
                            </p>

                            {/* Existing admin reply */}
                            {r.admin_reply && (
                                <div
                                    style={{
                                        padding: 10,
                                        borderRadius: 8,
                                        background: "rgba(34,197,94,0.08)",
                                        borderLeft: "3px solid #22c55e",
                                        marginBottom: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            color: "#22c55e",
                                            marginBottom: 4,
                                        }}
                                    >
                                        ✅ Admin Reply
                                    </div>
                                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
                                        {r.admin_reply}
                                    </p>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => {
                                        setReplyingId(replyingId === r.id ? null : r.id);
                                        setReplyText(r.admin_reply || "");
                                        setReplyStatus("resolved");
                                    }}
                                    style={{
                                        padding: "5px 12px",
                                        borderRadius: 6,
                                        border: "1px solid #f97316",
                                        background: "transparent",
                                        color: "#f97316",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    💬 {r.admin_reply ? "Update Reply" : "Reply"}
                                </button>

                                {r.status === "open" && (
                                    <button
                                        onClick={() => updateStatus(r.id, "in_progress")}
                                        style={{
                                            padding: "5px 12px",
                                            borderRadius: 6,
                                            border: "1px solid #3b82f6",
                                            background: "transparent",
                                            color: "#3b82f6",
                                            cursor: "pointer",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        🔄 Mark In Progress
                                    </button>
                                )}

                                {r.status !== "closed" && (
                                    <button
                                        onClick={() => updateStatus(r.id, "closed")}
                                        style={{
                                            padding: "5px 12px",
                                            borderRadius: 6,
                                            border: "1px solid #6b7280",
                                            background: "transparent",
                                            color: "#6b7280",
                                            cursor: "pointer",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        ✖ Close
                                    </button>
                                )}
                            </div>

                            {/* Reply form */}
                            {replyingId === r.id && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: 12,
                                        borderRadius: 8,
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                >
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Tulis balasan untuk user..."
                                        rows={3}
                                        style={{
                                            width: "100%",
                                            padding: 10,
                                            borderRadius: 8,
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(255,255,255,0.05)",
                                            color: "#fff",
                                            fontSize: "0.85rem",
                                            resize: "vertical",
                                            fontFamily: "inherit",
                                            marginBottom: 8,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <select
                                            value={replyStatus}
                                            onChange={(e) => setReplyStatus(e.target.value)}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: 6,
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                background: "rgba(255,255,255,0.05)",
                                                color: "#fff",
                                                fontSize: "0.8rem",
                                            }}
                                        >
                                            <option value="in_progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                        <button
                                            onClick={() => handleReply(r.id)}
                                            disabled={sending}
                                            style={{
                                                padding: "6px 16px",
                                                borderRadius: 6,
                                                border: "none",
                                                background: "#f97316",
                                                color: "#fff",
                                                cursor: sending ? "not-allowed" : "pointer",
                                                fontSize: "0.8rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {sending ? "Sending..." : "Send Reply"}
                                        </button>
                                        <button
                                            onClick={() => setReplyingId(null)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 6,
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                background: "transparent",
                                                color: "#888",
                                                cursor: "pointer",
                                                fontSize: "0.8rem",
                                            }}
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
