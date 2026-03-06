import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function LegalPage() {
  const { slug } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/landing/legal/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setDoc(data))
      .catch(() => setError("Dokumen tidak ditemukan."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="w-6 h-6 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-white/50">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-xs text-white/30 mb-2">
        Terakhir diperbarui: {new Date(doc.updated_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <article className="prose prose-invert prose-sm max-w-none legal-content">
        <MarkdownRenderer content={doc.content} />
      </article>
    </div>
  );
}

/* Simple Markdown → HTML renderer (headings, lists, bold, italic, links, hr) */
function MarkdownRenderer({ content }) {
  const html = markdownToHtml(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md) {
  let html = md
    // Escape HTML entities for safety
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Horizontal rules
    .replace(/^---+$/gm, "<hr/>")
    // Headings (### before ## before #)
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-white mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-10 mb-4">$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links - only allow http(s) and mailto
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g,
      '<a href="$2" class="text-orange hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    // Unordered list items
    .replace(/^\* (.+)$/gm, '<li class="text-white/60 ml-4 list-disc">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="space-y-1 mb-4">$1</ul>')
    // Paragraphs — non-empty lines that aren't already HTML
    .replace(/^(?!<[hula]|<hr|<strong|<em)(.+)$/gm, '<p class="text-white/60 leading-relaxed mb-3">$1</p>');

  return html;
}
