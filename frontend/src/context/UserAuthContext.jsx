import { createContext, useCallback, useContext, useEffect, useState } from "react";

const UserAuthContext = createContext(null);

async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, data: { success: false, error: "Server error, coba lagi nanti" } };
    }
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { success: false, error: "Tidak bisa terhubung ke server" } };
  }
}

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // Only auto-check session on authenticated routes to avoid 401 noise on landing/pricing
    const path = window.location.pathname;
    const authedRoute = path.startsWith("/dashboard") || path.startsWith("/chat");
    if (!authedRoute) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/user/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      }
    } catch {
      // not authenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  async function login(username, password) {
    const { data } = await postJson("/api/user/login", { username, password });
    if (data.success) {
      setUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || "Login gagal", needs_verification: data.needs_verification };
  }

  // Step 1: create account + send verification email. Does NOT sign in.
  async function register({ username, password, name, email }) {
    const { data } = await postJson("/api/user/register", { username, password, name, email });
    if (data.success) {
      return { success: true, needs_verification: data.needs_verification, email: data.email, email_sent: data.email_sent };
    }
    return { success: false, error: data.error || "Pendaftaran gagal" };
  }

  // Step 2: consume verification magic link → signs in.
  async function verifyEmail(token) {
    const { data } = await postJson("/api/user/verify-email", { token });
    if (data.success) {
      setUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || "Verifikasi gagal" };
  }

  // Step 3: save required profile (data diri).
  async function submitOnboarding(profile) {
    const { data } = await postJson("/api/user/onboarding", profile);
    if (data.success) {
      setUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || "Gagal menyimpan data" };
  }

  async function requestPasswordReset(email) {
    const { data } = await postJson("/api/user/forgot-password", { email });
    if (data.success) return { success: true, message: data.message };
    return { success: false, error: data.error || "Gagal mengirim tautan" };
  }

  // Consume reset magic link + set new password → signs in.
  async function resetPassword(token, newPassword) {
    const { data } = await postJson("/api/user/reset-password", { token, new_password: newPassword });
    if (data.success) {
      setUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || "Gagal atur ulang password" };
  }

  async function logout() {
    await fetch("/api/user/logout");
    setUser(null);
  }

  return (
    <UserAuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyEmail,
        submitOnboarding,
        requestPasswordReset,
        resetPassword,
        logout,
        checkAuth,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within UserAuthProvider");
  return ctx;
}
