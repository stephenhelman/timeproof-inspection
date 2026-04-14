"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CallScriptModal from "@/src/components/revival/CallScriptModal";

function fmtCurrency(val) {
  if (val === null || val === undefined) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtDate(val) {
  if (!val) return null;
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const OUTCOME_BUTTONS = [
  {
    label: "Recovered",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30",
    updates: (now) => ({
      status: "REVIVAL_RECOVERED",
      revivalOutcome: "RECOVERED",
      revivalCalledAt: now,
    }),
    isRecovered: true,
  },
  {
    label: "Review Asked",
    className: "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30",
    updates: (now) => ({
      revivalOutcome: "REVIEW_REQUESTED",
      revivalCalledAt: now,
    }),
  },
  {
    label: "No Answer",
    className: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/30",
    updates: (now) => ({
      revivalStatus: "NO_ANSWER",
      revivalCalledAt: now,
    }),
  },
  {
    label: "Not Interested",
    className: "bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30",
    updates: (now) => ({
      revivalStatus: "NOT_INTERESTED",
      revivalCalledAt: now,
    }),
  },
  {
    label: "Dead",
    className: "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30",
    updates: (now) => ({
      status: "DEAD",
      revivalOutcome: "DEAD",
      revivalCalledAt: now,
    }),
    isDead: true,
  },
];

function LeadCard({ lead, onUpdate }) {
  const router = useRouter();
  const [saving, setSaving] = useState(null);
  const [dying, setDying] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  const [recoveredId, setRecoveredId] = useState(null);

  const handleOutcome = async (btn) => {
    setSaving(btn.label);
    const now = new Date().toISOString();
    const updates = btn.updates(now);

    try {
      const res = await fetch(`/api/lead/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();

      if (btn.isDead) {
        setDying(true);
        setTimeout(() => onUpdate(lead.id), 500);
      } else if (btn.isRecovered) {
        setRecoveredId(lead.id);
        setShowReportPrompt(true);
        onUpdate(lead.id);
      } else {
        onUpdate(lead.id);
      }
    } catch {
      // silent — card stays
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <CallScriptModal
        isOpen={scriptOpen}
        onClose={() => setScriptOpen(false)}
        customerName={lead.customerName}
        leadId={lead.id}
      />

      {showReportPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReportPrompt(false)} />
          <div className="relative bg-bg-elevated border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-text-primary font-semibold text-lg mb-2">Lead Recovered!</h3>
            <p className="text-text-secondary text-sm mb-6">
              Would you like to generate an inspection report for{" "}
              <span className="text-text-primary">{lead.customerName}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/inspection/new?leadId=${recoveredId || lead.id}`)}
                className="flex-1 bg-brand-blue hover:opacity-90 text-white font-medium rounded-xl py-3 transition-opacity"
              >
                Generate Report
              </button>
              <button
                onClick={() => setShowReportPrompt(false)}
                className="flex-1 bg-bg-input text-text-primary font-medium rounded-xl py-3 transition-colors hover:opacity-80"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`bg-bg-surface border border-border rounded-2xl p-5 space-y-4 transition-all duration-500 ${
          dying ? "opacity-0 scale-95 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <a
              href={`/leads/${lead.id}`}
              className="text-text-primary font-bold text-lg hover:text-blue-300 transition-colors"
            >
              {lead.customerName}
            </a>
            <p className="text-text-secondary text-sm mt-0.5">{lead.address}</p>
          </div>
          {lead.highestEstimateValue && (
            <span className="text-emerald-400 font-semibold text-sm whitespace-nowrap shrink-0">
              {fmtCurrency(lead.highestEstimateValue)}
            </span>
          )}
        </div>

        {/* Contact + Date */}
        <div className="flex flex-wrap gap-4 text-sm">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              {lead.phone}
            </a>
          )}
          {lead.appointmentDate && (
            <span className="text-text-secondary">
              Appt: {fmtDate(lead.appointmentDate)}
            </span>
          )}
          {lead.assignedTech && (
            <span className="text-text-secondary">Tech: {lead.assignedTech}</span>
          )}
        </div>

        {/* Call script button */}
        <button
          onClick={() => setScriptOpen(true)}
          className="text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 text-sm font-medium rounded-xl px-4 py-2 transition-colors min-h-[44px] w-full"
        >
          Open Script
        </button>

        {/* Outcome buttons */}
        <div className="flex flex-wrap gap-2">
          {OUTCOME_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              onClick={() => handleOutcome(btn)}
              disabled={saving !== null}
              className={`flex-1 min-w-[80px] border rounded-xl px-2 py-2 text-xs font-medium transition-colors min-h-[44px] disabled:opacity-50 ${btn.className}`}
            >
              {saving === btn.label ? "…" : btn.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function RevivalPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lead?status=REVIVAL_PENDING");
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleCardUpdate = useCallback((leadId) => {
    // Remove card from the queue after a Dead/Recovered action
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

  return (
    <div className="min-h-screen bg-bg-base px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-3xl font-bold">Revival Queue</h1>
            {!loading && (
              <p className="text-text-secondary text-sm mt-1">
                {leads.length} lead{leads.length !== 1 ? "s" : ""} pending
              </p>
            )}
          </div>
          <a
            href="/leads"
            className="text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            All Leads →
          </a>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="py-16 text-center text-text-secondary">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
            <p className="text-text-primary font-semibold text-lg">Queue is clear</p>
            <p className="text-text-secondary text-sm">
              No leads pending revival right now.
            </p>
            <a
              href="/leads"
              className="inline-block mt-2 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2 transition-colors"
            >
              View all leads
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onUpdate={handleCardUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
