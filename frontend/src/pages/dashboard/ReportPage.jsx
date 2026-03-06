import { useEffect, useState } from "react";

const API = "/api/user";
const STATUS_LABELS = {
    open: "Menunggu",
    in_progress: "Diproses",
    resolved: "Selesai",
    closed: "Ditutup",
};
const STATUS_COLORS = {
    open: "#f59e0b",
    in_progress: "#3b82f6",
    resolved: "#22c55e",
    closed: "#6b7280",
};
const CATEGORIES = [
    { value: "bug", label: "🐛 Bug / Error" },
    { value: "feature", label: "💡 Saran Fitur" },
    { value: "complaint", label: "😤 Keluhan" },
    { value: "other", label: "📝 Lainnya" },
];

export default function ReportPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Form
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [category, setCategory] = useState("bug");

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API}/reports`, { credentials: "include" });
            const data = await res.json();
            setReports(data.reports || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            setError("Subjek dan pesan wajib diisi");
            return;
        }
        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`${API}/reports`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, message, category }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(data.message || "Laporan berhasil dikirim!");
                setSubject("");
                setMessage("");
                setCategory("bug");
                fetchReports();
            } else {
                setError(data.error || "Gagal mengirim laporan");
            }
        } catch {
            setError("Gagal mengirim laporan");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
                📝 Report / Laporan
            </h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                Kirim laporan bug, saran fitur, atau keluhan. Tim kami akan menanggapi
                secepatnya.
            </p>

            {/* Form */}
            <form
                onSubmit={handleSubmit}
                style={{
                    background: "var(--card-bg, #1a1a2e)",
                    border: "1px solid var(--border, #2a2a4a)",
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 32,
                }}
            >
                <h2
                    style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}
                >
                    Kirim Laporan Baru
                </h2>

                {/* Category */}
                <div style={{ marginBottom: 16 }}>
                    <label
                        style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            marginBottom: 6,
                            color: "var(--text-secondary)",
                        }}
                    >
                        Kategori
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {CATEGORIES.map((c) => (
                            <button
                                type="button"
                                key={c.value}
                                onClick={() => setCategory(c.value)}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: 8,
                                    border:
                                        category === c.value
                                            ? "2px solid var(--accent, #f97316)"
                                            : "1px solid var(--border, #2a2a4a)",
                                    background:
                                        category === c.value
                                            ? "rgba(249,115,22,0.15)"
                                            : "transparent",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    transition: "all 0.2s",
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 16 }}>
                    <label
                        style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            marginBottom: 6,
                            color: "var(--text-secondary)",
                        }}
                    >
                        Subjek
                    </label>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Contoh: Bot tidak merespon perintah /insight"
                        maxLength={200}
                        style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "1px solid var(--border, #2a2a4a)",
                            background: "rgba(255,255,255,0.05)",
                            color: "#fff",
                            fontSize: "0.9rem",
                            outline: "none",
                            boxSizing: "border-box",
                        }}
                    />
                </div>

                {/* Message */}
                <div style={{ marginBottom: 16 }}>
                    <label
                        style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            marginBottom: 6,
                            color: "var(--text-secondary)",
                        }}
                    >
                        Detail Laporan
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Jelaskan masalah atau saran kamu secara detail..."
                        rows={5}
                        style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "1px solid var(--border, #2a2a4a)",
                            background: "rgba(255,255,255,0.05)",
                            color: "#fff",
                            fontSize: "0.9rem",
                            outline: "none",
                            resize: "vertical",
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                        }}
                    />
                </div>

                {error && (
                    <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: 12 }}>
                        ❌ {error}
                    </p>
                )}
                {success && (
                    <p style={{ color: "#22c55e", fontSize: "0.85rem", marginBottom: 12 }}>
                        ✅ {success}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        padding: "10px 24px",
                        borderRadius: 10,
                        border: "none",
                        background:
                            "linear-gradient(135deg, #f97316, #ea580c)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.7 : 1,
                        transition: "all 0.2s",
                    }}
                >
                    {submitting ? "Mengirim..." : "Kirim Laporan"}
                </button>
            </form>

            {/* Report History */}
            <h2
                style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}
            >
                Riwayat Laporan
            </h2>

            {loading ? (
                <p style={{ color: "var(--text-secondary)" }}>Memuat...</p>
            ) : reports.length === 0 ? (
                <p style={{ color: "var(--text-secondary)" }}>
                    Belum ada laporan. Kirim laporan pertamamu di atas! 👆
                </p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {reports.map((r) => (
                        <div
                            key={r.id}
                            style={{
                                background: "var(--card-bg, #1a1a2e)",
                                border: "1px solid var(--border, #2a2a4a)",
                                borderRadius: 12,
                                padding: 16,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 8,
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: "0.95rem",
                                        fontWeight: 600,
                                        margin: 0,
                                    }}
                                >
                                    {r.subject}
                                </h3>
                                <span
                                    style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        background: `${STATUS_COLORS[r.status]}22`,
                                        color: STATUS_COLORS[r.status],
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {STATUS_LABELS[r.status] || r.status}
                                </span>
                            </div>

                            <p
                                style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: 8,
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {r.message}
                            </p>

                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-tertiary, #666)",
                                    marginBottom: r.admin_reply ? 12 : 0,
                                }}
                            >
                                {r.category.toUpperCase()} · {r.created_at}
                            </div>

                            {r.admin_reply && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: 12,
                                        borderRadius: 8,
                                        background: "rgba(34,197,94,0.08)",
                                        borderLeft: "3px solid #22c55e",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            color: "#22c55e",
                                            marginBottom: 4,
                                        }}
                                    >
                                        💬 Balasan Admin
                                    </div>
                                    <p
                                        style={{
                                            fontSize: "0.85rem",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                        }}
                                    >
                                        {r.admin_reply}
                                    </p>
                                    {r.replied_at && (
                                        <div
                                            style={{
                                                fontSize: "0.7rem",
                                                color: "var(--text-tertiary, #666)",
                                                marginTop: 4,
                                            }}
                                        >
                                            {r.replied_at}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
