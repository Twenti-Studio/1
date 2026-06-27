import {
    ArrowLeftOnRectangleIcon,
    ArrowRightIcon,
    ArrowUturnLeftIcon,
    Bars3Icon,
    MicrophoneIcon,
    PaperAirplaneIcon,
    PaperClipIcon,
    PlusIcon,
    StopIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FeaturesDrawer from "../../components/FeaturesDrawer";
import Logo from "../../components/Logo";
import PWAInstallPrompt from "../../components/PWAInstallPrompt";
import { useUserAuth } from "../../context/UserAuthContext";

const API = "/api/chat";

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function pad(n) {
    return String(n).padStart(2, "0");
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tzOffset() {
    // Minutes ahead of UTC (e.g. WIB = +420). Matches backend make_interval(mins).
    return -new Date().getTimezoneOffset();
}

/** Local-day bounds for a "YYYY-MM-DD" string, returned as UTC ISO strings. */
function dayBounds(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
}

function dateLabel(dateStr) {
    if (!dateStr) return "";
    if (dateStr === todayStr()) return "Hari Ini";
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
    if (dateStr === yStr) return "Kemarin";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function ChatPage() {
    const { logout } = useUserAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedDate, setSelectedDate] = useState(todayStr());
    const [replyTo, setReplyTo] = useState(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const recorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    async function loadSessions() {
        try {
            const res = await fetch(`${API}/sessions?tz_offset=${tzOffset()}`, {
                credentials: "include",
            });
            if (!res.ok) return;
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch {
            /* non-critical */
        }
    }

    async function loadHistory(dateStr) {
        const { start, end } = dayBounds(dateStr);
        try {
            const res = await fetch(
                `${API}/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setMessages(data.messages || []);
        } catch {
            setError("Gagal memuat riwayat chat");
        }
    }

    useEffect(() => {
        loadSessions();
        loadHistory(todayStr());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending]);

    function selectDate(dateStr) {
        setSelectedDate(dateStr);
        loadHistory(dateStr);
        setSidebarOpen(false);
    }

    function newChat() {
        const t = todayStr();
        setSelectedDate(t);
        loadHistory(t);
        setSidebarOpen(false);
    }

    /** Make sure new messages land in today's room before sending. */
    async function ensureToday() {
        const t = todayStr();
        if (selectedDate !== t) {
            setSelectedDate(t);
            await loadHistory(t);
        }
    }

    function appendLocalUser(content, kind = "text", meta = {}) {
        setMessages((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                role: "user",
                kind,
                content,
                meta,
                created_at: new Date().toISOString(),
            },
        ]);
    }

    /** Build the compact reply context sent to the backend / stored on the bubble. */
    function buildReplyCtx(msg) {
        if (!msg) return null;
        return {
            id: String(msg.id || ""),
            role: msg.role || "assistant",
            content: stripHtml(msg.content || "").slice(0, 280),
        };
    }

    function appendAssistant(items = []) {
        const now = new Date().toISOString();
        setMessages((prev) => [
            ...prev,
            ...items.map((m, i) => ({
                id: `srv-${Date.now()}-${i}`,
                role: "assistant",
                kind: m.kind || "text",
                content: m.content,
                meta: m.meta || {},
                created_at: now,
            })),
        ]);
    }

    async function sendText() {
        const text = input.trim();
        if (!text || sending) return;
        await ensureToday();
        const replyCtx = buildReplyCtx(replyTo);
        appendLocalUser(text, "text", replyCtx ? { reply_to: replyCtx } : {});
        setInput("");
        setReplyTo(null);
        setSending(true);
        setError("");
        try {
            const res = await fetch(`${API}/text`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, reply_to: replyCtx }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            appendAssistant(data.messages || []);
            loadSessions();
        } catch {
            setError("Gagal mengirim pesan. Coba lagi.");
        } finally {
            setSending(false);
        }
    }

    async function uploadFile(file) {
        if (!file) return;
        const isImage = (file.type || "").startsWith("image/");
        const isAudio = (file.type || "").startsWith("audio/");
        if (!isImage && !isAudio) {
            setError("Hanya gambar atau audio yang didukung.");
            return;
        }
        await ensureToday();
        appendLocalUser(isImage ? "[foto struk]" : "[pesan suara]", isImage ? "image" : "audio");
        setSending(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file, file.name || (isImage ? "receipt.jpg" : "voice.webm"));
            const endpoint = isImage ? "image" : "audio";
            const res = await fetch(`${API}/${endpoint}`, {
                method: "POST",
                credentials: "include",
                body: fd,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            appendAssistant(data.messages || []);
            loadSessions();
        } catch {
            setError("Gagal memproses lampiran.");
        } finally {
            setSending(false);
        }
    }

    function handleAttachClick() { fileInputRef.current?.click(); }
    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
        e.target.value = "";
    }

    async function toggleRecording() {
        if (recording) { recorderRef.current?.stop(); return; }
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Browser tidak mendukung rekaman suara."); return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            recorder.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                stream.getTracks().forEach((t) => t.stop());
                setRecording(false);
                const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
                uploadFile(file);
            };
            recorder.start();
            recorderRef.current = recorder;
            setRecording(true);
        } catch {
            setError("Tidak dapat mengakses mikrofon.");
        }
    }

    async function clearHistory() {
        setMenuOpen(false);
        if (!window.confirm("Hapus seluruh riwayat chat?")) return;
        try {
            await fetch(`${API}/history`, { method: "DELETE", credentials: "include" });
            setMessages([]);
            setSessions([]);
            setSelectedDate(todayStr());
        } catch {
            setError("Gagal menghapus riwayat.");
        }
    }

    async function handleLogout() {
        setMenuOpen(false);
        await logout();
        navigate("/login", { replace: true });
    }

    const viewingPast = selectedDate !== todayStr();

    return (
        <div className="h-full flex flex-col bg-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            {/* Header */}
            <header className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border bg-navy-dark/95 backdrop-blur">
                <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-1 text-white/60 hover:text-white"
                    aria-label="Buka riwayat chat"
                >
                    <Bars3Icon className="w-5 h-5" />
                </button>

                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-90 active:opacity-80 transition-opacity"
                    aria-label="Buka menu fitur"
                >
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                            <Logo className="h-5 w-auto" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-navy-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{dateLabel(selectedDate)}</p>
                        <p className="text-[0.7rem] text-emerald-400">Asisten FiNot</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={newChat}
                    className="p-2 text-white/60 hover:text-orange"
                    title="Chat baru (hari ini)"
                    aria-label="Chat baru"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>

                <div className="relative">
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="p-2 -mr-1 text-white/60 hover:text-white"
                        title="Menu"
                        aria-label="Menu"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-48 z-40 bg-navy-dark border border-border rounded-xl shadow-xl overflow-hidden">
                                <button
                                    onClick={clearHistory}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/80 hover:bg-white/5"
                                >
                                    <TrashIcon className="w-4 h-4" /> Bersihkan riwayat
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 border-t border-border"
                                >
                                    <ArrowLeftOnRectangleIcon className="w-4 h-4" /> Keluar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-white/40 text-sm py-16 px-4">
                        {viewingPast ? (
                            <>Tidak ada chat di {dateLabel(selectedDate)}.</>
                        ) : (
                            <>
                                Halo! Mulai catat transaksi atau tanya FiNot apa saja.<br />
                                Contoh: <span className="text-white/60">"beli makan 25rb"</span> atau{" "}
                                <span className="text-white/60">"gajian 5jt"</span>.
                            </>
                        )}
                    </div>
                )}
                {messages.map((m) => (<MessageBubble key={m.id} msg={m} onReply={setReplyTo} />))}
                {sending && (
                    <div className="flex items-center gap-1.5 text-white/50 text-xs px-2">
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce" />
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce [animation-delay:120ms]" />
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce [animation-delay:240ms]" />
                        <span className="ml-1">FiNot sedang mengetik…</span>
                    </div>
                )}
            </div>

            {viewingPast && (
                <button
                    type="button"
                    onClick={newChat}
                    className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 text-[0.7rem] text-orange/90 bg-orange/10 border-t border-orange/20 hover:bg-orange/15"
                >
                    Kamu melihat chat lama. Ketuk untuk kembali ke chat hari ini
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
            )}

            {error && (
                <div className="flex-shrink-0 px-4 py-2 text-xs text-red-300 bg-red-500/10 border-t border-red-500/20">{error}</div>
            )}

            {/* Reply preview (swipe-to-reply) */}
            {replyTo && (
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-orange/20 bg-orange/10">
                    <ArrowUturnLeftIcon className="w-4 h-4 text-orange shrink-0" />
                    <div className="flex-1 min-w-0 border-l-2 border-orange pl-2">
                        <p className="text-[0.65rem] text-orange font-semibold">
                            Membalas {replyTo.role === "user" ? "pesanmu" : "FiNot"}
                        </p>
                        <p className="text-xs text-white/70 truncate">{stripHtml(replyTo.content)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="p-1 text-white/50 hover:text-white shrink-0"
                        aria-label="Batal balas"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Composer */}
            <form
                onSubmit={(e) => { e.preventDefault(); sendText(); }}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-border bg-navy-dark/95"
                style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
            >
                <button
                    type="button"
                    onClick={handleAttachClick}
                    disabled={sending || recording}
                    className="p-2 text-white/50 hover:text-orange disabled:opacity-40"
                    aria-label="Lampirkan foto struk"
                >
                    <PaperClipIcon className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,audio/*" onChange={handleFileChange} className="hidden" />
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={recording ? "Merekam suara…" : "Ketik pesan…"}
                    disabled={sending || recording}
                    className="flex-1 bg-bg/60 text-sm text-white placeholder-white/30 rounded-full px-4 py-2.5 outline-none focus:ring-1 focus:ring-orange disabled:opacity-50"
                />
                {input.trim() ? (
                    <button type="submit" disabled={sending} className="p-2.5 rounded-full bg-orange text-white hover:bg-orange-dark disabled:opacity-40">
                        <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={sending}
                        className={`p-2.5 rounded-full ${recording ? "bg-red-500 text-white animate-pulse" : "bg-navy-dark border border-border text-orange hover:bg-white/5"} disabled:opacity-40`}
                        aria-label={recording ? "Berhenti merekam" : "Rekam suara"}
                    >
                        {recording ? <StopIcon className="w-4 h-4" /> : <MicrophoneIcon className="w-4 h-4" />}
                    </button>
                )}
            </form>

            {/* History sidebar (closed by default, opens from the left) */}
            <ChatSidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                sessions={sessions}
                selectedDate={selectedDate}
                onSelect={selectDate}
                onNewChat={newChat}
            />

            {/* Features drawer (opened by tapping the chat header) */}
            <FeaturesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* PWA install prompt */}
            <PWAInstallPrompt />
        </div>
    );
}

function ChatSidebar({ open, onClose, sessions, selectedDate, onSelect, onNewChat }) {
    const today = todayStr();
    const hasToday = sessions.some((s) => s.date === today);
    // Always surface a "today" entry so the user can jump back even with no messages yet.
    const list = hasToday ? sessions : [{ date: today, count: 0 }, ...sessions];

    return (
        <>
            <div
                className={`fixed inset-0 z-50 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[80%] bg-navy-dark border-r border-border flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
                style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
                    <p className="text-sm font-semibold text-white">Riwayat Chat</p>
                    <button onClick={onClose} className="p-1.5 -mr-1.5 text-white/50 hover:text-white" aria-label="Tutup">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={onNewChat}
                    className="flex items-center gap-2 mx-3 mt-3 px-3 py-2.5 rounded-xl bg-orange/15 text-orange text-sm font-semibold hover:bg-orange/25 transition-colors"
                >
                    <PlusIcon className="w-4 h-4" /> Chat Baru
                </button>

                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                    {list.length === 0 && (
                        <p className="text-center text-white/40 text-xs py-8">Belum ada riwayat.</p>
                    )}
                    {list.map((s) => {
                        const active = s.date === selectedDate;
                        return (
                            <button
                                key={s.date}
                                onClick={() => onSelect(s.date)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${active ? "bg-orange/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                            >
                                <span className="text-sm font-medium truncate">{dateLabel(s.date)}</span>
                                {s.count > 0 && (
                                    <span className="text-[0.6rem] text-white/40 shrink-0">{s.count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="px-4 py-3 text-[0.6rem] text-white/30 border-t border-border">
                    Tiap tanggal jadi satu room chat, tersinkron otomatis dengan Telegram.
                </p>
            </aside>
        </>
    );
}

/** Swipe-to-reply hook: drag a bubble left→right past a threshold to reply. */
function useSwipeToReply(onTrigger) {
    const startX = useRef(0);
    const startY = useRef(0);
    const active = useRef(false);
    const [dx, setDx] = useState(0);
    const THRESHOLD = 60;

    function down(clientX, clientY) {
        startX.current = clientX;
        startY.current = clientY;
        active.current = true;
    }
    function move(clientX, clientY) {
        if (!active.current) return;
        const deltaX = clientX - startX.current;
        const deltaY = Math.abs(clientY - startY.current);
        // Only react to mostly-horizontal rightward drags
        if (deltaX > 0 && deltaX > deltaY) {
            setDx(Math.min(deltaX, 90));
        }
    }
    function up() {
        if (!active.current) return;
        active.current = false;
        if (dx >= THRESHOLD) onTrigger();
        setDx(0);
    }

    const handlers = {
        onTouchStart: (e) => down(e.touches[0].clientX, e.touches[0].clientY),
        onTouchMove: (e) => move(e.touches[0].clientX, e.touches[0].clientY),
        onTouchEnd: up,
        onPointerDown: (e) => { if (e.pointerType === "mouse") down(e.clientX, e.clientY); },
        onPointerMove: (e) => { if (e.pointerType === "mouse") move(e.clientX, e.clientY); },
        onPointerUp: (e) => { if (e.pointerType === "mouse") up(); },
        onPointerLeave: (e) => { if (e.pointerType === "mouse") up(); },
    };
    return { handlers, dx, reached: dx >= THRESHOLD };
}

function ReplyQuote({ replyTo, isUser }) {
    if (!replyTo) return null;
    return (
        <div className={`mb-1.5 border-l-2 pl-2 py-0.5 rounded-sm ${isUser ? "border-white/60 bg-white/10" : "border-orange bg-black/20"}`}>
            <p className={`text-[0.6rem] font-semibold ${isUser ? "text-white/80" : "text-orange"}`}>
                {replyTo.role === "user" ? "Pesanmu" : "FiNot"}
            </p>
            <p className="text-[0.7rem] opacity-80 truncate">{stripHtml(replyTo.content)}</p>
        </div>
    );
}

function MessageBubble({ msg, onReply }) {
    const [lightbox, setLightbox] = useState(false);
    const isUser = msg.role === "user";
    const swipe = useSwipeToReply(() => onReply && onReply(msg));
    if (msg.kind === "system") return <SystemCard msg={msg} onReply={onReply} />;

    const fileUrl = msg.meta?.file_url;
    const isImage = msg.kind === "image" && fileUrl;
    const isAudio = msg.kind === "audio" && fileUrl;
    const replyTo = msg.meta?.reply_to;

    return (
        <>
            <div
                className={`relative flex items-center ${isUser ? "justify-end" : "justify-start"}`}
                {...swipe.handlers}
                style={{ touchAction: "pan-y" }}
            >
                <span
                    className={`absolute left-1 text-orange transition-opacity ${swipe.dx > 8 ? "opacity-100" : "opacity-0"}`}
                    aria-hidden="true"
                >
                    <ArrowUturnLeftIcon className="w-4 h-4" />
                </span>
                <div
                    className={`max-w-[80%] rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden ${isUser ? "bg-orange text-white rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"} ${isImage ? "p-1" : "px-3.5 py-2"}`}
                    style={{ transform: `translateX(${swipe.dx}px)`, transition: swipe.dx === 0 ? "transform 0.15s ease-out" : "none" }}
                >
                    {!isImage && <ReplyQuote replyTo={replyTo} isUser={isUser} />}
                    {isImage ? (
                        <button
                            type="button"
                            onClick={() => setLightbox(true)}
                            className="block w-full"
                            aria-label="Buka foto"
                        >
                            <img
                                src={fileUrl}
                                alt="Foto struk"
                                loading="lazy"
                                className="rounded-xl max-h-72 w-auto object-cover"
                            />
                        </button>
                    ) : isAudio ? (
                        <audio
                            controls
                            src={fileUrl}
                            className="block w-full max-w-[220px] mt-1 mb-1"
                            style={{ height: 36 }}
                        />
                    ) : msg.kind === "image" && isUser ? (
                        <div className="flex items-center gap-2 text-white/90"><PaperClipIcon className="w-4 h-4" /><span>Foto struk terkirim</span></div>
                    ) : msg.kind === "audio" && isUser ? (
                        <div className="flex items-center gap-2 text-white/90"><MicrophoneIcon className="w-4 h-4" /><span>Pesan suara terkirim</span></div>
                    ) : (
                        <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitize(msg.content) }} />
                    )}
                    <div className={`text-[0.6rem] ${isImage ? "px-2 pb-1" : "mt-1"} ${isUser ? "text-white/70" : "text-white/40"} text-right`}>
                        {formatTime(msg.created_at)}
                    </div>
                </div>
            </div>

            {lightbox && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightbox(false)}
                >
                    <img src={fileUrl} alt="Foto struk" className="max-w-full max-h-full object-contain rounded-xl" />
                    <button
                        onClick={() => setLightbox(false)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
                        aria-label="Tutup"
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
}

function SystemCard({ msg, onReply }) {
    const choices = msg.meta?.choices || [];
    const swipe = useSwipeToReply(() => onReply && onReply(msg));
    return (
        <div
            className="flex justify-start items-center relative"
            {...swipe.handlers}
            style={{ touchAction: "pan-y" }}
        >
            <span
                className={`absolute left-1 text-orange transition-opacity ${swipe.dx > 8 ? "opacity-100" : "opacity-0"}`}
                aria-hidden="true"
            >
                <ArrowUturnLeftIcon className="w-4 h-4" />
            </span>
            <div
                className="max-w-[85%] w-full rounded-2xl rounded-bl-sm bg-white/5 border border-border px-3.5 py-3 text-sm text-white"
                style={{ transform: `translateX(${swipe.dx}px)`, transition: swipe.dx === 0 ? "transform 0.15s ease-out" : "none" }}
            >
                <ReplyQuote replyTo={msg.meta?.reply_to} isUser={false} />
                <div className="whitespace-pre-wrap break-words text-white/80 mb-2" dangerouslySetInnerHTML={{ __html: sanitize(msg.content) }} />
                {choices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {choices.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => onReply && onReply(msg)}
                                className="px-2.5 py-1 rounded-full bg-orange/20 text-orange text-[0.7rem] font-medium border border-orange/30 hover:bg-orange/30 active:bg-orange/40 transition-colors"
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function sanitize(html) {
    if (!html) return "";
    return String(html)
        .replace(/<(?!\/?(b|i|br|strong|em)\b)[^>]*>/gi, "")
        .replace(/\n/g, "<br/>");
}

function stripHtml(html) {
    if (!html) return "";
    return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
