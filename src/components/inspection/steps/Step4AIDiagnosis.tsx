"use client";

import { useState, useEffect, useMemo } from "react";
import { parseDiagnosisText } from "@/src/lib/diagnosis-parser";
import type { ParsedZone } from "@/src/lib/diagnosis-parser";

interface WalkthroughStep {
  findingRef?: string;
  observation?: string;
  question?: string;
  photoRef?: string | null;
}

interface DiagnosisWalkthrough {
  walkthroughSteps?: WalkthroughStep[];
  closingQuestion?: string;
}

interface WalkthroughAnswers {
  steps?: Array<{ stepRef?: string; answer?: string }>;
  closingAnswer?: string | null;
}

interface Props {
  inspectionId: string;
  initialData?: Record<string, unknown>;
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
  const [walkthrough, setWalkthrough] = useState<DiagnosisWalkthrough | null>(
    (initialData?.aiDiagnosisWalkthrough as DiagnosisWalkthrough | null) ?? null,
  );
  const [answers, setAnswers] = useState<WalkthroughAnswers | null>(
    (initialData?.homeownerWalkthroughAnswers as WalkthroughAnswers | null) ?? null,
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
        if (data?.aiDiagnosisWalkthrough)
          setWalkthrough(data.aiDiagnosisWalkthrough as DiagnosisWalkthrough);
        if (data?.homeownerWalkthroughAnswers)
          setAnswers(data.homeownerWalkthroughAnswers as WalkthroughAnswers);
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

  const answeredSteps = (answers?.steps ?? []).filter((s) => (s.answer ?? "").trim());
  const closingAnswer = (answers?.closingAnswer ?? "").trim();
  const hasCapturedAnswers = answeredSteps.length > 0 || !!closingAnswer;

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
        <p className="text-text-secondary text-base mt-1">
          AI-generated from your photo evidence and intake data.
        </p>
      </div>

      {/* Clinical analytics pointer — severity/confidence live in a separate
          rep-only view, never in front of the homeowner. */}
      <div className="bg-brand-navy/40 border border-brand-blue/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <span className="text-base leading-none mt-0.5">🔬</span>
        <p className="text-text-secondary text-xs leading-relaxed">
          Severity, confidence, and finding types are in the{" "}
          <span className="text-text-accent font-semibold">Inspection Analytics</span> panel
          (sidebar) — rep &amp; Jordan only, never shown to the homeowner.
        </p>
      </div>

      {/* What the homeowner said during the live walkthrough — captured answers */}
      {hasCapturedAnswers && (
        <div className="flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
            What the homeowner said
          </p>
          {answeredSteps.map((s, i) => (
            <div key={i} className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-1.5">
              {s.stepRef && (
                <p className="text-text-hint text-[10px] uppercase tracking-wider font-semibold">
                  {s.stepRef}
                </p>
              )}
              <p className="text-text-primary text-sm italic leading-relaxed">
                &ldquo;{(s.answer ?? "").trim()}&rdquo;
              </p>
            </div>
          ))}
          {closingAnswer && (
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-4 flex flex-col gap-1.5">
              <p className="text-text-accent text-[10px] uppercase tracking-wider font-semibold">
                Root issue — their words
              </p>
              <p className="text-text-primary text-sm italic leading-relaxed">
                &ldquo;{closingAnswer}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Zone analysis — parsed narrative */}
      <div className="flex flex-col gap-4">
        <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
          Zone Analysis
        </p>
        {parsedZones.map((zone, i) => (
          <ZoneCard key={i} zone={zone} />
        ))}
      </div>

      {/* Guided walkthrough talk-track — what the homeowner is led through. */}
      {walkthrough?.walkthroughSteps && walkthrough.walkthroughSteps.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider font-semibold">
            Guided Walkthrough — Homeowner Sequence
          </p>
          {walkthrough.walkthroughSteps.map((step, i) => (
            <div
              key={i}
              className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3"
            >
              {step.findingRef && (
                <p className="text-text-primary font-bold text-base">{step.findingRef}</p>
              )}
              {step.observation && (
                <p className="text-text-secondary text-sm leading-relaxed">{step.observation}</p>
              )}
              {step.question && (
                <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1">
                  <p className="text-text-accent text-[10px] font-semibold uppercase tracking-wider">
                    Ask them:
                  </p>
                  <p className="text-brand-blue text-sm font-medium italic">{step.question}</p>
                </div>
              )}
            </div>
          ))}
          {walkthrough.closingQuestion && (
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-5 flex flex-col gap-1">
              <p className="text-text-accent text-[10px] font-semibold uppercase tracking-wider">
                Closing question
              </p>
              <p className="text-brand-blue text-sm font-medium italic">
                {walkthrough.closingQuestion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
