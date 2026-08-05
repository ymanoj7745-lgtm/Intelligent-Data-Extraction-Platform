import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import RegionTree from "@/components/RegionTree";
import { Play, Loader2, TrendingUp, Database, Ban, CalendarClock } from "lucide-react";

function KpiCard({ label, value, icon: Icon, testId, highlight }) {
  return (
    <div className={`border border-border bg-white p-5 ${highlight ? "border-l-4 border-l-[#FACC15]" : ""}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[0.65rem] uppercase tracking-[0.15em] text-slate-500 font-semibold">{label}</div>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="font-display text-3xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

export default function Extractions() {
  const nav = useNavigate();
  const [regions, setRegions] = useState([]);
  const [region, setRegion] = useState(null);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [starting, setStarting] = useState(false);

  const [filters, setFilters] = useState({
    sic_codes: "",
    company_status: "",
    name_includes: "",
    incorporated_from: "",
    incorporated_to: "",
    website_filter: "all",
  });
  const [limit, setLimit] = useState(200);
  const [jobName, setJobName] = useState("");

  async function loadAll() {
    const [r, s, j] = await Promise.all([
      api.get("/regions"),
      api.get("/stats"),
      api.get("/jobs?limit=10"),
    ]);
    setRegions(r.data);
    setStats(s.data);
    setJobs(j.data);
  }

  useEffect(() => { loadAll(); }, []);

  // Poll active jobs
  const activeJobs = useMemo(() => jobs.filter(j => j.status === "running" || j.status === "queued"), [jobs]);
  useEffect(() => {
    if (activeJobs.length === 0) return;
    const t = setInterval(async () => {
      const j = await api.get("/jobs?limit=10");
      setJobs(j.data);
      const s = await api.get("/stats");
      setStats(s.data);
    }, 2500);
    return () => clearInterval(t);
  }, [activeJobs.length]);

  async function startExtraction() {
    if (!region) { toast.error("Pick a region first"); return; }
    setStarting(true);
    try {
      const payload = {
        region_id: region.id,
        name: jobName || undefined,
        limit: Number(limit) || 200,
        filters: {
          sic_codes: filters.sic_codes ? filters.sic_codes.split(",").map(s => s.trim()).filter(Boolean) : [],
          company_status: filters.company_status ? filters.company_status.split(",").map(s => s.trim()) : [],
          name_includes: filters.name_includes || null,
          incorporated_from: filters.incorporated_from || null,
          incorporated_to: filters.incorporated_to || null,
          website_filter: filters.website_filter,
        },
      };
      const r = await api.post("/jobs", payload);
      toast.success("Extraction started");
      nav(`/jobs/${r.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start job");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="p-8 space-y-8" data-testid="extractions-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 mb-2">Dashboard</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter">Extractions</h1>
          <p className="text-sm text-slate-500 mt-2">Pick a UK region → apply filters → dump companies to Excel.</p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total jobs" value={stats?.total_jobs ?? "—"} icon={Database} testId="stat-total-jobs" />
        <KpiCard label="Companies extracted" value={stats?.total_companies?.toLocaleString?.() ?? "—"} icon={TrendingUp} testId="stat-total-companies" />
        <KpiCard label="No website found" value={stats?.no_website_companies?.toLocaleString?.() ?? "—"} icon={Ban} testId="stat-no-website" highlight />
        <KpiCard label="Active schedules" value={stats?.active_schedules ?? "—"} icon={CalendarClock} testId="stat-schedules" />
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Region tree */}
        <div className="space-y-4">
          <RegionTree
            regions={regions}
            activeId={region?.id}
            onPick={(n) => setRegion(n)}
          />
          {region && (
            <div className="border border-border bg-white p-4 text-sm" data-testid="selected-region">
              <div className="text-[0.65rem] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-1">Selected</div>
              <div className="font-medium">{region.name}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">location = "{region.location}"</div>
            </div>
          )}
        </div>

        {/* Filters + start */}
        <div className="border border-border bg-white p-6 space-y-5" data-testid="filters-panel">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Filters</h2>
            <p className="text-xs text-slate-500 mt-1">Fine-tune the Companies House search before running.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Job name (optional)</label>
              <input
                data-testid="filter-job-name"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Manchester tech Q1"
                className="w-full border border-border px-3 py-2 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Company name contains</label>
              <input
                data-testid="filter-name-includes"
                value={filters.name_includes}
                onChange={(e) => setFilters({...filters, name_includes: e.target.value})}
                placeholder="e.g. digital"
                className="w-full border border-border px-3 py-2 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">SIC codes (comma-sep)</label>
              <input
                data-testid="filter-sic"
                value={filters.sic_codes}
                onChange={(e) => setFilters({...filters, sic_codes: e.target.value})}
                placeholder="62012, 63120"
                className="w-full border border-border px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Company status</label>
              <select
                data-testid="filter-status"
                value={filters.company_status}
                onChange={(e) => setFilters({...filters, company_status: e.target.value})}
                className="w-full border border-border px-3 py-2 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="dissolved">Dissolved</option>
                <option value="liquidation">Liquidation</option>
                <option value="administration">Administration</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Incorporated from</label>
              <input
                data-testid="filter-inc-from"
                type="date"
                value={filters.incorporated_from}
                onChange={(e) => setFilters({...filters, incorporated_from: e.target.value})}
                className="w-full border border-border px-3 py-2 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Incorporated to</label>
              <input
                data-testid="filter-inc-to"
                type="date"
                value={filters.incorporated_to}
                onChange={(e) => setFilters({...filters, incorporated_to: e.target.value})}
                className="w-full border border-border px-3 py-2 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Website filter — highlighted */}
          <div className="border border-border bg-slate-50 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Website discovery</label>
            <div className="flex flex-wrap gap-2">
              {[
                { v: "all", label: "All companies" },
                { v: "no_website", label: "No website only", highlight: true },
                { v: "has_website", label: "Has website only" },
              ].map((o) => (
                <button
                  key={o.v}
                  data-testid={`website-filter-${o.v}`}
                  onClick={() => setFilters({...filters, website_filter: o.v})}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider font-semibold rounded-sm border transition-colors duration-200 ${
                    filters.website_filter === o.v
                      ? (o.highlight ? "bg-[#FACC15] text-black border-black" : "bg-slate-900 text-white border-slate-900")
                      : "bg-white border-border text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-32">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Max results</label>
              <input
                data-testid="filter-limit"
                type="number"
                min={10}
                max={5000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full border border-border px-3 py-2 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>
            <button
              data-testid="start-extraction-btn"
              onClick={startExtraction}
              disabled={!region || starting}
              className="ml-auto bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start extraction
            </button>
          </div>
        </div>
      </div>

      {/* Active + recent jobs */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Recent jobs</h2>
          <button onClick={() => nav("/history")} className="text-xs uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-900 transition-colors duration-200">View all →</button>
        </div>
        <div className="grid gap-3">
          {jobs.length === 0 && (
            <div className="border border-dashed border-border p-8 text-center text-sm text-slate-500 bg-white">No jobs yet — pick a region and start your first extraction.</div>
          )}
          {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={() => nav(`/jobs/${j.id}`)} />)}
        </div>
      </section>
    </div>
  );
}

function JobRow({ job, onOpen }) {
  const p = job.progress || {};
  const pct = p.total_estimate
    ? Math.min(100, Math.round((p.fetched / Math.max(p.total_estimate, job.limit || 1)) * 100))
    : (job.status === "completed" ? 100 : 0);
  return (
    <div
      className="border border-border bg-white p-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer grid grid-cols-[1fr_auto] gap-4"
      onClick={onOpen}
      data-testid={`job-row-${job.id}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-medium truncate">{job.name}</span>
          <StatusPill status={job.status} />
        </div>
        <div className="text-xs text-slate-500 font-mono truncate">{job.region_name} · limit {job.limit} · id {job.id.slice(0,8)}</div>
        {job.status === "running" && (
          <div className="mt-2 h-1 w-full bg-slate-100 rounded-sm overflow-hidden">
            <div className="h-full bg-slate-900 transition-all duration-500" style={{width: `${pct}%`}} />
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-xl font-display font-bold tabular-nums">{p.fetched ?? 0}</div>
        <div className="text-[0.65rem] uppercase tracking-wider text-slate-500">fetched</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    queued: "bg-slate-100 text-slate-700",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`badge-status ${map[status] || ""}`}>{status}</span>
  );
}
