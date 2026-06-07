"use client";

import { useState, useCallback } from "react";

function TextArea({ label, value, onChange, placeholder, disabled, rows = 3 }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-text-secondary text-sm font-medium">{label}</label>}
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`bg-bg-input border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled, type = "text" }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-text-secondary text-sm font-medium">{label}</label>}
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
}

function Toggle({ label, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-12">
      <span className="text-text-secondary text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!value}
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ${
          value ? "bg-brand-blue" : "bg-border"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, disabled }) {
  return (
    <div className={`flex bg-bg-elevated rounded-xl p-1 gap-1 ${disabled ? "opacity-50" : ""}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-10 ${
            value === opt.value
              ? "bg-brand-blue text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          } ${disabled ? "cursor-not-allowed" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="border-b border-border pb-2 mb-2">
      <h3 className="text-text-accent text-xs font-semibold uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 text-text-hint inline-block ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export default function Step5IntakeForm({ inspectionId, initialData, onAdvanceToWarningSigns }) {
  const d = initialData || {};
  const pass1Complete = !!d.intakePass1Complete;

  const [form, setForm] = useState({
    northStar: d.northStar || "",
    focusDrivers: d.focusDrivers || "",
    timeInHome: d.timeInHome || "",
    yearBuilt: d.yearBuilt || "",
    ageOfRoof: d.ageOfRoof || "",
    lastReplacedBy: d.lastReplacedBy || "",
    pastRepairs: d.pastRepairs || "",
    otherProjects: d.otherProjects || "",
    hoaPresent: d.hoaPresent || false,
    hoaName: d.hoaName || "",
    issuesConcerns: d.issuesConcerns || "",
    issueDuration: d.issueDuration || "",
    issueImpact: d.issueImpact || "",
    rootCauseBeliefBefore: d.rootCauseBeliefBefore || "",
    triggerMoment: d.triggerMoment || "",
    priorMeetingHad: d.priorMeetingHad || false,
    priorMeetingWho: d.priorMeetingWho || "",
    priorMeetingRecommended: d.priorMeetingRecommended || "",
    priorMeetingWhyNotFixed: d.priorMeetingWhyNotFixed || "",
    noPriorMeetingReason: d.noPriorMeetingReason || "",
    winDefinition: d.winDefinition || "",
    colorPreference: d.colorPreference || "",
    personalFamily: d.personalFamily || "",
    personalOccupation: d.personalOccupation || "",
    personalRecreation: d.personalRecreation || "",
    personalIdentity: d.personalIdentity || "",
    problemAwarenessBefore: d.problemAwarenessBefore || "",
    problemAwarenessAfter: d.problemAwarenessAfter || "",
    repNotes: d.repNotes || "",
  });

  const [saving, setSaving] = useState(false);
  const [pass1Error, setPass1Error] = useState("");

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const patchInspection = async (data) => {
    await fetch(`/api/inspection/${inspectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  const handleCompletePass1 = async () => {
    if (!form.problemAwarenessBefore.trim()) {
      setPass1Error("Problem Awareness (Before) is required before completing Pass 1.");
      return;
    }
    setPass1Error("");
    setSaving(true);
    try {
      // Write flat fields AND a JSON snapshot for the Claude API
      await patchInspection({ ...form, intakePass1Complete: true, intakePass1: form });
      onAdvanceToWarningSigns?.();
    } finally {
      setSaving(false);
    }
  };

  const handleCompletePass2 = async () => {
    setSaving(true);
    try {
      await patchInspection({ problemAwarenessAfter: form.problemAwarenessAfter, intakePass2Complete: true });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSave = async (field, value) => {
    await patchInspection({ [field]: value });
  };

  const locked = pass1Complete;

  if (pass1Complete) {
    // Pass 2 — only problemAwarenessAfter is editable
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl px-4 py-3">
          <p className="text-text-accent text-sm font-semibold">Pass 2 of 2</p>
          <p className="text-text-secondary text-sm mt-0.5">Capture updated problem awareness after findings review</p>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader title="Problem Awareness" />

          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium flex items-center">
              Before inspection <LockIcon />
            </label>
            <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 text-text-secondary text-sm opacity-60">
              {form.problemAwarenessBefore || <span className="italic">Not recorded</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-text-accent text-sm font-semibold">
              After findings review
            </label>
            <textarea
              value={form.problemAwarenessAfter}
              onChange={(e) => update("problemAwarenessAfter", e.target.value)}
              onBlur={(e) => handleAutoSave("problemAwarenessAfter", e.target.value)}
              rows={4}
              placeholder="How has their understanding of the problem changed after seeing the findings?"
              className="bg-bg-input border-2 border-text-accent text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:ring-2 focus:ring-text-accent/30 resize-none transition-colors"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCompletePass2}
          disabled={saving}
          className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-base font-semibold transition-all"
        >
          {saving ? "Saving…" : "Complete Intake ✓"}
        </button>
      </div>
    );
  }

  // Pass 1
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
        <p className="text-text-secondary text-sm font-semibold">Pass 1 of 2</p>
        <p className="text-text-hint text-sm mt-0.5">Capture homeowner situation before presenting findings</p>
      </div>

      {/* Section 1: North Star */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="North Star & Focus" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea
            label="Why are we here? (North Star)"
            value={form.northStar}
            onChange={(v) => update("northStar", v)}
            onBlur={() => handleAutoSave("northStar", form.northStar)}
            placeholder="What brought us here today?"
            rows={3}
          />
          <TextArea
            label="What moves the needle? (Focus Drivers)"
            value={form.focusDrivers}
            onChange={(v) => update("focusDrivers", v)}
            placeholder="What matters most to them?"
            rows={3}
          />
        </div>
      </div>

      {/* Section 2: Home & System Background */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Home & System Background" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time in home" value={form.timeInHome} onChange={(v) => update("timeInHome", v)} placeholder="e.g. 12 years" />
          <Field label="Year built" value={form.yearBuilt} onChange={(v) => update("yearBuilt", v)} placeholder="e.g. 1998" />
          <Field label="Age of roof" value={form.ageOfRoof} onChange={(v) => update("ageOfRoof", v)} placeholder="e.g. 18 years" />
          <Field label="Last replaced by" value={form.lastReplacedBy} onChange={(v) => update("lastReplacedBy", v)} placeholder="Contractor name" />
        </div>
        <TextArea label="Past repairs" value={form.pastRepairs} onChange={(v) => update("pastRepairs", v)} placeholder="Any prior repair work?" rows={2} />
        <TextArea label="Other projects" value={form.otherProjects} onChange={(v) => update("otherProjects", v)} placeholder="Other home projects in progress or planned" rows={2} />
        <Toggle label="HOA present?" value={form.hoaPresent} onChange={(v) => update("hoaPresent", v)} />
        {form.hoaPresent && (
          <Field label="HOA name" value={form.hoaName} onChange={(v) => update("hoaName", v)} placeholder="HOA or management company name" />
        )}
      </div>

      {/* Section 3: Issues & Concerns */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Issues & Concerns" />
        <TextArea label="Issues & concerns" value={form.issuesConcerns} onChange={(v) => update("issuesConcerns", v)} placeholder="What are they dealing with?" rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="How long?" value={form.issueDuration} onChange={(v) => update("issueDuration", v)} placeholder="Duration of issue" />
          <TextArea label="Impact" value={form.issueImpact} onChange={(v) => update("issueImpact", v)} placeholder="How has it affected them?" rows={2} />
        </div>
        <TextArea label="Root cause belief (before)" value={form.rootCauseBeliefBefore} onChange={(v) => update("rootCauseBeliefBefore", v)} placeholder="What do THEY think is causing it?" rows={2} />
        <TextArea label="Trigger moment" value={form.triggerMoment} onChange={(v) => update("triggerMoment", v)} placeholder="What finally prompted this visit?" rows={2} />
      </div>

      {/* Section 4: Prior Meetings */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Prior Meetings" />
        <Toggle label="Had a prior meeting with a roofer?" value={form.priorMeetingHad} onChange={(v) => update("priorMeetingHad", v)} />
        {form.priorMeetingHad ? (
          <>
            <Field label="Who?" value={form.priorMeetingWho} onChange={(v) => update("priorMeetingWho", v)} placeholder="Company or person" />
            <TextArea label="What was recommended?" value={form.priorMeetingRecommended} onChange={(v) => update("priorMeetingRecommended", v)} placeholder="What did they propose?" rows={2} />
            <TextArea label="Why wasn't it fixed?" value={form.priorMeetingWhyNotFixed} onChange={(v) => update("priorMeetingWhyNotFixed", v)} placeholder="What stopped them from moving forward?" rows={2} />
          </>
        ) : (
          <TextArea label="Why no prior meeting?" value={form.noPriorMeetingReason} onChange={(v) => update("noPriorMeetingReason", v)} placeholder="Why haven't they had someone out before?" rows={2} />
        )}
      </div>

      {/* Section 5: Future Pace */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Future Pace" />
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Win definition</label>
          <SegmentedControl
            options={[{ value: "short", label: "Short Term" }, { value: "long", label: "Long Term" }]}
            value={form.winDefinition}
            onChange={(v) => update("winDefinition", v)}
          />
        </div>
        <Field label="Color preference" value={form.colorPreference} onChange={(v) => update("colorPreference", v)} placeholder="Shingle color preference?" />
      </div>

      {/* Section 6: Personal */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Personal" />
        <div className="grid grid-cols-2 gap-3">
          <TextArea label="Family" value={form.personalFamily} onChange={(v) => update("personalFamily", v)} placeholder="Family situation" rows={2} />
          <TextArea label="Occupation" value={form.personalOccupation} onChange={(v) => update("personalOccupation", v)} placeholder="What do they do?" rows={2} />
          <TextArea label="Recreation" value={form.personalRecreation} onChange={(v) => update("personalRecreation", v)} placeholder="Hobbies / interests" rows={2} />
          <TextArea label="Identity" value={form.personalIdentity} onChange={(v) => update("personalIdentity", v)} placeholder="How do they see themselves?" rows={2} />
        </div>
      </div>

      {/* Section 7: Problem Awareness */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Problem Awareness" />
        <TextArea
          label="Before (editable)"
          value={form.problemAwarenessBefore}
          onChange={(v) => update("problemAwarenessBefore", v)}
          placeholder="In their own words, how aware are they of the problem right now?"
          rows={3}
        />
        {pass1Error && <p className="text-accent-red text-sm">{pass1Error}</p>}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-hint text-sm font-medium flex items-center">
            After (unlocked after Warning Signs) <LockIcon />
          </label>
          <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 text-text-hint text-sm italic opacity-60">
            Complete after photo review
          </div>
        </div>
      </div>

      {/* Section 8: Rep Notes */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Rep Notes" />
        <div className="bg-bg-elevated border border-border/50 rounded-xl px-4 py-3">
          <p className="text-text-hint text-xs font-medium mb-2">Internal Only — Not shown on report</p>
          <TextArea
            value={form.repNotes}
            onChange={(v) => update("repNotes", v)}
            placeholder="Anything the rep should remember — never shown to the homeowner"
            rows={3}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCompletePass1}
        disabled={saving}
        className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-base font-semibold transition-all"
      >
        {saving ? "Saving…" : "Complete Pass 1 →"}
      </button>
    </div>
  );
}
