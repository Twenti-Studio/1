import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import ChatLayout from "./components/ChatLayout";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVouchers from "./pages/admin/AdminVouchers";
import ChatPage from "./pages/dashboard/ChatPage";
import Register from "./pages/dashboard/Register";
import ResetPassword from "./pages/dashboard/ResetPassword";
import UserLogin from "./pages/dashboard/UserLogin";
import VerifyEmail from "./pages/dashboard/VerifyEmail";
import Faq from "./pages/Faq";
import Features from "./pages/Features";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import LegalPage from "./pages/LegalPage";
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
        <Route path="legal/:slug" element={<LegalPage />} />
      </Route>

      {/* User Login & Registration */}
      <Route path="login" element={<UserLogin />} />
      <Route path="register" element={<Register />} />
      {/* Magic-link landing routes */}
      <Route path="verify" element={<VerifyEmail />} />
      <Route path="reset-password" element={<ResetPassword />} />

      {/* FiNot Chat App — standalone, full-screen, PWA */}
      <Route path="chat" element={<ChatLayout />}>
        <Route index element={<ChatPage />} />
      </Route>

      {/* Dashboard removed — the chat room is now the single post-login surface.
          Any legacy /dashboard/* link redirects straight to the chat. */}
      <Route path="dashboard/*" element={<Navigate to="/chat" replace />} />

      {/* Admin */}
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="vouchers" element={<AdminVouchers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="legal" element={<AdminLegal />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
