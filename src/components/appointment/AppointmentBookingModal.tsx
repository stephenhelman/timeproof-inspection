"use client";

import { useState } from "react";

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

type ModalStep = "preferences" | "slots" | "confirm" | "success";

type TimeOption = {
  label: string;
  description: string;
  startHour: number | undefined;
};

const TIME_OPTIONS: TimeOption[] = [
  { label: "Morning", description: "8am – 12pm", startHour: 8 },
  { label: "Afternoon", description: "12pm – 5pm", startHour: 12 },
  { label: "Evening", description: "5pm – 7pm", startHour: 17 },
  { label: "Any time", description: "Show all available", startHour: undefined },
];

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMaxDateStr(): string {
  const future = new Date();
  future.setDate(future.getDate() + 21);
  const y = future.getFullYear();
  const m = String(future.getMonth() + 1).padStart(2, "0");
  const d = String(future.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AppointmentBookingModal({
  leadId,
  leadName,
  address,
  assignedUserId,
  assignedUserName,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<ModalStep>("preferences");

  // Preference state — resets each time modal opens (via useState initial values)
  const [anyDay, setAnyDay] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [selectedTimeOption, setSelectedTimeOption] = useState<TimeOption | null>(null);

  // Slot state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Booking state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdIds, setCreatedIds] = useState<{
    appointmentId: string;
    inspectionId: string;
  } | null>(null);

  const prefsValid =
    selectedTimeOption !== null && (anyDay || preferredDate !== "");

  const handleFindTimes = async () => {
    if (!prefsValid) return;
    setSlotsLoading(true);
    setFallbackActive(false);
    setSelectedSlot(null);
    setError("");

    const params = new URLSearchParams({ leadId });
    if (!anyDay && preferredDate) params.set("preferredDate", preferredDate);
    if (selectedTimeOption?.startHour !== undefined) {
      params.set("startHour", String(selectedTimeOption.startHour));
    }

    try {
      const res = await fetch(`/api/appointment/available-slots?${params.toString()}`);
      const data = await res.json() as { slots?: Slot[]; fallback?: boolean };
      setSlots(data.slots ?? []);
      setFallbackActive(data.fallback === true);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
      setStep("slots");
    }
  };

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
      setCreatedIds({
        appointmentId: data.appointmentId,
        inspectionId: data.inspectionId,
      });
      setStep("success");
      onSuccess(data.appointmentId, data.inspectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  const headerSubtitle = {
    preferences: "Set homeowner preferences",
    slots: "Select a time",
    confirm: "Confirm appointment",
    success: "Appointment booked",
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-text-primary text-lg font-semibold">Book Inspection</h2>
            <p className="text-text-hint text-xs mt-0.5">{headerSubtitle}</p>
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

          {/* Step 1 — Preference collection */}
          {step === "preferences" && (
            <div className="space-y-5">
              {/* Day preference */}
              <div className="space-y-2">
                <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  Preferred Day
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    role="switch"
                    aria-checked={anyDay}
                    onClick={() => {
                      setAnyDay((v) => !v);
                      if (!anyDay) setPreferredDate("");
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                      anyDay ? "bg-brand-blue" : "bg-border"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                        anyDay ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="text-text-secondary text-sm">Any available day</span>
                </label>
                {!anyDay && (
                  <input
                    type="date"
                    min={getTodayStr()}
                    max={getMaxDateStr()}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                  />
                )}
              </div>

              {/* Time preference */}
              <div className="space-y-2">
                <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  Preferred Time of Day
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_OPTIONS.map((opt) => {
                    const isSelected = selectedTimeOption?.label === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setSelectedTimeOption(opt)}
                        className={`flex flex-col items-start px-3 py-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-brand-blue bg-brand-blue/10"
                            : "border-border hover:border-border-hover"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold ${
                            isSelected ? "text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-text-hint text-xs mt-0.5">
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={!prefsValid || slotsLoading}
                onClick={handleFindTimes}
                className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all"
              >
                {slotsLoading ? "Finding times…" : "Find Times →"}
              </button>
            </div>
          )}

          {/* Step 2 — Slot selection */}
          {step === "slots" && (
            <>
              {fallbackActive && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-sm">
                  No availability matching that preference — showing next available times instead.
                </div>
              )}
              {slots.length === 0 && (
                <p className="text-text-hint text-sm text-center py-6">
                  No slots available. Contact office to schedule manually.
                </p>
              )}
              {slots.length > 0 && (
                <div className="space-y-2">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.date === slot.date &&
                      selectedSlot?.time === slot.time;
                    return (
                      <button
                        key={`${slot.date}-${slot.time}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                          isSelected
                            ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                            : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                        }`}
                      >
                        {slot.label}
                        {isSelected && <span className="text-brand-blue">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("preferences")}
                  className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl py-3 text-sm font-medium transition-all"
                >
                  ← Change Preference
                </button>
                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={() => setStep("confirm")}
                  className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3 text-sm transition-all"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Confirmation */}
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
                      <span className="text-text-primary font-medium text-right max-w-[60%]">
                        {address}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-hint">Time</span>
                    <span className="text-text-primary font-medium">
                      {selectedSlot.label}
                    </span>
                  </div>
                  {assignedUserName && (
                    <div className="flex justify-between">
                      <span className="text-text-hint">Assigned rep</span>
                      <span className="text-text-primary font-medium">
                        {assignedUserName}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-text-hint text-xs">
                  A confirmation SMS will be sent to the homeowner and the GHL calendar event
                  will be created.
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

          {/* Step 4 — Success */}
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
