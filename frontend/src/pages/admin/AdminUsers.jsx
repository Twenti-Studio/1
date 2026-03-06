import {
    CheckCircleIcon,
    ClipboardDocumentIcon,
    EyeIcon,
    EyeSlashIcon,
    KeyIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    UserPlusIcon,
    UsersIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";

const Spinner = ({ className = "w-4 h-4" }) => (
  <div className={`${className} border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin`} />
);

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null);
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/app-users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleSetPassword(userId) {
    try {
      const res = await fetch(`/admin/api/app-users/${userId}/set-password`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPasswordModal({
          userId,
          password: data.password_plain,
          login: data.web_login,
          notifiedTelegram: data.notified_telegram ?? null,
        });
        fetchUsers();
      }
    } catch {
      showToast("Gagal generate password");
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast("Disalin ke clipboard!");
  }

  const [generatingCreds, setGeneratingCreds] = useState(false);

  async function handleGenerateSelectedCreds() {
    const ids = [...selected];
    if (ids.length === 0) {
      showToast("Pilih user terlebih dahulu");
      return;
    }
    if (!confirm(`Generate/kirim kredensial untuk ${ids.length} user terpilih?`)) return;
    setGeneratingCreds(true);
    try {
      const res = await fetch("/admin/api/app-users/generate-selected-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_ids: ids }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.count} akun berhasil di-generate dan dikirim!`);
        setSelected(new Set());
        fetchUsers();
      } else {
        showToast(data.error || "Gagal generate credentials");
      }
    } catch {
      showToast("Gagal generate credentials");
    } finally {
      setGeneratingCreds(false);
    }
  }

  async function handleGenerateAllMissing() {
    if (!confirm("Generate akun dashboard untuk semua user yang belum punya?\nCredentials akan dikirim via Telegram otomatis.")) return;
    setGeneratingCreds(true);
    try {
      const res = await fetch("/admin/api/app-users/generate-missing-credentials", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        if (data.count === 0) {
          showToast(data.message || "Semua user sudah punya akun!");
        } else {
          showToast(`✅ ${data.count} akun berhasil dibuat dan dikirim ke Telegram!`);
          fetchUsers();
        }
      } else {
        showToast("Gagal generate credentials");
      }
    } catch {
      showToast("Gagal generate credentials");
    } finally {
      setGeneratingCreds(false);
    }
  }

  async function handleDeleteUser(userId) {
    try {
      const res = await fetch(`/admin/api/app-users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || "User berhasil dihapus");
        setSelected((prev) => { const s = new Set(prev); s.delete(String(userId)); return s; });
        fetchUsers();
      } else {
        showToast(data.error || "Gagal menghapus user");
      }
    } catch {
      showToast("Gagal menghapus user");
    } finally {
      setDeleteConfirm(null);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(String(id))) s.delete(String(id));
      else s.add(String(id));
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => String(u.id))));
    }
  }

  const filtered = users.filter(
    (u) =>
      (u.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.web_login || "").toLowerCase().includes(search.toLowerCase())
  );

  const missingCredsCount = users.filter((u) => !u.has_web_access).length;
  const selectedCount = selected.size;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">{users.length} user terdaftar</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <button
              onClick={handleGenerateSelectedCreds}
              disabled={generatingCreds}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {generatingCreds ? <Spinner /> : <KeyIcon className="w-4 h-4" />}
              Generate {selectedCount} Terpilih
            </button>
          )}
          {selectedCount === 0 && missingCredsCount > 0 && (
            <button
              onClick={handleGenerateAllMissing}
              disabled={generatingCreds}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {generatingCreds ? <Spinner /> : <KeyIcon className="w-4 h-4" />}
              Generate {missingCredsCount} Akun
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <UserPlusIcon className="w-4 h-4" /> Tambah User
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari user..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-7 h-7" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Telegram</th>
                  <th className="px-4 py-3 font-medium">Web Login</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Web Access</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${selected.has(String(u.id)) ? "bg-indigo-50/50" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(String(u.id))}
                        onChange={() => toggleSelect(u.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {u.display_name || "-"}
                        </p>
                        <p className="text-xs text-gray-400">ID: {u.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.username || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {u.web_login || (
                        <span className="text-gray-300">Belum diatur</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-md capitalize ${u.plan === "elite"
                            ? "bg-purple-100 text-purple-700"
                            : u.plan === "pro"
                              ? "bg-orange-100 text-orange-700"
                              : u.plan === "trial"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.has_web_access ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Belum</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditUser(u)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          title="Edit user"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleSetPassword(u.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                          title="Generate/Reset password web"
                        >
                          <KeyIcon className="w-3.5 h-3.5" />
                          {u.has_web_access ? "Reset" : "Generate"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                          title="Hapus user"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                      Tidak ada user ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(data) => {
            setShowCreate(false);
            setPasswordModal({
              userId: data.user?.id,
              password: data.password_plain,
              login: data.user?.web_login,
              notifiedTelegram: data.user?.notified_telegram ?? null,
            });
            fetchUsers();
          }}
          showToast={showToast}
        />
      )}

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            fetchUsers();
            showToast("User berhasil diupdate");
          }}
          showToast={showToast}
        />
      )}

      {/* Password Modal */}
      {passwordModal && (
        <PasswordModal
          data={passwordModal}
          onClose={() => setPasswordModal(null)}
          onCopy={copyToClipboard}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
                <TrashIcon className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Hapus User?</h3>
              <p className="text-sm text-gray-500">
                User <span className="font-semibold text-gray-700">{deleteConfirm.display_name || deleteConfirm.id}</span> akan dihapus beserta semua data transaksi, subscription, dan kredit AI. Tindakan ini tidak bisa dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteConfirm.id)}
                  className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg animate-fade-in-up flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated, showToast }) {
  const [displayName, setDisplayName] = useState("");
  const [webLogin, setWebLogin] = useState("");
  const [password, setPassword] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Display name wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const body = {
        display_name: displayName.trim(),
        plan,
      };
      if (webLogin.trim()) body.web_login = webLogin.trim();
      if (password.trim()) body.password = password.trim();
      if (telegramId.trim()) body.telegram_id = Number(telegramId);

      const res = await fetch("/admin/api/app-users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreated({
          user: data.user,
          password_plain: data.user?.password_plain,
        });
      } else {
        const errMsg =
          data.error ||
          (Array.isArray(data.detail)
            ? data.detail.map((d) => d.msg).join(", ")
            : data.detail) ||
          "Gagal membuat user";
        showToast(errMsg);
      }
    } catch {
      showToast("Gagal membuat user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <UserPlusIcon className="w-4.5 h-4.5" /> Tambah User Baru
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4.5 h-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g. Andi Pratama"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Username (Web Login)
            </label>
            <input
              type="text"
              value={webLogin}
              onChange={(e) => setWebLogin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Kosongkan untuk auto-generate"
            />
            <p className="text-[0.65rem] text-gray-400 mt-1">
              Username untuk login di /login. Kosongkan untuk auto-generate.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Kosongkan untuk auto-generate"
            />
            <p className="text-[0.65rem] text-gray-400 mt-1">
              Kosongkan untuk generate random password.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Telegram ID (opsional)
              </label>
              <input
                type="number"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="123456789"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Plan
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="elite">Elite</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Spinner />
            ) : (
              <UserPlusIcon className="w-4 h-4" />
            )}
            Buat User
          </button>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved, showToast }) {
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [webLogin, setWebLogin] = useState(user.web_login || "");
  const [plan, setPlan] = useState(user.plan || "free");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {};
      if (displayName.trim() && displayName.trim() !== user.display_name)
        body.display_name = displayName.trim();
      if (webLogin.trim() && webLogin.trim() !== user.web_login)
        body.web_login = webLogin.trim();
      if (plan !== user.plan) body.plan = plan;

      if (Object.keys(body).length === 0) {
        showToast("Tidak ada perubahan");
        setLoading(false);
        return;
      }

      const res = await fetch(`/admin/api/app-users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSaved();
      } else {
        const errMsg =
          data.error ||
          (Array.isArray(data.detail)
            ? data.detail.map((d) => d.msg).join(", ")
            : data.detail) ||
          "Gagal update user";
        showToast(errMsg);
      }
    } catch {
      showToast("Gagal update user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <PencilSquareIcon className="w-4.5 h-4.5" /> Edit User
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4.5 h-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              User ID: <span className="font-mono font-semibold text-gray-700">{user.id}</span>
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Username (Web Login)
            </label>
            <input
              type="text"
              value={webLogin}
              onChange={(e) => setWebLogin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Plan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["free", "pro", "elite"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`py-2.5 text-sm font-semibold rounded-lg capitalize border-2 transition-all ${plan === p
                      ? p === "elite"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : p === "pro"
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-gray-400 bg-gray-50 text-gray-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {plan !== "free" && plan !== user.plan && (
              <p className="text-[0.65rem] text-amber-600 mt-1.5">
                Subscription 30 hari akan dibuat otomatis untuk plan {plan}.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Spinner />
            ) : (
              <CheckCircleIcon className="w-4 h-4" />
            )}
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordModal({ data, onClose, onCopy }) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <KeyIcon className="w-4.5 h-4.5" /> Kredensial Web
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">
              Simpan kredensial ini! Password tidak bisa dilihat lagi setelah modal ditutup.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Username
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono">
                {data.login}
              </code>
              <button
                onClick={() => onCopy(data.login)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Password
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono">
                {showPw ? data.password : "••••••••••"}
              </code>
              <button
                onClick={() => setShowPw(!showPw)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                {showPw ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onCopy(data.password)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            {data.notifiedTelegram && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs text-emerald-700 font-medium">
                  Kredensial sudah dikirim ke Telegram user.
                </p>
              </div>
            )}
            {data.notifiedTelegram === false && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500 font-medium">
                  User tidak punya Telegram ID — kirim kredensial secara manual.
                </p>
              </div>
            )}
            <button
              onClick={() =>
                onCopy(`Username: ${data.login}\nPassword: ${data.password}`)
              }
              className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <ClipboardDocumentIcon className="w-3.5 h-3.5" /> Salin Semua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
