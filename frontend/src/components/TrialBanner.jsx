import { GiftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export default function TrialBanner({ plan, trialDaysLeft }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Show trial countdown
  if (plan === "trial" && trialDaysLeft != null) {
    return (
      <div className="relative bg-linear-to-r from-violet-600/20 to-sky-600/20 border border-violet-500/30 rounded-2xl p-4 sm:p-5">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-white/30 hover:text-white/60"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <GiftIcon className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-violet-300">
              Free Trial Aktif — {trialDaysLeft} hari tersisa
            </h3>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Semua fitur premium terbuka selama masa trial! Termasuk AI Insight,
              Prediksi Saldo, Simulasi AI, Analisis Mingguan &amp; Bulanan.
              {trialDaysLeft <= 2 && (
                <span className="text-amber-400 font-medium">
                  {" "}
                  Trial akan berakhir segera — upgrade ke Pro/Elite agar tetap menikmati semua fitur.
                </span>
              )}
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, (trialDaysLeft / 7) * 100)}%` }}
              />
            </div>
            <p className="text-[0.6rem] text-white/30 mt-1">
              {trialDaysLeft} dari 7 hari tersisa
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show upgrade prompt for free users
  if (plan === "free") {
    return (
      <div className="relative bg-linear-to-r from-orange/10 to-amber-500/10 border border-orange/20 rounded-2xl p-4 sm:p-5">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-white/30 hover:text-white/60"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange/15 flex items-center justify-center shrink-0">
            <GiftIcon className="w-5 h-5 text-orange" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-orange">
              Upgrade untuk Fitur Premium
            </h3>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Dapatkan akses AI Insight, Prediksi Saldo, Simulasi AI, Analisis
              Mingguan &amp; Bulanan, serta fitur premium lainnya.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
