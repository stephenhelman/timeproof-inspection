"use client";

import { useState } from "react";

const OUTCOMES = [
  { value: "SOLD", label: "Sold", color: "text-green-400", description: "Homeowner agreed — deal closed" },
  { value: "PENDING_SOLD_CONFIRMATION", label: "Pending Confirmation", color: "text-cyan-400", description: "Verbal yes — waiting on HOA / decision maker" },
  { value: "DEMO_NOT_SOLD", label: "Demo — Not Sold", color: "text-yellow-400", description: "Full demo delivered, homeowner undecided" },
  { value: "QUOTED", label: "Quoted", color: "text-blue-400", description: "Estimate given, homeowner thinking it over" },
  { value: "DENIED", label: "Denied", color: "text-orange-400", description: "Insurance claim denied" },
  { value: "NO_SHOW", label: "No Show", color: "text-orange-400", description: "Homeowner not home at appointment time" },
  { value: "REVIVAL_PENDING", label: "Revival", color: "text-amber-400", description: "Not ready now — send to follow-up bot" },
  { value: "DEAD", label: "Dead", color: "text-zinc-400", description: "Not interested, moved, or unqualified" },
] as const;

type Outcome = (typeof OUTCOMES)[number]["value"];

interface Props {
  leadId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function DispoModal({ leadId, onClose, onComplete }: Props) {
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [decisionMakerPresent, setDecisionMakerPresent] = useState<boolean | null>(null);
  const [primaryObjection, setPrimaryObjection] = useState("");
  const [notes, setNotes] = useState("");
  const [lenderAttempted, setLenderAttempted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) { setError("Select an outcome."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/lead/${leadId}/dispo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          dispoDecisionMakerPresent: decisionMakerPresent,
          dispoPrimaryObjection: primaryObjection || null,
          dispoNotes: notes || null,
          lenderAttempted,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-text-primary text-lg font-semibold">Demo Disposition</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Outcome selector */}
          <div className="space-y-2">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Outcome *</label>
            <div className="grid grid-cols-1 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    outcome === o.value
                      ? "border-brand-blue bg-brand-blue/10"
                      : "border-border bg-bg-elevated hover:border-border-hover"
                  }`}
                >
                  <div>
                    <span className={`font-semibold text-sm ${o.color}`}>{o.label}</span>
                    <p className="text-text-hint text-xs mt-0.5">{o.description}</p>
                  </div>
                  {outcome === o.value && (
                    <span className="text-brand-blue text-sm shrink-0 ml-3">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Decision maker present */}
          <div className="space-y-2">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Decision Maker Present?</label>
            <div className="flex gap-3">
              {[{ val: true, label: "Yes" }, { val: false, label: "No" }].map(({ val, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDecisionMakerPresent(val)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    decisionMakerPresent === val
                      ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                      : "border-border text-text-secondary hover:border-border-hover"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lender attempted */}
          {(outcome === "DENIED" || outcome === "DEMO_NOT_SOLD" || outcome === "REVIVAL_PENDING") && (
            <div className="space-y-2">
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Lender Attempted?</label>
              <div className="flex gap-3">
                {[{ val: true, label: "Yes" }, { val: false, label: "No" }].map(({ val, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setLenderAttempted(val)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      lenderAttempted === val
                        ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                        : "border-border text-text-secondary hover:border-border-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary objection */}
          <div className="space-y-2">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Primary Objection</label>
            <select
              value={primaryObjection}
              onChange={(e) => setPrimaryObjection(e.target.value)}
              className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl min-h-[48px] px-4 text-sm focus:outline-none focus:border-brand-blue transition-colors"
            >
              <option value="">— none / not applicable —</option>
              <option value="price">Price too high</option>
              <option value="insurance">Insurance won&apos;t cover</option>
              <option value="need_to_think">Need to think about it</option>
              <option value="spouse">Need to talk to spouse</option>
              <option value="not_interested">Not interested in roof work</option>
              <option value="timing">Bad timing / not ready</option>
              <option value="competitor">Going with another company</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context for the team…"
              className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl px-4 py-3 text-sm placeholder:text-text-hint focus:outline-none focus:border-brand-blue transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!outcome || saving}
            className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all min-h-[52px]"
          >
            {saving ? "Saving…" : "Save Disposition"}
          </button>
        </form>
      </div>
    </div>
  );
}
