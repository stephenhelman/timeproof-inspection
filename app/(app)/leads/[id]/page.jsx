"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import CallScriptModal from "@/src/components/revival/CallScriptModal";
import { MessageSquare, Send, ChevronDown } from "lucide-react";

const LEAD_STATUS_OPTIONS = [
  "NEW",
  "INSPECTION_SCHEDULED",
  "INSPECTION_COMPLETE",
  "QUOTED",
  "SOLD",
  "DENIED",
  "NO_SHOW",
  "DEMO_NOT_SOLD",
  "REVIVAL_PENDING",
  "REVIVAL_RECOVERED",
  "DEAD",
];

const REVIVAL_STATUS_OPTIONS = ["PENDING", "ATTEMPTED", "CONNECTED", "NOT_INTERESTED", "NO_ANSWER"];
const REVIVAL_OUTCOME_OPTIONS = ["RECOVERED", "REVIEW_REQUESTED", "REFERRAL_GIVEN", "DEAD"];

const STATUS_BADGE = {
  NEW: "bg-blue-500/20 text-blue-300",
  INSPECTION_SCHEDULED: "bg-purple-500/20 text-purple-300",
  INSPECTION_COMPLETE: "bg-indigo-500/20 text-indigo-300",
  QUOTED: "bg-cyan-500/20 text-cyan-300",
  SOLD: "bg-green-500/20 text-green-300",
  DENIED: "bg-red-500/20 text-red-300",
  NO_SHOW: "bg-orange-500/20 text-orange-300",
  DEMO_NOT_SOLD: "bg-yellow-500/20 text-yellow-300",
  REVIVAL_PENDING: "bg-amber-500/20 text-amber-300",
  REVIVAL_RECOVERED: "bg-emerald-500/20 text-emerald-300",
  DEAD: "bg-zinc-500/20 text-zinc-400",
};

const INSPECTION_STATUS_BADGE = {
  draft: "bg-zinc-500/20 text-zinc-400",
  complete: "bg-green-500/20 text-green-300",
};

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(val) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function fmtDateFull(val) {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState(false);

  // Revival fields state
  const [revivalStatus, setRevivalStatus] = useState("");
  const [revivalOutcome, setRevivalOutcome] = useState("");
  const [revivalNotes, setRevivalNotes] = useState("");

  const fetchLead = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/lead/${id}`);
    if (!res.ok) { router.push("/leads"); return; }
    const data = await res.json();
    setLead(data);
    setRevivalStatus(data.revivalStatus || "");
    setRevivalOutcome(data.revivalOutcome || "");
    setRevivalNotes(data.revivalNotes || "");
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const patch = useCallback(async (updates) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lead/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLead(updated);
      return updated;
    } catch {
      showToast("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [id]);

  const handleStatusChange = (e) => patch({ status: e.target.value });

  const handleMarkCalled = async () => {
    const updates = {
      revivalCalledAt: new Date().toISOString(),
      revivalStatus: revivalStatus || undefined,
      revivalOutcome: revivalOutcome || undefined,
      revivalNotes: revivalNotes || undefined,
    };
    await patch(updates);
    showToast("Call logged.");
  };

  const handleSaveRevival = async () => {
    await patch({ revivalStatus: revivalStatus || null, revivalOutcome: revivalOutcome || null, revivalNotes: revivalNotes || null });
    showToast("Saved.");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    await fetch(`/api/lead/${id}`, { method: "DELETE" });
    router.push("/leads");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <p className="text-[#8fa3c8]">Loading…</p>
      </div>
    );
  }

  if (!lead) return null;

  const showRevival = lead.status === "REVIVAL_PENDING" || lead.status === "REVIVAL_RECOVERED";

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-8">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2236] border border-[#2a3a5c] text-[#f0f4ff] px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      <CallScriptModal
        isOpen={scriptOpen}
        onClose={() => setScriptOpen(false)}
        customerName={lead.customerName}
        leadId={id}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <a href="/leads" className="text-[#8fa3c8] hover:text-[#f0f4ff] text-sm transition-colors">
            ← Leads
          </a>
          <span className="text-[#2a3a5c]">/</span>
          <span className="text-[#f0f4ff] text-sm">{lead.customerName}</span>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            {/* Contact Card */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-[#f0f4ff] text-2xl font-bold">{lead.customerName}</h1>
                  <p className="text-[#8fa3c8] text-sm mt-1">{lead.address}</p>
                </div>
                <div className="flex gap-2">
                  {saving && <span className="text-[#8fa3c8] text-xs self-center">Saving…</span>}
                  <button
                    onClick={handleDelete}
                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lead.phone && (
                  <InfoRow label="Phone">
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-[#f0f4ff] hover:text-blue-300 transition-colors"
                    >
                      {lead.phone}
                    </a>
                  </InfoRow>
                )}
                {lead.email && (
                  <InfoRow label="Email">
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-[#f0f4ff] hover:text-blue-300 transition-colors break-all"
                    >
                      {lead.email}
                    </a>
                  </InfoRow>
                )}
                {lead.assignedTech && (
                  <InfoRow label="Assigned Tech">
                    <span className="text-[#f0f4ff]">{lead.assignedTech}</span>
                  </InfoRow>
                )}
                {lead.createdBy && (
                  <InfoRow label="Created By">
                    <span className="text-[#f0f4ff]">{lead.createdBy}</span>
                  </InfoRow>
                )}
              </div>

              {/* Status dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8fa3c8] text-sm font-medium">Status</label>
                <select
                  value={lead.status}
                  onChange={handleStatusChange}
                  className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base focus:outline-none focus:border-blue-500 transition-colors max-w-xs"
                >
                  {LEAD_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meta info */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6">
              <h3 className="text-[#f0f4ff] font-semibold mb-4">Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Source">
                  <span className="bg-[#1e2a40] text-[#8fa3c8] text-xs px-2 py-1 rounded-md">
                    {lead.source}
                  </span>
                </InfoRow>
                <InfoRow label="Highest Estimate">
                  <span className="text-[#f0f4ff]">{fmtCurrency(lead.highestEstimateValue)}</span>
                </InfoRow>
                <InfoRow label="Appointment Date">
                  <span className="text-[#f0f4ff]">{fmtDate(lead.appointmentDate)}</span>
                </InfoRow>
                <InfoRow label="Job Completion">
                  <span className="text-[#f0f4ff]">{fmtDate(lead.jobCompletionDate)}</span>
                </InfoRow>
                <InfoRow label="Created">
                  <span className="text-[#f0f4ff]">{fmtDate(lead.createdAt)}</span>
                </InfoRow>
                <InfoRow label="Updated">
                  <span className="text-[#f0f4ff]">{fmtDate(lead.updatedAt)}</span>
                </InfoRow>
              </div>
            </div>

            {/* Prior Quote */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6">
              <h3 className="text-[#f0f4ff] font-semibold mb-4">Prior Quote</h3>
              {lead.priorQuoteUrl ? (
                <div className="flex items-center gap-3">
                  <a
                    href={lead.priorQuoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2 transition-colors"
                  >
                    View Prior Quote
                  </a>
                </div>
              ) : (
                <FileUploadButton
                  leadId={id}
                  field="priorQuoteUrl"
                  keyPrefix={`leads/${id}/prior-quote`}
                  label="Upload Prior Quote (PDF)"
                  onUploaded={(url) => patch({ priorQuoteUrl: url }).then(fetchLead)}
                />
              )}
            </div>

            {/* EagleView */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6">
              <h3 className="text-[#f0f4ff] font-semibold mb-4">EagleView Report</h3>
              {lead.eagleViewUrl ? (
                <div className="flex items-center gap-3">
                  <a
                    href={lead.eagleViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2 transition-colors"
                  >
                    View EagleView Report
                  </a>
                </div>
              ) : (
                <FileUploadButton
                  leadId={id}
                  field="eagleViewUrl"
                  keyPrefix={`leads/${id}/eagleview`}
                  label="Upload EagleView (PDF)"
                  onUploaded={(url) => patch({ eagleViewUrl: url }).then(fetchLead)}
                />
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* Revival section */}
            {showRevival && (
              <div className="bg-[#111827] border border-amber-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-amber-300 font-semibold">Revival</h3>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[lead.status]}`}>
                    {lead.status.replace(/_/g, " ")}
                  </span>
                </div>

                {lead.revivalCalledAt && (
                  <div className="bg-[#0a0f1e] rounded-lg px-3 py-2 text-[#8fa3c8] text-sm">
                    Last called: {fmtDateFull(lead.revivalCalledAt)}
                    {lead.revivalCalledBy && ` by ${lead.revivalCalledBy}`}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[#8fa3c8] text-sm font-medium">Revival Status</label>
                  <select
                    value={revivalStatus}
                    onChange={(e) => setRevivalStatus(e.target.value)}
                    className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">— not set —</option>
                    {REVIVAL_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[#8fa3c8] text-sm font-medium">Outcome</label>
                  <select
                    value={revivalOutcome}
                    onChange={(e) => setRevivalOutcome(e.target.value)}
                    className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">— not set —</option>
                    {REVIVAL_OUTCOME_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[#8fa3c8] text-sm font-medium">Notes</label>
                  <textarea
                    value={revivalNotes}
                    onChange={(e) => setRevivalNotes(e.target.value)}
                    rows={3}
                    className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl px-4 py-3 text-sm placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                    placeholder="Call notes, next steps…"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleMarkCalled}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl py-3 text-sm transition-colors min-h-[48px]"
                  >
                    Mark Called
                  </button>
                  <button
                    onClick={handleSaveRevival}
                    className="flex-1 bg-[#2a3a5c] hover:bg-[#2a3a5c]/80 text-[#f0f4ff] font-medium rounded-xl py-3 text-sm transition-colors min-h-[48px]"
                  >
                    Save
                  </button>
                </div>

                <button
                  onClick={() => setScriptOpen(true)}
                  className="w-full bg-[#0a0f1e] border border-amber-500/30 hover:border-amber-500 text-amber-300 font-medium rounded-xl py-3 text-sm transition-colors min-h-[48px]"
                >
                  Open Call Script
                </button>
              </div>
            )}

            {/* Notes section */}
            <LeadNotesPanel leadId={id} initialNotes={lead.notes || []} />

            {/* Reports section */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[#f0f4ff] font-semibold">Reports</h3>
                <a
                  href={`/inspection/new?leadId=${id}`}
                  className="bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors min-h-[44px] flex items-center"
                >
                  + Generate Report
                </a>
              </div>

              {lead.inspections && lead.inspections.length === 0 ? (
                <p className="text-[#8fa3c8] text-sm">No inspection reports yet.</p>
              ) : (
                <div className="space-y-2">
                  {lead.inspections?.map((insp) => (
                    <a
                      key={insp.id}
                      href={`/inspection/${insp.id}`}
                      className="flex items-center justify-between bg-[#0a0f1e] border border-[#2a3a5c] rounded-xl px-4 py-3 hover:border-[#1B3A7A] transition-colors"
                    >
                      <div>
                        <p className="text-[#f0f4ff] text-sm font-medium">
                          {insp.customer?.name || "Inspection"}
                        </p>
                        <p className="text-[#8fa3c8] text-xs mt-0.5">{fmtDate(insp.createdAt)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${INSPECTION_STATUS_BADGE[insp.status] || "bg-zinc-500/20 text-zinc-400"}`}>
                        {insp.status}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lead Notes Panel ──────────────────────────────────────
const PHASE_LABELS = {
  general: "General",
  opener: "Opener",
  phase_1: "Phase 1 — Connect",
  phase_2: "Phase 2 — Understand",
  phase_3: "Phase 3 — Objections",
  phase_4: "Phase 4 — Recovery",
  phase_5: "Phase 5 — Close",
};

function fmtDateFull2(val) {
  if (!val) return "";
  return new Date(val).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function LeadNotesPanel({ leadId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState("general");
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lead/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), phase }),
      });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setContent("");
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const allNotesSorted = [...notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={15} strokeWidth={1.75} className="text-[#8fa3c8]" />
        <h3 className="text-[#f0f4ff] font-semibold">Notes</h3>
        {notes.length > 0 && (
          <span className="text-[#8fa3c8] text-xs">({notes.length})</span>
        )}
      </div>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[#8fa3c8] text-xs font-medium uppercase tracking-wider">Phase / Context</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[40px] px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            {Object.entries(PHASE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl px-4 py-3 pr-12 text-sm placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={!content.trim() || saving}
            className="absolute right-3 bottom-3 w-7 h-7 rounded-lg bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-40 flex items-center justify-center transition-colors"
          >
            <Send size={12} strokeWidth={2} className="text-white" />
          </button>
        </div>
      </form>

      {/* Notes timeline */}
      {allNotesSorted.length > 0 && (
        <div className="space-y-2">
          {allNotesSorted.map((note, i) => (
            <div
              key={note.id}
              className="bg-[#0a0f1e] border border-[#2a3a5c] rounded-xl px-4 py-3 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#8fa3c8] text-xs bg-[#1e2a40] px-2 py-0.5 rounded-md">
                  {PHASE_LABELS[note.phase] ?? note.phase ?? "General"}
                </span>
                <span className="text-[#8fa3c8] text-xs shrink-0">{fmtDateFull2(note.createdAt)}</span>
              </div>
              <p className="text-[#f0f4ff] text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
              {note.authorName && (
                <p className="text-[#8fa3c8] text-xs">— {note.authorName}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-[#8fa3c8] text-sm text-center py-2">No notes yet. Add the first one above.</p>
      )}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[#8fa3c8] text-xs font-medium uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function FileUploadButton({ leadId, field, label, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("leadId", leadId);
      form.append("field", field);
      const res = await fetch("/api/lead/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onUploaded(url);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="cursor-pointer inline-block">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} className="hidden" />
        <span className="bg-[#1e2a40] border border-dashed border-[#2a3a5c] hover:border-[#1B3A7A] text-[#8fa3c8] hover:text-[#f0f4ff] rounded-xl px-4 py-2.5 text-sm transition-colors inline-block">
          {uploading ? "Uploading…" : label}
        </span>
      </label>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
