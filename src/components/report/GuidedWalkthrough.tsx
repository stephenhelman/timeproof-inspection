"use client";

import { useState, useCallback } from "react";

export interface WalkthroughStep {
  findingRef: string;
  observation: string;
  question: string;
  photoRef: string | null;
  /** Photo URLs resolved server-side for this step (never the full set). */
  photos: string[];
}

interface SavedAnswers {
  steps?: Array<{ stepRef?: string; answer?: string }>;
  closingAnswer?: string | null;
}

interface Props {
  uuid: string;
  steps: WalkthroughStep[];
  closingQuestion: string;
  initialAnswers?: SavedAnswers | null;
  /**
   * Visual theme. "light" = the homeowner-report surface (default). "dark" =
   * the inspection-wizard chrome (Step3PhotoSlideshow) — legible question text on
   * the dark page instead of the washed-out light-on-dark look (FIX 2).
   */
  theme?: "light" | "dark";
}

// Theme token sets — one slideshow component, two looks. The wizard passes
// theme="dark" so the question text reads on the dark inspection page; the report
// keeps the light surface.
const THEMES = {
  light: {
    card: "bg-report-surface border border-report-border",
    closingCard: "bg-[#eef3fb] border border-[#c8d8f0]",
    observation: "text-report-text",
    question: "text-report-text",
    textarea:
      "bg-white border-2 border-[#c8d8f0] focus:border-[#2a6db5] text-report-text placeholder:text-gray-400",
    primaryBtn: "bg-[#2a6db5] hover:bg-[#235a96] text-white",
    backBtn: "border border-[#c8d8f0] text-[#235a96] hover:bg-[#eef3fb]",
    progress: "text-[#235a96]",
    progressDot: "bg-[#c8d8f0]",
    progressDotActive: "bg-[#2a6db5]",
    savedText: "text-[#235a96]",
    photoBorder: "border-report-border",
  },
  dark: {
    card: "bg-bg-surface border border-border",
    closingCard: "bg-brand-blue/5 border border-brand-blue/20",
    observation: "text-text-secondary",
    question: "text-text-primary",
    textarea:
      "bg-bg-input border border-border focus:border-brand-blue text-text-primary placeholder:text-text-hint",
    primaryBtn: "bg-brand-blue hover:bg-accent-blue-hover text-text-primary",
    backBtn: "border border-border text-text-secondary hover:text-text-primary hover:border-border-hover",
    progress: "text-text-hint",
    progressDot: "bg-border",
    progressDotActive: "bg-brand-blue",
    savedText: "text-text-accent",
    photoBorder: "border-border",
  },
} as const;

// The homeowner's guided NEPQ walkthrough as a SLIDESHOW (FIX 1): ONE question per
// page, each replacing the previous. Forward via Continue, back via the Back control
// — going back shows the answer already typed (answers are preserved per step in
// component state across navigation), never a blank box. The last step is followed
// by the closing question page; answering it ends the walkthrough. Their typed
// answers persist to the report (rep + Jordan read them later).
export default function GuidedWalkthrough({
  uuid,
  steps,
  closingQuestion,
  initialAnswers,
  theme = "light",
}: Props) {
  const t = THEMES[theme];

  // Pre-fill any previously-saved answers (also the FIX 4 restore path: re-entering
  // the walkthrough shows the answered questions, not blank boxes). Match saved
  // answers to steps by findingRef first (the persist route drops empties, so index
  // alignment can't be trusted), then fall back to positional.
  const answerForStep = (step: WalkthroughStep, i: number): string => {
    const saved = initialAnswers?.steps ?? [];
    if (step.findingRef) {
      const byRef = saved.find((s) => s?.stepRef === step.findingRef);
      if (byRef?.answer) return byRef.answer;
    }
    return saved[i]?.answer ?? "";
  };

  const [answers, setAnswers] = useState<string[]>(() => steps.map((s, i) => answerForStep(s, i)));
  const [closing, setClosing] = useState(initialAnswers?.closingAnswer ?? "");

  // page 0..steps.length-1 → step pages; page === steps.length → closing page.
  const closingPage = steps.length;
  const initialPage = (() => {
    const answeredCount = steps.map((s, i) => answerForStep(s, i)).filter((a) => a.trim()).length;
    // Resume at the first unanswered step, or the closing page once all are answered.
    return Math.min(answeredCount, closingPage);
  })();
  const [page, setPage] = useState(initialPage);
  const [done, setDone] = useState(false);

  const persist = useCallback(
    (nextAnswers: string[], nextClosing: string) => {
      // Fire-and-forget; the report is still useful if a save blips.
      const payload = {
        steps: steps.map((s, i) => ({ stepRef: s.findingRef, answer: nextAnswers[i] ?? "" })),
        closingAnswer: nextClosing,
      };
      void fetch(`/api/report/${uuid}/walkthrough`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    },
    [steps, uuid],
  );

  const setAnswer = (i: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const goNext = () => {
    persist(answers, closing);
    setPage((p) => Math.min(p + 1, closingPage));
  };
  const goBack = () => setPage((p) => Math.max(p - 1, 0));

  const finish = () => {
    persist(answers, closing);
    setDone(true);
  };

  const onClosingPage = page >= closingPage;
  const totalPages = closingPage + 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress — which page of the slideshow we're on. */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${t.progress}`}>
          {onClosingPage ? "Final question" : `Question ${page + 1} of ${steps.length}`}
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === page ? `w-5 ${t.progressDotActive}` : `w-2 ${t.progressDot}`
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── A STEP page ──────────────────────────────────────────────────────── */}
      {!onClosingPage && steps[page] && (
        <div className={`${t.card} rounded-2xl p-5 flex flex-col gap-4`}>
          {/* Observation — factual, tied to their words. No verdict. */}
          <p className={`${t.observation} text-[15px] leading-relaxed`}>{steps[page].observation}</p>

          {/* Photo(s) for this finding */}
          {steps[page].photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
              {steps[page].photos.map((url, pi) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pi}
                  src={url}
                  alt={`${steps[page].findingRef} photo ${pi + 1}`}
                  className={`h-44 w-auto rounded-xl border ${t.photoBorder} object-cover shrink-0`}
                />
              ))}
            </div>
          )}

          {/* The leading question */}
          <p className={`${t.question} text-base font-semibold leading-snug`}>{steps[page].question}</p>

          {/* Their answer, in their own words */}
          <textarea
            value={answers[page] ?? ""}
            onChange={(e) => setAnswer(page, e.target.value)}
            onBlur={() => persist(answers, closing)}
            rows={3}
            placeholder="Type what you're thinking…"
            className={`${t.textarea} rounded-xl px-4 py-3 text-[15px] focus:outline-none resize-none transition-colors`}
          />

          {/* Nav — Back (if not first) + Continue */}
          <div className="flex items-center gap-3">
            {page > 0 && (
              <button
                type="button"
                onClick={goBack}
                className={`${t.backBtn} rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors`}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!(answers[page] ?? "").trim()}
              className={`${t.primaryBtn} disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── The CLOSING page — they name the root issue themselves ────────────── */}
      {onClosingPage && (
        <div className={`${t.closingCard} rounded-2xl p-5 flex flex-col gap-4`}>
          <p className={`${t.question} text-base font-semibold leading-snug`}>{closingQuestion}</p>
          <textarea
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            onBlur={() => persist(answers, closing)}
            rows={3}
            placeholder="In your own words…"
            disabled={done}
            className={`${t.textarea} rounded-xl px-4 py-3 text-[15px] focus:outline-none resize-none transition-colors disabled:opacity-70`}
          />
          <div className="flex items-center gap-3">
            {steps.length > 0 && (
              <button
                type="button"
                onClick={goBack}
                className={`${t.backBtn} rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors`}
              >
                ← Back
              </button>
            )}
            {!done ? (
              <button
                type="button"
                onClick={finish}
                disabled={!closing.trim()}
                className={`${t.primaryBtn} disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors`}
              >
                Done
              </button>
            ) : (
              <p className={`${t.savedText} text-sm font-medium`}>Thanks — your notes are saved.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
