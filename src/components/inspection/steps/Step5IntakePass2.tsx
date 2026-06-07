"use client";

import { useState } from "react";

interface Props {
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-text-hint text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-text-secondary text-sm leading-relaxed bg-bg-elevated border border-border rounded-xl px-4 py-3">
        {value}
      </p>
    </div>
  );
}

function ReadOnlyToggle({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between gap-3 min-h-10">
      <p className="text-text-hint text-xs font-medium uppercase tracking-wider">{label}</p>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${value ? "bg-success/20 text-success-text" : "bg-bg-elevated text-text-hint border border-border"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-b border-border pb-1.5">
        <h3 className="text-text-hint text-xs font-semibold uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-text-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export default function Step5IntakePass2({ inspectionId, initialData }: Props) {
  const d = initialData ?? {};

  // Read existing postDiagnosisAdmission from intakePass2 JSON if present
  const existing = (() => {
    const p2 = d.intakePass2;
    if (p2 && typeof p2 === "object" && !Array.isArray(p2)) {
      return (p2 as Record<string, unknown>).postDiagnosisAdmission as string | undefined;
    }
    return undefined;
  })();

  const [admission, setAdmission] = useState(existing ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // intakePass2 JSON shape (Sprint 10 reference):
  //   { postDiagnosisAdmission: string }
  // Only postDiagnosisAdmission is written here. Pass 1 fields live in the flat
  // inspection columns and are NOT duplicated into intakePass2.
  const handleSave = async () => {
    if (!admission.trim()) {
      setError("This field is required before advancing.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await fetch(`/api/inspection/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakePass2: { postDiagnosisAdmission: admission.trim() },
          intakePass2Complete: true,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Intake — Pass 2</h2>
        <p className="text-text-secondary text-base mt-1">
          Review what the homeowner shared before their diagnosis. Capture their post-diagnosis understanding.
        </p>
      </div>

      {/* Locked indicator */}
      <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 flex items-center gap-2.5">
        <LockIcon />
        <p className="text-text-hint text-xs">
          Pass 1 responses are locked and read-only. Only the field below is editable.
        </p>
      </div>

      {/* Pass 1 — read-only */}
      <Section title="North Star & Focus">
        <ReadOnlyField label="Why are we here?" value={d.northStar as string} />
        <ReadOnlyField label="What moves the needle?" value={d.focusDrivers as string} />
      </Section>

      <Section title="Home & System">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Time in home" value={d.timeInHome as string} />
          <ReadOnlyField label="Year built" value={d.yearBuilt as string} />
          <ReadOnlyField label="Age of roof" value={d.ageOfRoof as string} />
          <ReadOnlyField label="Last replaced by" value={d.lastReplacedBy as string} />
        </div>
        <ReadOnlyField label="Past repairs" value={d.pastRepairs as string} />
        <ReadOnlyField label="Other projects" value={d.otherProjects as string} />
        <ReadOnlyToggle label="HOA present?" value={d.hoaPresent as boolean} />
        {!!d.hoaPresent && <ReadOnlyField label="HOA name" value={d.hoaName as string} />}
      </Section>

      <Section title="Issues & Concerns">
        <ReadOnlyField label="Issues & concerns" value={d.issuesConcerns as string} />
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="How long?" value={d.issueDuration as string} />
          <ReadOnlyField label="Impact" value={d.issueImpact as string} />
        </div>
        <ReadOnlyField label="Root cause belief (before)" value={d.rootCauseBeliefBefore as string} />
        <ReadOnlyField label="Trigger moment" value={d.triggerMoment as string} />
      </Section>

      <Section title="Prior Meetings">
        <ReadOnlyToggle label="Had prior meeting?" value={d.priorMeetingHad as boolean} />
        {!!d.priorMeetingHad ? (
          <>
            <ReadOnlyField label="Who?" value={d.priorMeetingWho as string} />
            <ReadOnlyField label="What was recommended?" value={d.priorMeetingRecommended as string} />
            <ReadOnlyField label="Why not fixed?" value={d.priorMeetingWhyNotFixed as string} />
          </>
        ) : (
          <ReadOnlyField label="Why no prior meeting?" value={d.noPriorMeetingReason as string} />
        )}
      </Section>

      <Section title="Personal">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Family" value={d.personalFamily as string} />
          <ReadOnlyField label="Occupation" value={d.personalOccupation as string} />
          <ReadOnlyField label="Recreation" value={d.personalRecreation as string} />
          <ReadOnlyField label="Identity" value={d.personalIdentity as string} />
        </div>
      </Section>

      <Section title="Problem Awareness (Before)">
        <ReadOnlyField label="In their own words" value={d.problemAwarenessBefore as string} />
      </Section>

      {/* Divider */}
      <div className="border-t border-brand-blue/30" />

      {/* NEW — postDiagnosisAdmission */}
      <div className="flex flex-col gap-3">
        <div className="border-b border-brand-blue/40 pb-1.5">
          <h3 className="text-text-accent text-xs font-semibold uppercase tracking-widest">Post-Diagnosis (New)</h3>
        </div>

        <div className="bg-brand-navy border border-brand-blue/30 rounded-xl px-4 py-3">
          <p className="text-text-accent text-xs font-semibold mb-1">Why this matters</p>
          <p className="text-text-secondary text-xs leading-relaxed">
            This is the homeowner&apos;s own words about their roof — after seeing the evidence. Jordan reads this during revival conversations.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-semibold">
            Based on what you&apos;ve seen today, what do you believe is the issue with your roof?
          </label>
          <textarea
            value={admission}
            onChange={(e) => { setAdmission(e.target.value); if (error) setError(""); }}
            rows={4}
            placeholder="In their own words…"
            className="bg-bg-input border-2 border-text-accent text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:ring-2 focus:ring-text-accent/30 resize-none transition-colors"
          />
          {error && <p className="text-accent-red text-xs">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-12 text-sm font-semibold transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Response"}
        </button>
      </div>
    </div>
  );
}
