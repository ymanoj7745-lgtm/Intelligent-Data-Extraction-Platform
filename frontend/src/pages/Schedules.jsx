import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Trash2, Play, Plus } from "lucide-react";

export default function Schedules() {
  const [regions, setRegions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ name: "", region_id: "", cadence: "weekly", limit: 500 });
  const [flat, setFlat] = useState([]);

  async function load() {
    const [r, s] = await Promise.all([api.get("/regions"), api.get("/schedules")]);
    setRegions(r.data);
    // flatten regions
    const list = [];
    const walk = (n, path) => {
      const cur = [...path, n.name];
      if (n.location) list.push({ id: n.id, path: cur.join(" › ") });
      (n.children || []).forEach(c => walk(c, cur));
    };
    r.data.forEach(x => walk(x, []));
    setFlat(list);
    setSchedules(s.data);
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.region_id) { toast.error("Pick a region"); return; }
    try {
      await api.post("/schedules", { ...form, limit: Number(form.limit), filters: {} });
      toast.success("Schedule created");
      setForm({ name: "", region_id: "", cadence: "weekly", limit: 500 });
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.detail || "Failed");
    }
  }

  async function del(id) {
    if (!confirm("Delete schedule?")) return;
    await api.delete(`/schedules/${id}`);
    load();
  }

  async function runNow(id) {
    await api.post(`/schedules/${id}/run`);
    toast.success("Run started");
  }

  return (
    <div className="p-8 space-y-6" data-testid="schedules-page">
      <header>
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Automation</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter">Schedules</h1>
        <p className="text-sm text-slate-500 mt-2">Recurring region dumps. Newly-added companies are highlighted per run.</p>
      </header>

      <form onSubmit={create} className="border border-border bg-white p-5 grid md:grid-cols-[1fr_1fr_140px_120px_auto] gap-3 items-end" data-testid="schedule-form">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Name</label>
          <input required value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm" data-testid="schedule-name" placeholder="Weekly Manchester" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Region</label>
          <select required value={form.region_id} onChange={(e)=>setForm({...form, region_id: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm bg-white" data-testid="schedule-region">
            <option value="">Pick…</option>
            {flat.map(f => <option key={f.id} value={f.id}>{f.path}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Cadence</label>
          <select value={form.cadence} onChange={(e)=>setForm({...form, cadence: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm bg-white" data-testid="schedule-cadence">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Limit</label>
          <input type="number" min={10} max={5000} value={form.limit} onChange={(e)=>setForm({...form, limit: e.target.value})} className="w-full border border-border px-3 py-2 rounded-sm text-sm font-mono" data-testid="schedule-limit" />
        </div>
        <button type="submit" className="bg-slate-900 text-white font-semibold px-4 py-2.5 rounded-sm text-sm hover:bg-slate-800 transition-colors duration-200 flex items-center gap-2" data-testid="schedule-create-btn">
          <Plus className="w-4 h-4" /> Create
        </button>
      </form>

      <div className="border border-border bg-white overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Region</th>
              <th className="text-left">Cadence</th>
              <th className="text-left">Limit</th>
              <th className="text-left">Last run</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No schedules yet.</td></tr>}
            {schedules.map(s => (
              <tr key={s.id} data-testid={`schedule-row-${s.id}`}>
                <td className="font-medium">{s.name}</td>
                <td className="text-xs text-slate-600">{s.region_id}</td>
                <td><span className="badge-status">{s.cadence}</span></td>
                <td className="font-mono">{s.limit}</td>
                <td className="font-mono text-xs">{s.last_run_at?.slice(0,16).replace("T"," ") || "—"}</td>
                <td className="text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => runNow(s.id)} className="p-1.5 hover:bg-slate-100 rounded-sm transition-colors duration-200" title="Run now" data-testid={`schedule-run-${s.id}`}>
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(s.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded-sm transition-colors duration-200" data-testid={`schedule-delete-${s.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
