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

// Legacy/fallback renderer — only for inspections that have a diagnosis description
// but NO guided walkthrough (so there's nothing to read back). The "Ask them:"
// question block is intentionally dropped: this page never re-asks (FIX 3).
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
        // block.type === "question" → dropped (no re-ask on this page).
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

  const walkthroughSteps = walkthrough?.walkthroughSteps ?? [];
  const hasWalkthrough = walkthroughSteps.length > 0;
  const closingAnswer = (answers?.closingAnswer ?? "").trim();
  const closingQuestion = (walkthrough?.closingQuestion ?? "").trim();

  // The homeowner's answer for a given finding. The persist route drops empty
  // answers, so index alignment isn't reliable — match by findingRef first, then
  // fall back to positional.
  const answerForFinding = (step: WalkthroughStep, i: number): string => {
    const saved = answers?.steps ?? [];
    if (step.findingRef) {
      const byRef = saved.find((s) => s?.stepRef === step.findingRef);
      if ((byRef?.answer ?? "").trim()) return (byRef!.answer ?? "").trim();
    }
    return (saved[i]?.answer ?? "").trim();
  };

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
          Review this together — what we found, and what you told us.
        </p>
      </div>

      {hasWalkthrough ? (
        // ── Per-finding read-back: observation → WE ASKED → YOU SAID (FIX 3). This
        // page confirms the homeowner's own words back to them; it never re-asks.
        <div className="flex flex-col gap-4">
          {walkthroughSteps.map((step, i) => {
            const said = answerForFinding(step, i);
            return (
              <div
                key={i}
                className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4"
              >
                {step.observation && (
                  <p className="text-text-secondary text-sm leading-relaxed">{step.observation}</p>
                )}
                {step.question && (
                  <div className="flex flex-col gap-1">
                    <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider">
                      We asked
                    </p>
                    <p className="text-text-primary text-sm font-medium leading-snug">
                      {step.question}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1 border-t border-border/50 pt-3">
                  <p className="text-text-accent text-[10px] font-semibold uppercase tracking-wider">
                    You said
                  </p>
                  {said ? (
                    <p className="text-text-primary text-sm italic leading-relaxed">
                      &ldquo;{said}&rdquo;
                    </p>
                  ) : (
                    <p className="text-text-hint text-sm italic">— not answered —</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Closing — the root issue, in their own words. Same we-asked → you-said
              shape. */}
          {(closingQuestion || closingAnswer) && (
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-5 flex flex-col gap-4">
              {closingQuestion && (
                <div className="flex flex-col gap-1">
                  <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider">
                    We asked
                  </p>
                  <p className="text-text-primary text-sm font-medium leading-snug">
                    {closingQuestion}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1 border-t border-brand-blue/20 pt-3">
                <p className="text-text-accent text-[10px] font-semibold uppercase tracking-wider">
                  You said
                </p>
                {closingAnswer ? (
                  <p className="text-text-primary text-sm italic leading-relaxed">
                    &ldquo;{closingAnswer}&rdquo;
                  </p>
                ) : (
                  <p className="text-text-hint text-sm italic">— not answered —</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ── Legacy fallback: a diagnosis with no guided walkthrough to read back.
        // Show the parsed narrative (no re-ask blocks) so the finding is still here.
        <div className="flex flex-col gap-4">
          {parsedZones.map((zone, i) => (
            <ZoneCard key={i} zone={zone} />
          ))}
        </div>
      )}
    </div>
  );
}
