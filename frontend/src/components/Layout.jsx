import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

export default function Layout() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen bg-slate-50" data-testid="app-layout">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
