import {
    ArrowLeftOnRectangleIcon,
    MicrophoneIcon,
    PaperAirplaneIcon,
    PaperClipIcon,
    StopIcon,
    TrashIcon,
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
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const recorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/history`, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setMessages(data.messages || []);
            } catch {
                setError("Gagal memuat riwayat chat");
            }
        })();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending]);

    function appendLocalUser(content, kind = "text") {
        setMessages((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                role: "user",
                kind,
                content,
                created_at: new Date().toISOString(),
            },
        ]);
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
        appendLocalUser(text, "text");
        setInput("");
        setSending(true);
        setError("");
        try {
            const res = await fetch(`${API}/text`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            appendAssistant(data.messages || []);
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
        } catch {
            setError("Gagal menghapus riwayat.");
        }
    }

    async function handleLogout() {
        setMenuOpen(false);
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <div className="h-full flex flex-col bg-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            {/* Header — click to open features drawer */}
            <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-navy-dark/95 backdrop-blur">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 active:opacity-80 transition-opacity"
                    aria-label="Buka menu fitur"
                >
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                            <Logo className="h-6 w-auto" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-navy-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">Asisten FiNot</p>
                        <p className="text-[0.7rem] text-emerald-400">Aktif Sekarang</p>
                    </div>
                </button>
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="p-2 -mr-2 text-white/60 hover:text-white"
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
                        Halo! Mulai catat transaksi atau tanya FiNot apa saja.<br />
                        Contoh: <span className="text-white/60">"beli makan 25rb"</span> atau{" "}
                        <span className="text-white/60">"gajian 5jt"</span>.
                    </div>
                )}
                {messages.map((m) => (<MessageBubble key={m.id} msg={m} />))}
                {sending && (
                    <div className="flex items-center gap-1.5 text-white/50 text-xs px-2">
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce" />
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce [animation-delay:120ms]" />
                        <span className="inline-block w-1.5 h-1.5 bg-orange rounded-full animate-bounce [animation-delay:240ms]" />
                        <span className="ml-1">FiNot sedang mengetik…</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="flex-shrink-0 px-4 py-2 text-xs text-red-300 bg-red-500/10 border-t border-red-500/20">{error}</div>
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

            {/* Features drawer (opened by tapping the chat header) */}
            <FeaturesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* PWA install prompt (Android/Chrome native, iOS manual guide) */}
            <PWAInstallPrompt />
        </div>
    );
}

function MessageBubble({ msg }) {
    const [lightbox, setLightbox] = useState(false);
    const isUser = msg.role === "user";
    if (msg.kind === "system") return <SystemCard msg={msg} />;

    const fileUrl = msg.meta?.file_url;
    const isImage = msg.kind === "image" && fileUrl;
    const isAudio = msg.kind === "audio" && fileUrl;

    return (
        <>
            <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden ${isUser ? "bg-orange text-white rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"} ${isImage ? "p-1" : "px-3.5 py-2"}`}>
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

function SystemCard({ msg }) {
    const choices = msg.meta?.choices || [];
    return (
        <div className="flex justify-start">
            <div className="max-w-[85%] w-full rounded-2xl rounded-bl-sm bg-white/5 border border-border px-3.5 py-3 text-sm text-white">
                <div className="whitespace-pre-wrap break-words text-white/80 mb-2" dangerouslySetInnerHTML={{ __html: sanitize(msg.content) }} />
                {choices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {choices.map((c) => (
                            <span key={c.key} className="px-2.5 py-1 rounded-full bg-orange/20 text-orange text-[0.7rem] font-medium border border-orange/30">
                                {c.label}
                            </span>
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
