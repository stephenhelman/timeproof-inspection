"use client";

import { useState, useEffect, useMemo } from "react";
import { parseDiagnosisText } from "@/src/lib/diagnosis-parser";
import type { ParsedZone } from "@/src/lib/diagnosis-parser";

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

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  low: "bg-green-500/20 text-green-300 border border-green-500/30",
};

const OVERALL_SEVERITY_STYLES: Record<string, string> = {
  high: "bg-accent-red/10 border-accent-red/30 text-accent-red",
  medium: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  low: "bg-green-500/10 border-green-500/30 text-green-400",
};

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ZoneCard({ zone }: { zone: ParsedZone }) {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      {zone.name && (
        <p className="text-text-primary font-bold text-base">{zone.name}</p>
      )}
      {zone.blocks.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i} className="text-text-secondary text-sm leading-relaxed">
              {block.text}
            </p>
          );
        }
        if (block.type === "callout") {
          return (
            <div
              key={i}
              className="border-l-2 border-brand-blue bg-brand-blue/10 rounded-r-xl px-4 py-3"
            >
              <p className="text-brand-blue text-[10px] font-semibold uppercase tracking-wider mb-1">
                In their words
              </p>
              <p className="text-text-primary text-sm italic leading-relaxed">
                &ldquo;{block.text}&rdquo;
              </p>
            </div>
          );
        }
        if (block.type === "question") {
          return (
            <div
              key={i}
              className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1"
            >
              <p className="text-text-accent text-[10px] font-semibold uppercase tracking-wider">
                Ask them:
              </p>
              <p className="text-brand-blue text-sm font-medium italic">
                {block.text}
              </p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

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

  useEffect(() => {
    if (description) return;
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.aiDiagnosisDescription) setDescription(data.aiDiagnosisDescription);
        if (data?.aiDiagnosisStructured)
          setStructured(data.aiDiagnosisStructured as StructuredDiagnosis);
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

  const parsedZones = useMemo(
    () => (description ? parseDiagnosisText(description) : []),
    [description],
  );

  if (!description) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
          <p className="text-text-secondary text-base mt-1">
            AI diagnosis not yet generated.
          </p>
        </div>

        <div className="bg-bg-elevated border border-border rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-text-secondary text-sm">
            The AI diagnosis did not generate, or you are revisiting this step
            before completing the slideshow. You can enter diagnosis notes manually.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-text-secondary text-sm font-medium">
              Diagnosis Notes
            </label>
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

  const overallStyle =
    OVERALL_SEVERITY_STYLES[structured?.overallSeverity ?? ""] ??
    OVERALL_SEVERITY_STYLES.medium;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
        <p className="text-text-secondary text-base mt-1">
          AI-generated from your photo evidence and intake data.
        </p>
      </div>

      {/* Zone analysis — parsed from description */}
      <div className="flex flex-col gap-4">
        <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
          Zone Analysis
        </p>
        {parsedZones.map((zone, i) => (
          <ZoneCard key={i} zone={zone} />
        ))}
      </div>

      {/* Structured findings section */}
      {structured && (
        <div className="flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
            Findings Summary
          </p>

          {/* Overall severity — prominent, sets tone */}
          {structured.overallSeverity && (
            <div className={`border rounded-xl px-4 py-3 ${overallStyle}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-70">
                Overall Severity
              </p>
              <p className="text-lg font-bold">
                Overall:{" "}
                {structured.overallSeverity.charAt(0).toUpperCase() +
                  structured.overallSeverity.slice(1)}{" "}
                Severity
              </p>
              {structured.primaryConcern && (
                <p className="text-xs mt-0.5 opacity-80">
                  Primary concern: {toTitleCase(structured.primaryConcern)}
                </p>
              )}
            </div>
          )}

          {/* Zone finding cards */}
          {structured.zones && structured.zones.length > 0 && (
            <div className="flex flex-col gap-2">
              {structured.zones.map((z, i) => (
                <div
                  key={i}
                  className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-text-primary font-semibold text-sm">
                      {z.zone}
                    </p>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${SEVERITY_BADGE[z.severity] ?? SEVERITY_BADGE.medium}`}
                    >
                      {z.severity}
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm">
                    {toTitleCase(z.findingType)}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {z.confidence > 0 && (
                      <span className="text-text-hint text-xs">
                        {Math.round(z.confidence * 100)}% confidence
                      </span>
                    )}
                    {z.referencedWarningSign && (
                      <span className="bg-bg-elevated border border-border rounded-full px-2 py-0.5 text-text-hint text-xs">
                        {z.referencedWarningSign.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Homeowner admissions */}
          {structured.homeownerAdmissions &&
            structured.homeownerAdmissions.length > 0 && (
              <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
                  What the homeowner acknowledged
                </p>
                <ul className="flex flex-col gap-2">
                  {structured.homeownerAdmissions.map((admission, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-brand-blue text-base leading-none mt-0.5 shrink-0">
                        &ldquo;
                      </span>
                      <span className="text-text-secondary text-sm italic leading-relaxed">
                        {admission}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
