import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Consistent inline error state for dashboard sections.
 * Shows a friendly message and an optional retry button.
 */
export default function SectionError({ error, onRetry, className = "h-64" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-4 ${className}`}
    >
      <ExclamationTriangleIcon className="w-8 h-8 text-amber-400/70 mb-2" />
      <p className="text-sm text-white/60">
        {typeof error === "string" && error ? error : "Gagal memuat data."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/15 transition-colors"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}
