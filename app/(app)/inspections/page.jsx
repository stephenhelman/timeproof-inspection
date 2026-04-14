"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Eye, Plus, Search } from "lucide-react";

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_OPTS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "complete", label: "Complete" },
];

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/inspection?${params.toString()}`);
    const data = await res.json();
    setInspections(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const displayed = search.trim()
    ? inspections.filter((insp) => {
        const q = search.toLowerCase();
        return (
          insp.customer?.name?.toLowerCase().includes(q) ||
          insp.customer?.address?.toLowerCase().includes(q) ||
          insp.repName?.toLowerCase().includes(q)
        );
      })
    : inspections;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList size={22} strokeWidth={1.75} className="text-text-secondary" />
          <h1 className="text-text-primary text-2xl font-bold">Inspections</h1>
          {!loading && (
            <span className="text-text-secondary text-sm">({inspections.length})</span>
          )}
        </div>
        <a
          href="/inspection/new"
          className="flex items-center gap-1.5 bg-brand-blue hover:bg-accent-blue-hover text-white font-medium rounded-xl px-4 py-2.5 text-sm transition-colors min-h-[44px]"
        >
          <Plus size={15} strokeWidth={2} />
          New Inspection
        </a>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, address, rep…"
            className="w-full bg-bg-input border border-border text-text-primary rounded-xl min-h-[44px] pl-9 pr-4 text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-bg-input border border-border text-text-primary rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-text-secondary text-sm">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <ClipboardList size={36} strokeWidth={1.25} className="mx-auto text-text-secondary/40" />
            <p className="text-text-secondary text-sm">
              {search ? "No inspections match that search." : "No inspections yet."}
            </p>
            {!search && (
              <a
                href="/inspection/new"
                className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create your first inspection →
              </a>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Customer", "Address", "Rep", "Status", "Views", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-text-secondary font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((insp) => (
                  <tr
                    key={insp.id}
                    onClick={() => (window.location.href = `/inspection/${insp.id}`)}
                    className="border-b border-border last:border-0 hover:bg-bg-elevated cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">
                      {insp.customer?.name ?? <span className="text-text-secondary italic">Unnamed</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">
                      {insp.customer?.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {insp.repName ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        insp.status === "complete"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}>
                        {insp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Eye size={12} strokeWidth={1.75} />
                        {insp._count?.reportVisits ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {fmtDate(insp.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
