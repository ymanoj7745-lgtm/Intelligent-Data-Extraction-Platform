import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Extractions", end: true },
  { to: "/history", label: "History" },
  { to: "/schedules", label: "Schedules" },
  { to: "/users", label: "Users", adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col" data-testid="sidebar">
      <div className="px-4 py-4 border-b border-slate-200">
        <span className="font-semibold text-slate-800">Data Extractor</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {links
          .filter((l) => !l.adminOnly || user?.role === "admin")
          .map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200">
        <div className="text-xs text-slate-500 mb-2 truncate">
          {user?.email || user?.name || "Signed in"}
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}