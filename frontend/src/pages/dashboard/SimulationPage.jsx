import { useDashboardAPI } from "../../hooks/useDashboardAPI";
import Simulation from "./sections/Simulation";

export default function SimulationPage() {
  const { data } = useDashboardAPI("/dashboard");
  const plan = data?.user?.plan || "free";
  const hasAccess = plan !== "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Simulasi Hemat</h1>
        <p className="text-white/50 text-sm mt-1">
          Hitung potensi tabunganmu dengan simulasi sederhana &amp; AI.
        </p>
      </div>
      <Simulation hasAccess={hasAccess} />
    </div>
  );
}
