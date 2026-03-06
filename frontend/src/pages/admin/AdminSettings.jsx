import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";

const API = "/admin/api";

const SETTING_META = [
  {
    group: "Pembayaran & Registrasi",
    items: [
      { key: "payment_enabled", label: "Pembayaran",  desc: "Aktifkan sistem pembayaran (QRIS via Trakteer)" },
      { key: "registration_enabled", label: "Registrasi", desc: "Izinkan user baru mendaftar" },
      { key: "trial_enabled", label: "Trial 7 Hari", desc: "Berikan trial gratis untuk user baru" },
    ],
  },
  {
    group: "Legal Documents",
    items: [
      { key: "legal_tos_enabled", label: "Terms of Service", desc: "Tampilkan halaman Terms of Service" },
      { key: "legal_privacy_enabled", label: "Privacy Policy", desc: "Tampilkan halaman Privacy Policy" },
    ],
  },
  {
    group: "Platform",
    items: [
      { key: "telegram_bot_enabled", label: "Telegram Bot", desc: "Aktifkan integrasi Telegram bot" },
      { key: "web_dashboard_enabled", label: "Web Dashboard", desc: "Aktifkan akses dashboard web untuk user" },
      { key: "maintenance_mode", label: "Mode Maintenance", desc: "Tampilkan halaman maintenance ke semua user" },
    ],
  },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleToggle(key, value) {
    // Optimistic update
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [key]: value } }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${key.replace(/_/g, " ")} ${value ? "diaktifkan" : "dinonaktifkan"}`);
      } else {
        // Rollback
        setSettings((prev) => ({ ...prev, [key]: !value }));
        showToast("Gagal menyimpan");
      }
    } catch {
      setSettings((prev) => ({ ...prev, [key]: !value }));
      showToast("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Cog6ToothIcon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Site Settings</h1>
          <p className="text-sm text-gray-500">Atur fitur dan konfigurasi platform</p>
        </div>
      </div>

      {/* Settings groups */}
      <div className="space-y-6">
        {SETTING_META.map((group) => (
          <div
            key={group.group}
            className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">{group.group}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={!!settings[item.key]}
                    onChange={(v) => handleToggle(item.key, v)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Warning for maintenance mode */}
      {settings.maintenance_mode && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ Mode Maintenance aktif — semua user akan melihat halaman maintenance.
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg z-50 animate-fade-in-up">
          {toast}
        </div>
      )}
    </div>
  );
}
