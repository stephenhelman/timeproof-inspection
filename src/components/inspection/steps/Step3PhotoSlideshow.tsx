"use client";

import { useState, useEffect, useCallback } from "react";
import GuidedWalkthrough from "@/src/components/report/GuidedWalkthrough";
import type { WalkthroughStep } from "@/src/components/report/GuidedWalkthrough";

interface PhotoRecord {
  id: string;
  photoNumber: number;
  r2Url: string;
  damageTags: string[];
  zone: string | null;
  photoSection: string;
}

interface RawWalkthroughStep {
  findingRef?: string;
  observation?: string;
  question?: string;
  photoRef?: string | null;
}

interface Props {
  inspectionId: string;
  initialData?: Record<string, unknown>;
  reportUuid?: string;
  onDiagnosisReady: () => void;
}

interface SavedAnswers {
  steps?: Array<{ stepRef?: string; answer?: string }>;
  closingAnswer?: string | null;
}

interface DiagnosisWalkthrough {
  walkthroughSteps?: RawWalkthroughStep[];
  closingQuestion?: string;
}

type SlideState = "slideshow" | "analyzing" | "walkthrough" | "done";

const DEFAULT_CLOSING_QUESTION =
  "Based on everything you've seen today, what do you think the root issue might be?";

// Resolve a walkthrough step's photos by matching its zone ref against the loaded
// photos (mirrors the summary page's server-side resolver). Pure so it can run in a
// state initializer and inside the restore effect, not just in render.
function resolvePhotosFor(step: RawWalkthroughStep, photos: PhotoRecord[]): string[] {
  const ref = (step.photoRef || step.findingRef || "").toLowerCase().trim();
  if (!ref) return [];
  return photos
    .filter((p) => {
      const z = (p.zone ?? "").toLowerCase().trim();
      return z.length > 0 && (z.includes(ref) || ref.includes(z));
    })
    .slice(0, 3)
    .map((p) => p.r2Url);
}

// Build the (max 2) walkthrough steps the homeowner is led through, from the raw
// diagnosis output + the photos available to resolve each step's images.
function buildWalkthroughSteps(
  rawSteps: RawWalkthroughStep[],
  photos: PhotoRecord[],
): WalkthroughStep[] {
  return rawSteps
    .filter((s) => s && (s.observation || s.question))
    .slice(0, 2)
    .map((s) => ({
      findingRef: s.findingRef ?? "",
      observation: s.observation ?? "",
      question: s.question ?? "",
      photoRef: s.photoRef ?? null,
      photos: resolvePhotosFor(s, photos),
    }));
}

function LoadingAnimation() {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setDotCount((d) => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      {/* Pulsing logo mark */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full bg-brand-blue/10 animate-ping" />
        <div className="absolute w-20 h-20 rounded-full bg-brand-blue/20 animate-pulse" />
        <div className="w-16 h-16 rounded-2xl bg-brand-blue/30 backdrop-blur flex items-center justify-center shadow-lg shadow-brand-blue/20">
          <svg className="w-8 h-8 text-text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-text-primary text-xl font-semibold">
          Analyzing your roof{".".repeat(dotCount)}
        </p>
        <p className="text-text-secondary text-sm mt-2">
          Reviewing photo evidence and inspection data
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="w-full bg-bg-elevated rounded-full h-1">
          <div className="bg-brand-blue h-1 rounded-full animate-progress" />
        </div>
      </div>

      <p className="text-text-hint text-xs text-center max-w-xs">
        Claude is cross-referencing your photos, intake responses, and warning sign data to produce a personalized diagnosis.
      </p>
    </div>
  );
}

export default function Step3PhotoSlideshow({ inspectionId, initialData, reportUuid, onDiagnosisReady }: Props) {
  const initialPhotos = (initialData?.photos as PhotoRecord[] | undefined) ?? [];

  // FIX 4 — synchronous restore from the server snapshot. If a diagnosis was already
  // generated for this inspection (page was reloaded after generating), come up in
  // the completed walkthrough state, NOT the "Get Diagnosis" slideshow. The async
  // effect below covers the within-session back-navigation case (where initialData
  // predates the generation).
  const initialWalkthrough = initialData?.aiDiagnosisWalkthrough as DiagnosisWalkthrough | undefined;
  const initialRawSteps = initialWalkthrough?.walkthroughSteps ?? [];
  const initialHasDiagnosis =
    !!(initialData?.aiDiagnosisDescription as string | undefined) || initialRawSteps.length > 0;
  const canRestoreWalkthrough = initialRawSteps.length > 0 && !!reportUuid;

  const [photos, setPhotos] = useState<PhotoRecord[]>(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideState, setSlideState] = useState<SlideState>(
    canRestoreWalkthrough ? "walkthrough" : "slideshow",
  );
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [walkthroughSteps, setWalkthroughSteps] = useState<WalkthroughStep[]>(
    canRestoreWalkthrough ? buildWalkthroughSteps(initialRawSteps, initialPhotos) : [],
  );
  const [closingQuestion, setClosingQuestion] = useState<string>(
    initialWalkthrough?.closingQuestion?.trim() || DEFAULT_CLOSING_QUESTION,
  );
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswers | null>(
    (initialData?.homeownerWalkthroughAnswers as SavedAnswers | null) ?? null,
  );
  // A diagnosis already exists → never re-generate or re-prompt (FIX 4). Even when
  // there are no walkthrough steps to restore (legacy/no-UUID), the final slide
  // advances instead of re-running diagnosis.
  const [diagnosisExists, setDiagnosisExists] = useState(initialHasDiagnosis);

  // Fetch fresh inspection data on mount: captures any photos uploaded in Step 0 AND
  // restores an already-generated diagnosis on back-navigation (FIX 4 — the within-
  // session case, where initialData was loaded BEFORE the diagnosis was generated).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data) return;

        // Sort by zone then photoNumber
        const sorted: PhotoRecord[] = data.photos?.length
          ? (data.photos as PhotoRecord[]).sort((a, b) => {
              const zoneA = a.zone ?? "zzz";
              const zoneB = b.zone ?? "zzz";
              if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
              return a.photoNumber - b.photoNumber;
            })
          : [];
        if (sorted.length) setPhotos(sorted);

        // Restore an existing diagnosis instead of re-prompting "Get Diagnosis".
        const wt = data.aiDiagnosisWalkthrough as DiagnosisWalkthrough | null;
        const rawSteps = wt?.walkthroughSteps ?? [];
        const hasDiagnosis = !!data.aiDiagnosisDescription || rawSteps.length > 0;
        if (hasDiagnosis) setDiagnosisExists(true);

        if (rawSteps.length > 0 && reportUuid) {
          setWalkthroughSteps(buildWalkthroughSteps(rawSteps, sorted));
          setClosingQuestion(wt?.closingQuestion?.trim() || DEFAULT_CLOSING_QUESTION);
          setSavedAnswers((data.homeownerWalkthroughAnswers as SavedAnswers | null) ?? null);
          // Only force-restore from the initial slideshow; never yank the rep out of
          // an in-progress analysis or a walkthrough they're already viewing.
          setSlideState((s) => (s === "slideshow" ? "walkthrough" : s));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inspectionId, reportUuid]);

  const totalSlides = photos.length + 1; // photos + final "Get Diagnosis" slide

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, totalSlides - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  // Touch / swipe support
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext(); else goPrev();
    }
    setTouchStartX(null);
  };

  const runDiagnosis = useCallback(async () => {
    setSlideState("analyzing");
    setDiagnosisError(null);
    try {
      const res = await fetch(`/api/inspection/${inspectionId}/diagnose`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setDiagnosisError(data.error ?? "Diagnosis failed");
        setSlideState("done");
        // Still advance — Step 4 handles the fallback
        onDiagnosisReady();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        aiDiagnosisWalkthrough?: { walkthroughSteps?: RawWalkthroughStep[]; closingQuestion?: string };
      };

      const rawSteps = data.aiDiagnosisWalkthrough?.walkthroughSteps ?? [];
      const steps = buildWalkthroughSteps(rawSteps, photos);
      setDiagnosisExists(true);

      // Play the guided walkthrough as the continuation of the homeowner-facing
      // slideshow — live, rep-guided, answers captured. Needs the report UUID to
      // persist answers. If we have no steps (or no UUID), skip to the wizard.
      if (steps.length > 0 && reportUuid) {
        setWalkthroughSteps(steps);
        setClosingQuestion(data.aiDiagnosisWalkthrough?.closingQuestion?.trim() || DEFAULT_CLOSING_QUESTION);
        setSlideState("walkthrough");
        return;
      }

      setSlideState("done");
      onDiagnosisReady();
    } catch {
      setDiagnosisError("Diagnosis failed — you can continue and enter notes manually.");
      setSlideState("done");
      onDiagnosisReady();
    }
  }, [inspectionId, reportUuid, photos, onDiagnosisReady]);

  if (slideState === "analyzing") {
    return (
      <div className="flex flex-col" style={{ minHeight: "60vh" }}>
        <LoadingAnimation />
      </div>
    );
  }

  // ── Guided walkthrough — the back half of the homeowner slideshow ──────────
  // Homeowner-facing, rep-guided, live. Light "report" surface so it reads as
  // the homeowner's view (distinct from the dark rep wizard chrome). Answers are
  // captured to the report as the homeowner types.
  if (slideState === "walkthrough") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-text-primary text-2xl font-semibold">Let&apos;s Walk Through It</h2>
          <p className="text-text-secondary text-base mt-1">
            A few things stood out. Take them one at a time — tell us what you make of each.
          </p>
        </div>

        {/* Dark wizard chrome (FIX 2): the walkthrough reads as part of the dark
            inspection page, not a washed-out light card. Answers restore on
            back-navigation via initialAnswers (FIX 4). */}
        <div className="bg-bg-surface/40 border border-border rounded-2xl p-4 sm:p-5">
          <GuidedWalkthrough
            uuid={reportUuid!}
            steps={walkthroughSteps}
            closingQuestion={closingQuestion}
            initialAnswers={savedAnswers}
            theme="dark"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setSlideState("done");
            onDiagnosisReady();
          }}
          className="w-full bg-brand-blue hover:bg-accent-blue-hover text-text-primary rounded-2xl min-h-14 text-base font-semibold transition-all flex items-center justify-center gap-2"
        >
          Continue inspection →
        </button>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-text-primary text-2xl font-semibold">Photo Slideshow</h2>
          <p className="text-text-secondary text-base mt-1">No photos uploaded yet.</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-2xl p-6 text-center">
          <p className="text-text-secondary text-sm mb-4">
            Go back to Step 0 to upload photos before continuing.
          </p>
          <button
            type="button"
            onClick={diagnosisExists ? onDiagnosisReady : runDiagnosis}
            className="bg-brand-blue hover:bg-accent-blue-hover text-text-primary rounded-2xl px-8 min-h-14 text-base font-semibold transition-all"
          >
            {diagnosisExists ? "Continue →" : "Get Diagnosis Anyway →"}
          </button>
        </div>
      </div>
    );
  }

  const isLastSlide = currentIndex === totalSlides - 1;
  const currentPhoto = !isLastSlide ? photos[currentIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-2xl font-semibold">Photo Review</h2>
        <span className="text-text-hint text-sm">
          {isLastSlide ? "Final" : `${currentIndex + 1} / ${photos.length}`}
        </span>
      </div>

      {/* Slide container */}
      <div
        className="relative bg-bg-surface border border-border rounded-2xl overflow-hidden select-none"
        style={{ minHeight: "56vw", maxHeight: "70vh" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto.r2Url}
              alt={`Photo ${currentPhoto.photoNumber}`}
              className="w-full h-full object-cover"
              style={{ minHeight: "56vw", maxHeight: "70vh" }}
            />
            {/* Overlay badges */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              {currentPhoto.zone && (
                <p className="text-white text-sm font-semibold mb-1">{currentPhoto.zone}</p>
              )}
              <p className="text-white/60 text-xs capitalize mb-1">{currentPhoto.photoSection}</p>
              {currentPhoto.damageTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentPhoto.damageTags.map((t) => (
                    <span key={t} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Final slide — Get Diagnosis (or, if one already exists, resume it —
          // FIX 4: never re-generate/re-prompt when a diagnosis is on file).
          <div className="flex flex-col items-center justify-center gap-6 p-8 h-full" style={{ minHeight: "56vw" }}>
            <div className="text-center">
              <div className="text-5xl mb-4">🔬</div>
              <h3 className="text-text-primary text-xl font-bold mb-2">
                {diagnosisExists ? "Diagnosis Ready" : "Ready for Diagnosis"}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                {diagnosisExists
                  ? "This roof has already been diagnosed. Continue to review it — no need to run it again."
                  : `We've reviewed all ${photos.length} photo${photos.length !== 1 ? "s" : ""}. Tap the button below to generate your personalized roof diagnosis.`}
              </p>
            </div>
            {diagnosisError && (
              <p className="text-accent-red text-sm text-center">{diagnosisError}</p>
            )}
            <button
              type="button"
              onClick={diagnosisExists ? onDiagnosisReady : runDiagnosis}
              className="w-full max-w-xs bg-brand-blue hover:bg-accent-blue-hover text-text-primary rounded-2xl min-h-16 text-lg font-bold transition-all shadow-lg shadow-brand-blue/30 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {diagnosisExists ? "Continue →" : "Get Diagnosis"}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex-none w-12 h-12 flex items-center justify-center border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-30 transition-colors"
        >
          ←
        </button>

        {/* Dot indicators */}
        <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all ${
                i === currentIndex
                  ? "w-5 h-2 bg-text-accent"
                  : i === totalSlides - 1
                    ? "w-2 h-2 bg-brand-blue/60"
                    : "w-2 h-2 bg-border"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex === totalSlides - 1}
          className="flex-none w-12 h-12 flex items-center justify-center border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-30 transition-colors"
        >
          →
        </button>
      </div>

      <p className="text-text-hint text-xs text-center">Swipe left/right or use arrows to navigate</p>
    </div>
  );
}
