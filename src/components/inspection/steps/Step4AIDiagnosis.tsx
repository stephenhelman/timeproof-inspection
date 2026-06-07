"use client";

import { useState, useEffect } from "react";

interface StructuredZone {
  zone: string;
  findingType: string;
  severity: "high" | "medium" | "low";
  confidence: number;
  referencedWarningSign: string | null;
}

interface StructuredDiagnosis {
  zones?: StructuredZone[];
  overallSeverity?: "high" | "medium" | "low";
  primaryConcern?: string;
  homeownerAdmissions?: string[];
}

interface Props {
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
};

const OVERALL_SEVERITY_STYLES: Record<string, string> = {
  high: "bg-accent-red/10 border-accent-red/30 text-accent-red",
  medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
  low: "bg-success/10 border-success-text/30 text-success-text",
};

export default function Step4AIDiagnosis({ inspectionId, initialData }: Props) {
  const [description, setDescription] = useState<string | null>(
    (initialData?.aiDiagnosisDescription as string | null) ?? null,
  );
  const [structured, setStructured] = useState<StructuredDiagnosis | null>(
    (initialData?.aiDiagnosisStructured as StructuredDiagnosis | null) ?? null,
  );
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  // Reload if diagnosis was just generated (aiDiagnosisDescription may not be in initialData)
  useEffect(() => {
    if (description) return;
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.aiDiagnosisDescription) {
          setDescription(data.aiDiagnosisDescription);
        }
        if (data?.aiDiagnosisStructured) {
          setStructured(data.aiDiagnosisStructured as StructuredDiagnosis);
        }
      })
      .catch(() => {});
  }, [inspectionId, description]);

  const handleSaveManual = async () => {
    if (!manualNotes.trim()) return;
    setSavingManual(true);
    try {
      await fetch(`/api/inspection/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiDiagnosisDescription: manualNotes.trim(),
          aiGeneratedAt: new Date().toISOString(),
        }),
      });
      setDescription(manualNotes.trim());
      setManualSaved(true);
      setTimeout(() => setManualSaved(false), 3000);
    } finally {
      setSavingManual(false);
    }
  };

  if (!description) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
          <p className="text-text-secondary text-base mt-1">AI diagnosis not yet generated.</p>
        </div>

        <div className="bg-bg-elevated border border-border rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-text-secondary text-sm">
            The AI diagnosis did not generate, or you are revisiting this step before completing the slideshow. You can enter diagnosis notes manually.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-text-secondary text-sm font-medium">Diagnosis Notes</label>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={5}
              placeholder="Describe what you found zone by zone…"
              className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveManual}
            disabled={savingManual || !manualNotes.trim()}
            className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-12 text-sm font-semibold transition-colors"
          >
            {savingManual ? "Saving…" : manualSaved ? "Saved ✓" : "Save Notes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
        <p className="text-text-secondary text-base mt-1">
          AI-generated from your photo evidence and intake data.
        </p>
      </div>

      {/* Overall severity badge */}
      {structured?.overallSeverity && (
        <div className={`border rounded-xl px-4 py-3 ${OVERALL_SEVERITY_STYLES[structured.overallSeverity] ?? OVERALL_SEVERITY_STYLES.medium}`}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5">Overall Severity</p>
          <p className="text-base font-bold capitalize">{structured.overallSeverity}</p>
          {structured.primaryConcern && (
            <p className="text-xs mt-0.5 opacity-80 capitalize">
              Primary: {structured.primaryConcern.replace(/_/g, " ")}
            </p>
          )}
        </div>
      )}

      {/* Homeowner-facing diagnosis text */}
      <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">Diagnosis</p>
        <div className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
          {description}
        </div>
      </div>

      {/* Rep guidance callout */}
      <div className="bg-brand-navy border border-brand-blue/30 rounded-xl px-4 py-3">
        <p className="text-text-accent text-xs font-semibold mb-1">Rep Guidance</p>
        <p className="text-text-secondary text-sm">
          Walk through this with the homeowner and ask: <span className="text-text-primary italic">&ldquo;Does that match what you&apos;ve been noticing?&rdquo;</span>
        </p>
      </div>

      {/* Zone breakdown */}
      {structured?.zones && structured.zones.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">Zone Findings</p>
          {structured.zones.map((z, i) => (
            <div key={i} className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-text-primary font-semibold text-sm">{z.zone}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${SEVERITY_STYLES[z.severity] ?? SEVERITY_STYLES.medium}`}>
                  {z.severity}
                </span>
              </div>
              <p className="text-text-secondary text-xs capitalize">
                {z.findingType.replace(/_/g, " ")}
                {z.confidence ? ` — ${Math.round(z.confidence * 100)}% confidence` : ""}
              </p>
              {z.referencedWarningSign && (
                <p className="text-text-hint text-xs">
                  Correlates with warning sign: <span className="text-text-secondary">{z.referencedWarningSign.replace(/_/g, " ")}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Homeowner admissions */}
      {structured?.homeownerAdmissions && structured.homeownerAdmissions.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">What They&apos;ve Acknowledged</p>
          <ul className="flex flex-col gap-1.5">
            {structured.homeownerAdmissions.map((admission, i) => (
              <li key={i} className="flex items-start gap-2 text-text-secondary text-sm">
                <span className="text-brand-blue mt-0.5 shrink-0">•</span>
                <span className="italic">&ldquo;{admission}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
