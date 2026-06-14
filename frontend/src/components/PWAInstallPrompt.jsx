import { ArrowDownTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "finot_pwa_install_dismissed_at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function isStandalone() {
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

function isIOS() {
    const ua = window.navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

function wasRecentlyDismissed() {
    try {
        const ts = parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10);
        return ts && Date.now() - ts < DISMISS_TTL_MS;
    } catch {
        return false;
    }
}

/**
 * Floating banner that appears on the chat page to suggest installing the PWA.
 * - Android/desktop Chrome: shows native install button (uses beforeinstallprompt).
 * - iOS Safari: shows manual instruction (Share → Add to Home Screen).
 * - Hidden if app is already installed (standalone) or recently dismissed.
 */
export default function PWAInstallPrompt() {
    const [deferred, setDeferred] = useState(null);
    const [visible, setVisible] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        if (isStandalone() || wasRecentlyDismissed()) return;

        // Android / desktop Chrome
        const onBeforeInstall = (e) => {
            e.preventDefault();
            setDeferred(e);
            setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", onBeforeInstall);

        // iOS — no native prompt, show after small delay
        if (isIOS()) {
            const t = setTimeout(() => setVisible(true), 2000);
            return () => {
                clearTimeout(t);
                window.removeEventListener("beforeinstallprompt", onBeforeInstall);
            };
        }

        return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    }, []);

    function dismiss() {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* ignore */ }
        setVisible(false);
        setShowIOSGuide(false);
    }

    async function install() {
        if (deferred) {
            deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice?.outcome === "accepted") {
                setVisible(false);
            }
            setDeferred(null);
            return;
        }
        if (isIOS()) {
            setShowIOSGuide(true);
        }
    }

    if (!visible) return null;

    return (
        <>
            <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40">
                <div className="bg-navy-dark border border-orange/40 rounded-2xl shadow-2xl shadow-black/40 p-3 flex items-center gap-3 animate-fade-in-up">
                    <div className="w-10 h-10 rounded-xl bg-orange/20 text-orange flex items-center justify-center shrink-0">
                        <ArrowDownTrayIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Pasang FiNot</p>
                        <p className="text-[0.7rem] text-white/50 truncate">
                            Akses lebih cepat dari home screen, terasa seperti app.
                        </p>
                    </div>
                    <button
                        onClick={install}
                        className="px-3 py-1.5 bg-orange text-white text-xs font-semibold rounded-lg hover:bg-orange-dark shrink-0"
                    >
                        Pasang
                    </button>
                    <button
                        onClick={dismiss}
                        aria-label="Tutup"
                        className="p-1 text-white/40 hover:text-white shrink-0"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {showIOSGuide && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowIOSGuide(false)}
                >
                    <div
                        className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-bold mb-3">Pasang di iPhone/iPad</h3>
                        <ol className="space-y-2 text-sm text-white/70 list-decimal pl-4">
                            <li>Tap tombol <strong>Share</strong> <span aria-label="share">⎙</span> di bilah Safari.</li>
                            <li>Pilih <strong>Add to Home Screen</strong>.</li>
                            <li>Tap <strong>Add</strong>. FiNot akan tampil seperti app di home screen.</li>
                        </ol>
                        <button
                            onClick={() => setShowIOSGuide(false)}
                            className="w-full mt-4 py-2.5 bg-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-dark"
                        >
                            Mengerti
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
