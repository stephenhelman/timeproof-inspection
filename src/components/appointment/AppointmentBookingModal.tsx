"use client";

import { useState, useEffect } from "react";

interface Slot {
  date: string;
  time: string;
  label: string;
}

interface Props {
  leadId: string;
  leadName: string;
  address?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  onClose: () => void;
  onSuccess: (appointmentId: string, inspectionId: string) => void;
}

type Step = "slots" | "confirm" | "success";

export default function AppointmentBookingModal({
  leadId,
  leadName,
  address,
  assignedUserId,
  assignedUserName,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>("slots");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdIds, setCreatedIds] = useState<{ appointmentId: string; inspectionId: string } | null>(null);

  useEffect(() => {
    setSlotsLoading(true);
    fetch(`/api/appointment/available-slots?leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [leadId]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          slotDate: selectedSlot.date,
          slotTime: selectedSlot.time,
          slotLabel: selectedSlot.label,
          assignedUserId: assignedUserId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setCreatedIds({ appointmentId: data.appointmentId, inspectionId: data.inspectionId });
      setStep("success");
      onSuccess(data.appointmentId, data.inspectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-text-primary text-lg font-semibold">Book Inspection</h2>
            <p className="text-text-hint text-xs mt-0.5">
              {step === "slots" && "Select a time"}
              {step === "confirm" && "Confirm appointment"}
              {step === "success" && "Appointment booked"}
            </p>
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

          {/* Step 1 — Slot selection */}
          {step === "slots" && (
            <>
              {slotsLoading && (
                <p className="text-text-hint text-sm text-center py-6">Loading available times…</p>
              )}
              {!slotsLoading && slots.length === 0 && (
                <p className="text-text-hint text-sm text-center py-6">
                  No slots available. Contact office to schedule manually.
                </p>
              )}
              {!slotsLoading && slots.length > 0 && (
                <div className="space-y-2">
                  {slots.map((slot) => {
                    const selected =
                      selectedSlot?.date === slot.date && selectedSlot?.time === slot.time;
                    return (
                      <button
                        key={`${slot.date}-${slot.time}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                          selected
                            ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                            : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                        }`}
                      >
                        {slot.label}
                        {selected && <span className="text-brand-blue">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setStep("confirm")}
                className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all mt-2"
              >
                Next →
              </button>
            </>
          )}

          {/* Step 2 — Confirmation */}
          {step === "confirm" && selectedSlot && (
            <>
              <div className="space-y-3">
                <div className="bg-bg-elevated rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-hint">Homeowner</span>
                    <span className="text-text-primary font-medium">{leadName}</span>
                  </div>
                  {address && (
                    <div className="flex justify-between">
                      <span className="text-text-hint">Address</span>
                      <span className="text-text-primary font-medium text-right max-w-[60%]">{address}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-hint">Time</span>
                    <span className="text-text-primary font-medium">{selectedSlot.label}</span>
                  </div>
                  {assignedUserName && (
                    <div className="flex justify-between">
                      <span className="text-text-hint">Assigned rep</span>
                      <span className="text-text-primary font-medium">{assignedUserName}</span>
                    </div>
                  )}
                </div>
                <p className="text-text-hint text-xs">
                  A confirmation SMS will be sent to the homeowner and the GHL calendar event will be created.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("slots")}
                  className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl py-3 text-sm font-medium transition-all"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirm}
                  className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3 text-sm transition-all"
                >
                  {saving ? "Booking…" : "Confirm"}
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Success */}
          {step === "success" && createdIds && (
            <>
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                  <span className="text-green-400 text-2xl">✓</span>
                </div>
                <p className="text-text-primary font-semibold text-lg">Appointment booked!</p>
                <p className="text-text-secondary text-sm">
                  {selectedSlot?.label ?? "Inspection confirmed"} for {leadName}.
                </p>
                {createdIds.inspectionId && (
                  <p className="text-text-hint text-xs font-mono">
                    Inspection ID: {createdIds.inspectionId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl py-3 text-sm font-medium transition-all"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
