import { DocumentTextIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";

const API = "/admin/api";

export default function AdminLegal() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // slug being edited
  const [form, setForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/legal`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function startEdit(doc) {
    setEditing(doc.slug);
    setForm({ title: doc.title, content: doc.content });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ title: "", content: "" });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("Title dan content tidak boleh kosong");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/legal/${editing}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, content: form.content }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Dokumen berhasil diperbarui!");
        setEditing(null);
        fetchDocs();
      } else {
        showToast(data.error || "Gagal menyimpan");
      }
    } catch {
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
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <DocumentTextIcon className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Legal Documents</h1>
          <p className="text-sm text-gray-500">Kelola Terms of Service dan Privacy Policy</p>
        </div>
      </div>

      {/* Document list or editor */}
      {editing ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PencilSquareIcon className="w-5 h-5 text-gray-400" />
              Edit: {editing === "terms-of-service" ? "Terms of Service" : "Privacy Policy"}
            </h2>
            <button
              onClick={cancelEdit}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Batal
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-gray-400 font-normal">(Markdown)</span>
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={20}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono leading-relaxed focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => (
            <div
              key={doc.slug}
              className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  /{doc.slug} &middot; Diperbarui{" "}
                  {new Date(doc.updated_at).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {doc.content.length.toLocaleString()} karakter
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/legal/${doc.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Preview
                </a>
                <button
                  onClick={() => startEdit(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}

          {docs.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">
              Belum ada dokumen legal. Buka halaman publik terlebih dahulu untuk generate default.
            </p>
          )}
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
