import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, API } from "@/lib/api";
import { ArrowLeft, Download, Loader2, ArrowUpDown, Search } from "lucide-react";

export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sort, setSort] = useState("company_name");
  const [order, setOrder] = useState("asc");
  const [websiteFilter, setWebsiteFilter] = useState("all");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadRows = useCallback(async () => {
    const r = await api.get(`/jobs/${id}/companies`, {
      params: { page, page_size: pageSize, sort, order, website_filter: websiteFilter, q: q || undefined },
    });
    setRows(r.data.items);
    setTotal(r.data.total);
  }, [id, page, pageSize, sort, order, websiteFilter, q]);

  useEffect(() => {
    async function load() {
      const j = await api.get(`/jobs/${id}`);
      setJob(j.data);
    }
    load();
  }, [id]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // Poll while running
  useEffect(() => {
    if (!job || (job.status !== "running" && job.status !== "queued")) return;
    const t = setInterval(async () => {
      const j = await api.get(`/jobs/${id}`);
      setJob(j.data);
      if (j.data.status === "completed") loadRows();
    }, 2500);
    return () => clearInterval(t);
  }, [job, id, loadRows]);

  async function exportXlsx() {
    if (!job || job.status !== "completed") { toast.error("Job not completed yet"); return; }
    setExporting(true);
    try {
      const token = localStorage.getItem("ch_token");
      const resp = await fetch(`${API}/jobs/${id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `companies_${job.region_id}_${job.id.slice(0,8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  }

  function toggleSort(col) {
    if (sort === col) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(col); setOrder("asc"); }
  }

  if (!job) return <div className="p-8 text-sm text-slate-500">Loading…</div>;

  const p = job.progress || {};
  const pct = p.total_estimate
    ? Math.min(100, Math.round((p.fetched / Math.max(p.total_estimate, job.limit || 1)) * 100))
    : (job.status === "completed" ? 100 : 0);

  const columns = [
    { key: "company_name", label: "Company" },
    { key: "company_number", label: "Number" },
    { key: "company_status", label: "Status" },
    { key: "date_of_creation", label: "Incorporated" },
    { key: "has_website", label: "Website" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
  ];

  return (
    <div className="p-8 space-y-6" data-testid="job-detail-page">
      <button onClick={() => nav("/")} className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors duration-200" data-testid="back-btn">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to extractions
      </button>

      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Job {job.id.slice(0,8)}</div>
          <h1 className="font-display text-3xl font-bold tracking-tighter" data-testid="job-name">{job.name}</h1>
          <div className="text-sm text-slate-500 mt-1 font-mono">{job.region_name}</div>
        </div>
        <button
          data-testid="export-excel-btn"
          onClick={exportXlsx}
          disabled={job.status !== "completed" || exporting}
          className="bg-[#FACC15] text-black font-semibold px-5 py-2.5 rounded-sm text-sm border border-black hover:bg-yellow-300 transition-colors duration-200 disabled:opacity-40 flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export Excel
        </button>
      </header>

      {/* Progress card */}
      <div className="border border-border bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[0.65rem] uppercase tracking-[0.15em] text-slate-500 font-semibold">
            Phase: {p.phase || job.status}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            fetched {p.fetched ?? 0} · enriched {p.enriched ?? 0} · no-website {job.no_website_count ?? 0}
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
          <div className="h-full bg-slate-900 transition-all duration-500" style={{width: `${pct}%`}} data-testid="progress-bar" />
        </div>
        {job.error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">{job.error}</div>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="job-search-input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search name / number"
            className="pl-8 pr-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-64"
          />
        </div>
        <div className="flex gap-1">
          {["all", "none", "has"].map((v) => (
            <button
              key={v}
              data-testid={`view-website-${v}`}
              onClick={() => { setWebsiteFilter(v); setPage(1); }}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider font-semibold rounded-sm border transition-colors duration-200 ${
                websiteFilter === v
                  ? (v === "none" ? "bg-[#FACC15] text-black border-black" : "bg-slate-900 text-white border-slate-900")
                  : "bg-white border-border text-slate-700 hover:bg-slate-100"
              }`}
            >
              {v === "all" ? "All" : v === "none" ? "No website" : "Has website"}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-slate-500 font-mono" data-testid="rows-count">
          {total.toLocaleString()} rows
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white overflow-x-auto">
        <table className="data-table w-full min-w-[900px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left cursor-pointer select-none" onClick={() => toggleSort(c.key)}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <ArrowUpDown className={`w-3 h-3 ${sort === c.key ? "text-slate-900" : "text-slate-300"}`} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center text-slate-500 py-10">
                {job.status === "completed" ? "No companies match this filter." : "Waiting for results…"}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.company_number} data-testid={`company-row-${r.company_number}`}>
                <td className="font-medium">{r.company_name}</td>
                <td className="font-mono">{r.company_number}</td>
                <td><span className={`badge-status ${r.company_status || ""}`}>{r.company_status}</span></td>
                <td className="font-mono text-xs">{r.date_of_creation || "—"}</td>
                <td>
                  {r.has_website
                    ? <a href={r.website} target="_blank" rel="noreferrer" className="text-slate-900 underline decoration-dotted hover:decoration-solid">{r.website?.replace(/^https?:\/\//, "")}</a>
                    : <span className="badge-no-website" data-testid={`no-website-badge-${r.company_number}`}>No website</span>}
                </td>
                <td className="font-mono text-xs">{r.phone || "—"}</td>
                <td className="font-mono text-xs truncate max-w-[220px]">{r.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            Page {page} of {Math.ceil(total / pageSize)}
          </div>
          <div className="flex gap-2">
            <button
              data-testid="page-prev"
              disabled={page === 1}
              onClick={() => setPage(p2 => Math.max(1, p2 - 1))}
              className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-slate-100 disabled:opacity-40 transition-colors duration-200"
            >← Prev</button>
            <button
              data-testid="page-next"
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(p2 => p2 + 1)}
              className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-slate-100 disabled:opacity-40 transition-colors duration-200"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
