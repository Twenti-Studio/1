import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import DashboardLayout from "./components/DashboardLayout";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVouchers from "./pages/admin/AdminVouchers";
import CashflowPage from "./pages/dashboard/CashflowPage";
import InsightPage from "./pages/dashboard/InsightPage";
import ReportPage from "./pages/dashboard/ReportPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import SimulationPage from "./pages/dashboard/SimulationPage";
import SubscriptionPage from "./pages/dashboard/SubscriptionPage";
import TransactionPage from "./pages/dashboard/TransactionPage";
import UserDashboard from "./pages/dashboard/UserDashboard";
import UserLogin from "./pages/dashboard/UserLogin";
import Faq from "./pages/Faq";
import Features from "./pages/Features";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";

export default function App() {
  return (
    <Routes>
      {/* Public landing pages */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="features" element={<Features />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="faq" element={<Faq />} />
      </Route>

      {/* User Login */}
      <Route path="login" element={<UserLogin />} />

      {/* User Dashboard (Protected by DashboardLayout) */}
      <Route path="dashboard" element={<DashboardLayout />}>
        <Route index element={<UserDashboard />} />
        <Route path="cashflow" element={<CashflowPage />} />
        <Route path="simulasi" element={<SimulationPage />} />
        <Route path="langganan" element={<SubscriptionPage />} />
        <Route path="transaksi" element={<TransactionPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="insight" element={<InsightPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Admin */}
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="vouchers" element={<AdminVouchers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>
    </Routes>
  );
}
