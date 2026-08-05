import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, UserPlus, ShieldCheck } from "lucide-react";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "member" });

  async function load() {
    const r = await api.get("/auth/users");
    setUsers(r.data);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/auth/users", form);
      toast.success("User created");
      setForm({ email: "", name: "", password: "", role: "member" });
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.detail || "Failed");
    }
  }

  async function del(id) {
    if (!confirm("Delete this user?")) return;
    try {
      await api.delete(`/auth/users/${id}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  }

  if (user?.role !== "admin") {
    return <div className="p-8"><div className="border border-border bg-white p-6 text-sm">Admin only.</div></div>;
  }

  return (
    <div className="p-8 space-y-6" data-testid="users-page">
      <header>
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Access control</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter">Team</h1>
        <p className="text-sm text-slate-500 mt-2">Invite additional GetSet AI teammates.</p>
      </header>

      <form onSubmit={create} className="border border-border bg-white p-5 grid md:grid-cols-[1fr_1fr_1fr_140px_auto] gap-3 items-end" data-testid="user-form">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Email</label>
          <input required type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm" data-testid="user-email" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Name</label>
          <input required value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm" data-testid="user-name" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Password</label>
          <input required type="text" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm font-mono" data-testid="user-password" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Role</label>
          <select value={form.role} onChange={(e)=>setForm({...form, role: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm bg-white" data-testid="user-role">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="bg-slate-900 text-white font-semibold px-4 py-2.5 rounded-sm text-sm hover:bg-slate-800 transition-colors duration-200 flex items-center gap-2" data-testid="user-create-btn">
          <UserPlus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="border border-border bg-white overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left">Email</th>
              <th className="text-left">Name</th>
              <th className="text-left">Role</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="font-mono text-xs">{u.email}</td>
                <td>{u.name}</td>
                <td>
                  {u.role === "admin"
                    ? <span className="badge-status active flex items-center gap-1 w-fit"><ShieldCheck className="w-3 h-3" /> admin</span>
                    : <span className="badge-status">member</span>}
                </td>
                <td className="text-right">
                  {u.id !== user.id && (
                    <button onClick={() => del(u.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded-sm transition-colors duration-200" data-testid={`user-delete-${u.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
