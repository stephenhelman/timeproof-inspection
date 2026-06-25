"use client";

import { useState, useCallback, useRef } from "react";

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
}

// The homeowner's guided NEPQ walkthrough. Observation → leading question →
// THEY type their answer → next. Paced reveal: the next step does not appear
// until the current one is answered, so one question lands at a time. Their
// typed answers persist to the report (rep + Jordan read them later).
export default function GuidedWalkthrough({
  uuid,
  steps,
  closingQuestion,
  initialAnswers,
}: Props) {
  const initialStepAnswers = steps.map(
    (_, i) => initialAnswers?.steps?.[i]?.answer ?? "",
  );
  // If they've answered before, reveal through their last answered step.
  const answeredCount = initialStepAnswers.filter((a) => a.trim()).length;

  const [answers, setAnswers] = useState<string[]>(initialStepAnswers);
  const [closing, setClosing] = useState(initialAnswers?.closingAnswer ?? "");
  const [revealed, setRevealed] = useState(Math.max(1, answeredCount + (answeredCount < steps.length ? 1 : 0)));
  const [atClosing, setAtClosing] = useState(answeredCount >= steps.length && steps.length > 0);
  const [done, setDone] = useState(false);

  const closingRef = useRef<HTMLDivElement | null>(null);

  const persist = useCallback(
    (nextAnswers: string[], nextClosing: string) => {
      // Fire-and-forget; the report is still useful if a save blips.
      const payload = {
        steps: steps.map((s, i) => ({
          stepRef: s.findingRef,
          answer: nextAnswers[i] ?? "",
        })),
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

  const advanceFrom = (i: number) => {
    persist(answers, closing);
    if (i + 1 < steps.length) {
      setRevealed((r) => Math.max(r, i + 2));
    } else {
      setAtClosing(true);
      // Let the closing block mount, then bring it into view.
      requestAnimationFrame(() =>
        closingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    }
  };

  const finish = () => {
    persist(answers, closing);
    setDone(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {steps.slice(0, revealed).map((step, i) => {
        const isActive = i === revealed - 1 && !atClosing;
        return (
          <div
            key={i}
            className="bg-report-surface border border-report-border rounded-2xl p-5 flex flex-col gap-4"
          >
            {/* Observation — factual, tied to their words. No verdict. */}
            <p className="text-report-text text-[15px] leading-relaxed">
              {step.observation}
            </p>

            {/* Photo(s) for this finding */}
            {step.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                {step.photos.map((url, pi) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={pi}
                    src={url}
                    alt={`${step.findingRef} photo ${pi + 1}`}
                    className="h-44 w-auto rounded-xl border border-report-border object-cover shrink-0"
                  />
                ))}
              </div>
            )}

            {/* The leading question */}
            <p className="text-report-text text-base font-semibold leading-snug">
              {step.question}
            </p>

            {/* Their answer, in their own words */}
            <textarea
              value={answers[i] ?? ""}
              onChange={(e) => setAnswer(i, e.target.value)}
              onBlur={() => persist(answers, closing)}
              rows={3}
              placeholder="Type what you're thinking…"
              className="bg-white border-2 border-[#c8d8f0] focus:border-[#2a6db5] text-report-text rounded-xl px-4 py-3 text-[15px] placeholder:text-gray-400 focus:outline-none resize-none transition-colors"
            />

            {isActive && (
              <button
                type="button"
                onClick={() => advanceFrom(i)}
                disabled={!(answers[i] ?? "").trim()}
                className="self-start bg-[#2a6db5] hover:bg-[#235a96] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        );
      })}

      {/* Closing — they name the root issue themselves */}
      {atClosing && (
        <div
          ref={closingRef}
          className="bg-[#eef3fb] border border-[#c8d8f0] rounded-2xl p-5 flex flex-col gap-4"
        >
          <p className="text-report-text text-base font-semibold leading-snug">
            {closingQuestion}
          </p>
          <textarea
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            onBlur={() => persist(answers, closing)}
            rows={3}
            placeholder="In your own words…"
            disabled={done}
            className="bg-white border-2 border-[#c8d8f0] focus:border-[#2a6db5] text-report-text rounded-xl px-4 py-3 text-[15px] placeholder:text-gray-400 focus:outline-none resize-none transition-colors disabled:opacity-70"
          />
          {!done ? (
            <button
              type="button"
              onClick={finish}
              disabled={!closing.trim()}
              className="self-start bg-[#2a6db5] hover:bg-[#235a96] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 min-h-11 text-sm font-semibold transition-colors"
            >
              Done
            </button>
          ) : (
            <p className="text-[#235a96] text-sm font-medium">
              Thanks — your notes are saved.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
