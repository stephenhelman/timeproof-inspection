"use client";

import { useState, useEffect } from "react";

const RESCHEDULE_REASONS = [
  { value: "homeowner_request", label: "Homeowner requested" },
  { value: "rep_conflict", label: "Rep schedule conflict" },
  { value: "weather", label: "Weather / conditions" },
  { value: "no_show", label: "No show — rebooking" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof RESCHEDULE_REASONS)[number]["value"];

interface Slot {
  date: string;
  time: string;
  label: string;
}

interface Props {
  leadId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function RescheduleWizard({ leadId, onClose, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<Reason | "">("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step === 2) {
      setSlotsLoading(true);
      fetch(`/api/lead/${leadId}/available-slots`)
        .then((r) => r.json())
        .then((d) => setSlots(d.slots ?? []))
        .catch(() => setSlots([]))
        .finally(() => setSlotsLoading(false));
    }
  }, [step, leadId]);

  const handleConfirm = async () => {
    if (!selectedSlot || !reason) return;
    setSaving(true);
    setError("");
    try {
      const [y, m, d] = selectedSlot.date.split("-").map(Number);
      const [hour, minute] = selectedSlot.time.split(":").map(Number);
      const datetime = new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
      const res = await fetch(`/api/lead/${leadId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDatetime: datetime, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reschedule failed");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-text-primary text-lg font-semibold">Reschedule Inspection</h2>
            <p className="text-text-hint text-xs mt-0.5">Step {step} of 2</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <p className="text-text-secondary text-sm">Why is this inspection being rescheduled?</p>
              <div className="space-y-2">
                {RESCHEDULE_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                      reason === r.value
                        ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                        : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                    }`}
                  >
                    {r.label}
                    {reason === r.value && <span className="text-brand-blue">✓</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!reason}
                onClick={() => setStep(2)}
                className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all mt-2"
              >
                Next →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-text-secondary text-sm">Select a new time:</p>
              {slotsLoading && (
                <p className="text-text-hint text-sm text-center py-4">Loading available times…</p>
              )}
              {!slotsLoading && slots.length === 0 && (
                <p className="text-text-hint text-sm text-center py-4">No slots available. Contact office to schedule manually.</p>
              )}
              {!slotsLoading && slots.length > 0 && (
                <div className="space-y-2">
                  {slots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                        selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                          ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                          : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                      }`}
                    >
                      {slot.label}
                      {selectedSlot?.date === slot.date && selectedSlot?.time === slot.time && (
                        <span className="text-brand-blue">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl py-3 text-sm font-medium transition-all"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!selectedSlot || saving}
                  onClick={handleConfirm}
                  className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3 text-sm transition-all"
                >
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
