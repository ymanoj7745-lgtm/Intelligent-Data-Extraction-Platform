import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Trash2, Download, Eye } from "lucide-react";

export default function History() {
  const nav = useNavigate();
  const [jobs, setJobs] = useState([]);

  async function load() {
    const r = await api.get("/jobs?limit=200");
    setJobs(r.data);
  }
  useEffect(() => { load(); }, []);

  async function del(id) {
    if (!confirm("Delete this job?")) return;
    await api.delete(`/jobs/${id}`);
    toast.success("Job deleted");
    load();
  }

  return (
    <div className="p-8 space-y-6" data-testid="history-page">
      <header>
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Archive</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter">Job history</h1>
        <p className="text-sm text-slate-500 mt-2">Re-download past extractions or clean up old jobs.</p>
      </header>

      <div className="border border-border bg-white overflow-x-auto">
        <table className="data-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Region</th>
              <th className="text-left">Status</th>
              <th className="text-left">Fetched</th>
              <th className="text-left">No-website</th>
              <th className="text-left">Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-10">No history yet.</td></tr>}
            {jobs.map((j) => (
              <tr key={j.id} data-testid={`history-row-${j.id}`}>
                <td className="font-medium">{j.name}</td>
                <td className="text-xs text-slate-600">{j.region_name}</td>
                <td><span className="badge-status">{j.status}</span></td>
                <td className="font-mono tabular-nums">{j.progress?.fetched ?? 0}</td>
                <td>
                  {j.no_website_count > 0
                    ? <span className="badge-no-website">{j.no_website_count}</span>
                    : <span className="text-slate-400">0</span>}
                </td>
                <td className="font-mono text-xs">{j.created_at?.slice(0,16).replace("T", " ")}</td>
                <td className="text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => nav(`/jobs/${j.id}`)} className="p-1.5 hover:bg-slate-100 rounded-sm transition-colors duration-200" title="View" data-testid={`history-view-${j.id}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {j.status === "completed" && (
                      <a
                        href={`${process.env.REACT_APP_BACKEND_URL}/api/jobs/${j.id}/export`}
                        onClick={async (e) => {
                          e.preventDefault();
                          const token = localStorage.getItem("ch_token");
                          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/jobs/${j.id}/export`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const blob = await resp.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `companies_${j.region_id}_${j.id.slice(0,8)}.xlsx`;
                          a.click();
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-sm transition-colors duration-200 inline-block"
                        title="Download Excel"
                        data-testid={`history-download-${j.id}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => del(j.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded-sm transition-colors duration-200" title="Delete" data-testid={`history-delete-${j.id}`}>
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
