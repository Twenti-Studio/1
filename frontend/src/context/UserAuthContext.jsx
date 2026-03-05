import { createContext, useCallback, useContext, useEffect, useState } from "react";

const UserAuthContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
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
    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { success: false, error: "Server error, coba lagi nanti" };
      }
      if (data.success) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Login gagal" };
    } catch {
      return { success: false, error: "Tidak bisa terhubung ke server" };
    }
  }

  async function logout() {
    await fetch("/api/user/logout");
    setUser(null);
  }

  return (
    <UserAuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within UserAuthProvider");
  return ctx;
}
