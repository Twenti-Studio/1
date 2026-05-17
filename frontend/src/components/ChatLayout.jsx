import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";

/**
 * Standalone full-screen layout for the FiNot chat app.
 * No header / no nav — just the chat surface.
 * Auth-protected: redirect to /login when not signed in.
 */
export default function ChatLayout() {
    const { user, loading, checkAuth } = useUserAuth();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    if (loading) {
        return (
            <div className="h-[100dvh] w-full bg-bg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="h-[100dvh] w-full bg-bg text-white overflow-hidden">
            <Outlet />
        </div>
    );
}
