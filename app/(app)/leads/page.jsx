"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { usePermissions } from "@/src/lib/use-permissions";

const STATUS_OPTIONS = [
  "NEW",
  "INSPECTION_SCHEDULED",
  "EN_ROUTE",
  "INSPECTION_IN_PROGRESS",
  "INSPECTION_COMPLETE",
  "QUOTED",
  "PENDING_SOLD_CONFIRMATION",
  "SOLD",
  "DENIED",
  "NO_SHOW",
  "DEMO_NOT_SOLD",
  "REVIVAL_PENDING",
  "REVIVAL_RECOVERED",
  "DEAD",
];

const STATUS_BADGE = {
  NEW: "bg-blue-500/20 text-blue-300",
  INSPECTION_SCHEDULED: "bg-purple-500/20 text-purple-300",
  EN_ROUTE: "bg-violet-500/20 text-violet-300",
  INSPECTION_IN_PROGRESS: "bg-indigo-500/20 text-indigo-300",
  INSPECTION_COMPLETE: "bg-indigo-500/20 text-indigo-300",
  QUOTED: "bg-cyan-500/20 text-cyan-300",
  PENDING_SOLD_CONFIRMATION: "bg-teal-500/20 text-teal-300",
  SOLD: "bg-green-500/20 text-green-300",
  DENIED: "bg-red-500/20 text-red-300",
  NO_SHOW: "bg-orange-500/20 text-orange-300",
  DEMO_NOT_SOLD: "bg-yellow-500/20 text-yellow-300",
  REVIVAL_PENDING: "bg-amber-500/20 text-amber-300",
  REVIVAL_RECOVERED: "bg-emerald-500/20 text-emerald-300",
  DEAD: "bg-zinc-500/20 text-zinc-400",
};

function getUrgencyBadge(lead) {
  if (lead.status !== "INSPECTION_SCHEDULED") return null;
  const apptAt = lead.inspections?.[0]?.appointmentAt;
  if (!apptAt) return null;
  const appt = new Date(apptAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const dayAfterStart = new Date(tomorrowStart.getTime() + 86400000);
  if (appt < todayStart) return { label: "Overdue", cls: "bg-red-500/20 text-red-400 border border-red-500/30" };
  if (appt < tomorrowStart) return { label: "Today", cls: "bg-green-500/20 text-green-400 border border-green-500/30" };
  if (appt < dayAfterStart) return { label: "Tomorrow", cls: "bg-blue-500/20 text-blue-400 border border-blue-500/30" };
  return null;
}

function sortLeadsUrgencyFirst(leads) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  function urgencyWeight(lead) {
    if (lead.status !== "INSPECTION_SCHEDULED") return 3;
    const apptAt = lead.inspections?.[0]?.appointmentAt;
    if (!apptAt) return 3;
    const appt = new Date(apptAt);
    if (appt < todayStart) return 0; // overdue
    if (appt < tomorrowStart) return 1; // today
    return 2; // tomorrow or later
  }
  return [...leads].sort((a, b) => urgencyWeight(a) - urgencyWeight(b));
}

function fmtCurrency(val) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Add Lead Modal ──────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    customerName: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    assignedTech: "",
    highestEstimateValue: "",
    appointmentDate: "",
    status: "NEW",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLead, setCreatedLead] = useState(null);
  const router = useRouter();

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.streetAddress.trim()) {
      setError("Customer name and street address are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          highestEstimateValue: form.highestEstimateValue
            ? parseFloat(form.highestEstimateValue)
            : null,
          appointmentDate: form.appointmentDate || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const lead = await res.json();
      setCreatedLead(lead);
    } catch (err) {
      setError(err.message || "Failed to create lead.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (createdLead) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md bg-[#1a2236] border border-[#2a3a5c] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
          <h3 className="text-[#f0f4ff] text-lg font-semibold mb-2">Lead created!</h3>
          <p className="text-[#8fa3c8] text-sm mb-6">
            Would you like to generate an inspection report for{" "}
            <span className="text-[#f0f4ff]">{createdLead.customerName}</span>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/inspection/new?leadId=${createdLead.id}`)}
              className="flex-1 bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white font-medium rounded-xl py-3 transition-colors"
            >
              Generate Report
            </button>
            <button
              onClick={() => { onCreated(); onClose(); }}
              className="flex-1 bg-[#2a3a5c] hover:bg-[#2a3a5c]/80 text-[#f0f4ff] font-medium rounded-xl py-3 transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#1a2236] border border-[#2a3a5c] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a5c]">
          <h2 className="text-[#f0f4ff] text-lg font-semibold">Add Lead</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8fa3c8] hover:text-[#f0f4ff] hover:bg-[#2a3a5c] transition-colors"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Field label="Customer Name *" value={form.customerName} onChange={(v) => set("customerName", v)} placeholder="Jane Smith" />
          <Field label="Street Address *" value={form.streetAddress} onChange={(v) => set("streetAddress", v)} placeholder="123 Main St" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="El Paso" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} placeholder="TX" />
              <Field label="Zip" value={form.zip} onChange={(v) => set("zip", v)} placeholder="79912" />
            </div>
          </div>
          <Field label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} placeholder="(555) 000-0000" />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="jane@example.com" />
          <Field label="Assigned Tech" value={form.assignedTech} onChange={(v) => set("assignedTech", v)} placeholder="Technician name" />
          <Field label="Highest Estimate Value" type="number" value={form.highestEstimateValue} onChange={(v) => set("highestEstimateValue", v)} placeholder="0" />
          <Field label="Appointment Date" type="date" value={form.appointmentDate} onChange={(v) => set("appointmentDate", v)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8fa3c8] text-sm font-medium">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base focus:outline-none focus:border-blue-500 transition-colors"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-colors min-h-[48px]"
          >
            {saving ? "Saving…" : "Create Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#8fa3c8] text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

// ── Import CSV Modal ─────────────────────────────────────────────────────────
const PREVIEW_FIELD_MAP = {
  "Customer": "Customer Name",
  "Location Address": "Address",
  "Phone": "Phone",
  "Technician": "Assigned Tech",
  "Created On": "Appointment Date",
  "Job Completion Date": "Completion Date",
  "Highest Estimate Value": "Est. Value",
  "Created By": "Created By",
  "Opportunity Status": "Status",
};

function ImportModal({ onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data),
    });
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/lead/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = await res.json();
      onImported(`${data.imported} leads imported. ${data.revivalFlagged} flagged for revival.`);
      onClose();
    } catch {
      setToast("Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const previewCols = Object.keys(PREVIEW_FIELD_MAP);
  const previewRows = rows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl bg-[#1a2236] border border-[#2a3a5c] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a5c]">
          <h2 className="text-[#f0f4ff] text-lg font-semibold">Import CSV</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8fa3c8] hover:text-[#f0f4ff] hover:bg-[#2a3a5c] transition-colors">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {toast && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {toast}
            </div>
          )}

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-[#111827] border border-dashed border-[#2a3a5c] hover:border-[#1B3A7A] text-[#8fa3c8] hover:text-[#f0f4ff] rounded-xl px-6 py-4 w-full text-center transition-colors"
            >
              {fileName ? (
                <span className="text-[#f0f4ff]">{fileName}</span>
              ) : (
                "Click to select a .csv file"
              )}
            </button>
          </div>

          {previewRows.length > 0 && (
            <div>
              <p className="text-[#8fa3c8] text-sm mb-2">
                Preview — first {previewRows.length} of {rows.length} rows
              </p>
              <div className="overflow-x-auto rounded-xl border border-[#2a3a5c]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#111827]">
                      {previewCols.map((col) => (
                        <th key={col} className="text-left px-3 py-2 text-[#8fa3c8] font-medium whitespace-nowrap border-b border-[#2a3a5c]">
                          {PREVIEW_FIELD_MAP[col]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-[#2a3a5c] last:border-0">
                        {previewCols.map((col) => (
                          <td key={col} className="px-3 py-2 text-[#f0f4ff] whitespace-nowrap max-w-[160px] overflow-hidden text-ellipsis">
                            {row[col] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="flex-1 bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-colors min-h-[48px]"
            >
              {importing ? "Importing…" : `Confirm Import (${rows.length} rows)`}
            </button>
            <button
              onClick={onClose}
              className="px-6 bg-[#2a3a5c] hover:bg-[#2a3a5c]/80 text-[#f0f4ff] font-medium rounded-xl transition-colors min-h-[48px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const perms = usePermissions();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Selection state for GHL export
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  // Filter options from meta endpoint
  const [zips, setZips] = useState([]);
  const [techs, setTechs] = useState([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTech, setFilterTech] = useState("");
  const [filterZip, setFilterZip] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Load filter options once
  useEffect(() => {
    fetch("/api/lead/meta")
      .then((r) => r.json())
      .then((d) => {
        setZips(d.zips || []);
        setTechs(d.techs || []);
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterTech) params.set("assignedTech", filterTech);
    if (filterZip) params.set("zip", filterZip);
    if (filterSource) params.set("source", filterSource);
    if (filterFrom) params.set("dateFrom", filterFrom);
    if (filterTo) params.set("dateTo", filterTo);
    const res = await fetch(`/api/lead?${params.toString()}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filterStatus, filterTech, filterZip, filterSource, filterFrom, filterTo]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleOne = (id, e) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportGhl = async () => {
    if (selected.size === 0 || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/lead/export-ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`Export failed — ${data.error || "check your GHL configuration"}`);
      } else if (data.failed > 0 && data.exported === 0) {
        showToast(`Export failed — check console for errors`);
      } else if (data.failed > 0) {
        showToast(`${data.exported} exported, ${data.failed} failed — check console`);
      } else {
        showToast(`${data.exported} lead${data.exported !== 1 ? "s" : ""} exported to GHL successfully`);
      }
      setSelected(new Set());
      fetchLeads();
    } catch {
      showToast("Export failed — check your GHL configuration");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-8">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2236] border border-[#2a3a5c] text-[#f0f4ff] px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onCreated={fetchLeads}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(msg) => { showToast(msg); fetchLeads(); }}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-[#f0f4ff] text-3xl font-bold">Leads</h1>
          <div className="flex gap-3">
            {perms.canImportLeads && (
              <button
                onClick={() => setShowImport(true)}
                className="bg-[#1a2236] border border-[#2a3a5c] hover:border-[#1B3A7A] text-[#f0f4ff] font-medium rounded-xl px-5 py-2.5 text-sm transition-colors min-h-[44px]"
              >
                Import CSV
              </button>
            )}
            {perms.canCreateLead && (
              <button
                onClick={() => setShowAdd(true)}
                className="bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white font-medium rounded-xl px-5 py-2.5 text-sm transition-colors min-h-[44px]"
              >
                + Add Lead
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>

          <select
            value={filterZip}
            onChange={(e) => setFilterZip(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All Zips</option>
            {zips.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <select
            value={filterTech}
            onChange={(e) => setFilterTech(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All Techs</option>
            {techs.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All Sources</option>
            <option value="facebook">Facebook</option>
            <option value="manual">Manual</option>
            <option value="servicetitan_import">ServiceTitan Import</option>
          </select>

          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[44px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-[#8fa3c8]">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-[#8fa3c8]">
              No leads found.{" "}
              <button
                onClick={() => setShowAdd(true)}
                className="text-[#f0f4ff] underline underline-offset-2"
              >
                Add one
              </button>{" "}
              or{" "}
              <button
                onClick={() => setShowImport(true)}
                className="text-[#f0f4ff] underline underline-offset-2"
              >
                import from CSV
              </button>
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a3a5c]">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-[#1B3A7A] cursor-pointer"
                      />
                    </th>
                    {["Customer", "Address", "Zip", "Phone", "Tech", "Status", "Est. Value", "Reports", "Last Activity"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[#8fa3c8] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortLeadsUrgencyFirst(leads).map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => (window.location.href = `/leads/${lead.id}`)}
                      className={`border-b border-[#2a3a5c] last:border-0 hover:bg-[#1a2236] cursor-pointer transition-colors ${selected.has(lead.id) ? "bg-[#1a2236]" : ""}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={(e) => toggleOne(lead.id, e)}
                          className="w-4 h-4 rounded accent-[#1B3A7A] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#f0f4ff] font-medium whitespace-nowrap">{lead.customerName}</span>
                            {lead.ghlContactId && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30 leading-none">
                                GHL
                              </span>
                            )}
                            {lead.revivalStatus === "PENDING" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 leading-none">
                                DRIP
                              </span>
                            )}
                            {(() => { const u = getUrgencyBadge(lead); return u ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${u.cls}`}>
                                {u.label}
                              </span>
                            ) : null; })()}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${lead.source === "facebook" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-500/20 text-zinc-400"}`}>
                              {lead.source === "facebook" ? "Facebook" : lead.source === "servicetitan_import" ? "ST Import" : "Manual"}
                            </span>
                            {lead.sourceTier && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${lead.sourceTier === "primary" ? "bg-amber-500/20 text-amber-300" : lead.sourceTier === "secondary" ? "bg-zinc-500/20 text-zinc-400" : "bg-red-500/20 text-red-400"}`}>
                                {lead.sourceTier === "primary" ? "Tier 1" : lead.sourceTier === "secondary" ? "Tier 2" : "Out of Area"}
                              </span>
                            )}
                            {lead.sourceTier && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${lead.qualifyCompletedAt ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                {lead.qualifyCompletedAt ? "Qualified" : "Pending"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] max-w-[180px] truncate">
                        {[lead.streetAddress, lead.city].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] whitespace-nowrap">
                        {lead.zip || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] whitespace-nowrap">
                        {lead.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] whitespace-nowrap">
                        {lead.assignedTech || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[lead.status] || "bg-zinc-500/20 text-zinc-400"}`}>
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#f0f4ff] whitespace-nowrap">
                        {fmtCurrency(lead.highestEstimateValue)}
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] text-center">
                        {lead._count?.inspections ?? 0}
                      </td>
                      <td className="px-4 py-3 text-[#8fa3c8] whitespace-nowrap">
                        {fmtDate(lead.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Floating action bar — shown when leads are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#1a2236] border border-[#2a3a5c] rounded-2xl px-5 py-3 shadow-2xl">
          <span className="text-[#8fa3c8] text-sm whitespace-nowrap">
            {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleExportGhl}
            disabled={exporting}
            className="bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors min-h-[36px]"
          >
            {exporting ? "Exporting…" : "Export to GHL"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[#8fa3c8] hover:text-[#f0f4ff] text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
