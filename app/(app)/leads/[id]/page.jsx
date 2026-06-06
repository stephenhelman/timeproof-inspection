"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
// PRESERVED — not active in Qntum build (revival)
// import CallScriptModal from "@/src/components/revival/CallScriptModal";
import { MessageSquare, Send, Lock } from "lucide-react";
import { usePermissions } from "@/src/lib/use-permissions";
import DispoModal from "@/src/components/inspection/DispoModal";
import RescheduleWizard from "@/src/components/inspection/RescheduleWizard";

const LEAD_STATUS_OPTIONS = [
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

const REVIVAL_STATUS_OPTIONS = ["PENDING", "ATTEMPTED", "CONNECTED", "NOT_INTERESTED", "NO_ANSWER"];
const REVIVAL_OUTCOME_OPTIONS = ["RECOVERED", "REVIEW_REQUESTED", "REFERRAL_GIVEN", "DEAD"];

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

const INSPECTION_STATUS_BADGE = {
  draft: "bg-zinc-500/20 text-zinc-400",
  complete: "bg-green-500/20 text-green-300",
};

const APPT_STATUS_BADGE = {
  SCHEDULED: "bg-zinc-500/20 text-zinc-400",
  EN_ROUTE: "bg-blue-500/20 text-blue-300",
  IN_PROGRESS: "bg-orange-500/20 text-orange-300",
  COMPLETED: "bg-green-500/20 text-green-300",
  CANCELLED: "bg-red-500/20 text-red-400",
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
  const perms = usePermissions();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  // PRESERVED — not active in Qntum build (revival)
  // const [scriptOpen, setScriptOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState(false);

  // Revival fields state
  const [revivalStatus, setRevivalStatus] = useState("");
  const [revivalOutcome, setRevivalOutcome] = useState("");
  const [revivalNotes, setRevivalNotes] = useState("");

  // Dispo / reschedule
  const [dispoOpen, setDispoOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

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
    const res = await fetch(`/api/lead/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/leads");
    } else {
      showToast("Delete failed.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <p className="text-[#8fa3c8]">Loading…</p>
      </div>
    );
  }

  if (!lead) return null;

  // A user can view but not edit if they're a SETTER or SETTER_MANAGER seeing a non-assigned lead
  const canEdit = perms.isAtLeastManager || lead.assignedUserId === perms.userId;
  const showRevival = lead.status === "REVIVAL_PENDING" || lead.status === "REVIVAL_RECOVERED";

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-8">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2236] border border-[#2a3a5c] text-[#f0f4ff] px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      {/* PRESERVED — not active in Qntum build (revival)
      <CallScriptModal
        isOpen={scriptOpen}
        onClose={() => setScriptOpen(false)}
        customerName={lead.customerName}
        leadId={id}
      />
      */}

      {dispoOpen && (
        <DispoModal
          leadId={id}
          onClose={() => setDispoOpen(false)}
          onComplete={() => { setDispoOpen(false); fetchLead(); showToast("Disposition saved."); }}
        />
      )}

      {rescheduleOpen && (
        <RescheduleWizard
          leadId={id}
          onClose={() => setRescheduleOpen(false)}
          onComplete={() => { setRescheduleOpen(false); fetchLead(); showToast("Inspection rescheduled."); }}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Read-only banner */}
        {!canEdit && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
            <Lock size={14} />
            <span>You have view-only access to this lead.</span>
          </div>
        )}

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
                  <p className="text-[#8fa3c8] text-sm mt-1">
                    {lead.streetAddress}
                    {lead.city ? `, ${lead.city}` : ""}
                    {lead.state ? `, ${lead.state}` : ""}
                    {lead.zip ? ` ${lead.zip}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {saving && <span className="text-[#8fa3c8] text-xs self-center">Saving…</span>}
                  {perms.canDeleteLead && (
                    <button
                      onClick={handleDelete}
                      className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
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

              {/* Editable address field */}
              {canEdit && (
                <AddressEditField
                  currentAddress={lead.address || [lead.streetAddress, lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
                  onSave={(addr) => patch({ address: addr })}
                />
              )}

              {/* Status dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8fa3c8] text-sm font-medium">Status</label>
                <select
                  value={lead.status}
                  onChange={handleStatusChange}
                  disabled={!canEdit}
                  className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base focus:outline-none focus:border-blue-500 transition-colors max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {LEAD_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              {/* Dispatch and Arrive moved to inspection wizard sidebar */}
            </div>

            {/* Funnel Info — only shown for Facebook / funnel-sourced leads */}
            {(lead.sourceTier || lead.facebookLeadId) && (
              <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6 space-y-4">
                <h3 className="text-[#f0f4ff] font-semibold">Funnel Info</h3>

                {lead.decisionMakerHome && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                    <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider block mb-1">Decision Maker Home?</span>
                    <span className="text-[#f0f4ff] text-base font-semibold">{lead.decisionMakerHome}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Source">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium w-fit ${lead.source === "facebook" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-500/20 text-zinc-400"}`}>
                      {lead.source === "facebook" ? "Facebook Lead Ad" : lead.source}
                    </span>
                  </InfoRow>
                  {lead.sourceTier && (
                    <InfoRow label="Tier">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium w-fit ${lead.sourceTier === "primary" ? "bg-amber-500/20 text-amber-300" : lead.sourceTier === "secondary" ? "bg-zinc-500/20 text-zinc-400" : "bg-red-500/20 text-red-400"}`}>
                        {lead.sourceTier === "primary" ? "Primary (Tier 1)" : lead.sourceTier === "secondary" ? "Secondary (Tier 2)" : "Out of Area"}
                      </span>
                    </InfoRow>
                  )}
                  {lead.sourceZip && (
                    <InfoRow label="Source ZIP">
                      <span className="text-[#f0f4ff]">{lead.sourceZip}</span>
                    </InfoRow>
                  )}
                  <InfoRow label="Qualify Status">
                    {lead.qualifyCompletedAt ? (
                      <div>
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-500/20 text-green-400 w-fit block mb-1">Qualified</span>
                        <span className="text-[#8fa3c8] text-xs">{fmtDateFull(lead.qualifyCompletedAt)}</span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/20 text-yellow-400 w-fit">Pending</span>
                    )}
                  </InfoRow>
                </div>

                {lead.smsConsentAt && (
                  <div className="border-t border-[#2a3a5c] pt-3 space-y-1">
                    <span className="text-[#8fa3c8] text-xs font-medium uppercase tracking-wider">SMS Consent</span>
                    <p className="text-[#8fa3c8] text-xs">
                      {fmtDateFull(lead.smsConsentAt)}
                      {lead.smsConsentIp ? ` · ${lead.smsConsentIp}` : ""}
                    </p>
                    {lead.smsConsentText && (
                      <p className="text-[#8fa3c8] text-xs italic">{lead.smsConsentText}</p>
                    )}
                  </div>
                )}
              </div>
            )}

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

                {/* PRESERVED — not active in Qntum build (revival call script)
                <button
                  onClick={() => setScriptOpen(true)}
                  className="w-full bg-[#0a0f1e] border border-amber-500/30 hover:border-amber-500 text-amber-300 font-medium rounded-xl py-3 text-sm transition-colors min-h-[48px]"
                >
                  Open Call Script
                </button>
                */}
              </div>
            )}

            {/* Bot context summary */}
            {(lead.botContextSummary || lead.srLead?.srBotStage) && (
              <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[#f0f4ff] font-semibold text-sm">Bot Context</h3>
                  {lead.srLead?.srBotStage && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      lead.srLead.srBotStage === "silent"
                        ? "bg-zinc-500/20 text-zinc-400"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}>
                      {lead.srLead.srBotStage}
                    </span>
                  )}
                </div>
                {lead.botContextSummary ? (
                  <p className="text-[#8fa3c8] text-sm leading-relaxed">{lead.botContextSummary}</p>
                ) : (
                  <p className="text-[#8fa3c8]/50 text-sm italic">No bot conversation summary yet.</p>
                )}
              </div>
            )}

            {/* Notes section */}
            <LeadNotesPanel leadId={id} initialNotes={lead.notes || []} />

            {/* Inspections section */}
            <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[#f0f4ff] font-semibold">Inspections</h3>
                {canEdit && (
                  <a
                    href={`/inspection/new?leadId=${id}`}
                    className="bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors min-h-[44px] flex items-center"
                  >
                    + New Inspection
                  </a>
                )}
              </div>

              {lead.inspections && lead.inspections.length === 0 ? (
                <p className="text-[#8fa3c8] text-sm">No inspections yet.</p>
              ) : (
                <div className="space-y-2">
                  {lead.inspections?.map((insp) => (
                    <a
                      key={insp.id}
                      href={`/inspection/${insp.id}`}
                      className="flex items-start justify-between bg-[#0a0f1e] border border-[#2a3a5c] rounded-xl px-4 py-3 hover:border-[#1B3A7A] transition-colors gap-3"
                    >
                      <div className="min-w-0">
                        {insp.appointment ? (
                          <p className="text-[#f0f4ff] text-sm font-medium">
                            {fmtDateFull(insp.appointment.scheduledAt)}
                          </p>
                        ) : (
                          <p className="text-[#f0f4ff] text-sm font-medium">
                            Created {fmtDate(insp.createdAt)}
                          </p>
                        )}
                        {insp.appointment?.assignedUser && (
                          <p className="text-[#8fa3c8] text-xs mt-0.5">
                            Rep: {insp.appointment.assignedUser.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {insp.appointment && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${APPT_STATUS_BADGE[insp.appointment.status] || "bg-zinc-500/20 text-zinc-400"}`}>
                            {insp.appointment.status.replace(/_/g, " ")}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${INSPECTION_STATUS_BADGE[insp.status] || "bg-zinc-500/20 text-zinc-400"}`}>
                          {insp.status}
                        </span>
                      </div>
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

function AddressEditField({ currentAddress, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentAddress || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <div className="flex-1 min-w-0">
          <span className="text-[#8fa3c8] text-xs font-medium uppercase tracking-wider block mb-0.5">Address</span>
          <span className="text-[#f0f4ff] text-sm">{currentAddress || "—"}</span>
        </div>
        <button
          type="button"
          onClick={() => { setValue(currentAddress || ""); setEditing(true); }}
          className="text-[#8fa3c8] hover:text-[#f0f4ff] text-xs px-2 py-1 rounded hover:bg-[#2a3a5c] transition-colors opacity-0 group-hover:opacity-100"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-[#8fa3c8] text-xs font-medium uppercase tracking-wider block">Address</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="w-full bg-[#1e2a40] border border-blue-500 text-[#f0f4ff] rounded-xl min-h-[44px] px-4 text-sm focus:outline-none transition-colors"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[#8fa3c8] hover:text-[#f0f4ff] text-sm px-3 py-2 transition-colors"
        >
          Cancel
        </button>
      </div>
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
