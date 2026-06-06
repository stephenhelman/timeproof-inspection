"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import DispoModal from "./DispoModal";
import RescheduleWizard from "./RescheduleWizard";
import Step1CustomerInfo from "./steps/Step1CustomerInfo";
import Step2RoofPhotos from "./steps/Step2RoofPhotos";
import Step3AtticPhotos from "./steps/Step3AtticPhotos";
import Step4Diagnosis from "./steps/Step4Diagnosis";
import Step5IntakeForm from "./steps/Step5IntakeForm";
import Step6WarningSigns from "./steps/Step6WarningSigns";
import Step7ReviewShare from "./steps/Step7ReviewShare";

// PRESERVED — not active in Qntum build
// import Step2Discovery from "./steps/Step2Discovery";
// import Step3Findings from "./steps/Step3Findings";
// import Step4Photos from "./steps/Step4Photos";
// import Step5Structures from "./steps/Step5Structures";
// import Step6Quote from "./steps/Step6Quote";
// import Step7ProductionNotes from "./steps/Step7ProductionNotes";
// import Step8Review from "./steps/Step8Review";

const STEPS = [
  { id: "customer", label: "Customer", icon: "👤" },
  { id: "roof-photos", label: "Roof Photos", icon: "🏠" },
  { id: "attic-photos", label: "Attic Photos", icon: "🔦" },
  { id: "diagnosis", label: "Diagnosis", icon: "🔬" },
  { id: "intake", label: "Intake", icon: "📋" },
  { id: "warning-signs", label: "Warning Signs", icon: "⚠️" },
  { id: "review", label: "Review", icon: "✅" },
];

const STEP_FIELDS: Record<number, string[]> = {
  0: [
    "customerName",
    "address",
    "phone",
    "email",
    "repName",
    "setterName",
    "decisionMakers",
    "decisionMakersWho",
  ],
  1: [],
  2: [],
  3: ["diagnosis"],
  4: [
    "northStar",
    "focusDrivers",
    "timeInHome",
    "yearBuilt",
    "ageOfRoof",
    "lastReplacedBy",
    "pastRepairs",
    "otherProjects",
    "hoaPresent",
    "hoaName",
    "issuesConcerns",
    "issueDuration",
    "issueImpact",
    "rootCauseBeliefBefore",
    "triggerMoment",
    "priorMeetingHad",
    "priorMeetingWho",
    "priorMeetingRecommended",
    "priorMeetingWhyNotFixed",
    "noPriorMeetingReason",
    "winDefinition",
    "colorPreference",
    "personalFamily",
    "personalOccupation",
    "personalRecreation",
    "personalIdentity",
    "problemAwarenessBefore",
    "repNotes",
    "intakePass1Complete",
    "intakePass2Complete",
  ],
  5: ["warningSignsCovered"],
  6: ["status"],
};

interface StepperProps {
  inspectionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>;
  lead?: { id: string; customerName: string } | null;
  appointment?: { id: string; status: string } | null;
}

export default function Stepper({ inspectionId, initialData, lead, appointment }: StepperProps) {
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildInitialStepData = (): Record<number, Record<string, any>> => {
    if (!initialData) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<number, Record<string, any>> = {};
    Object.entries(STEP_FIELDS).forEach(([stepIndex, fields]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stepData: Record<string, any> = {};
      fields.forEach((field) => {
        if (
          field in initialData &&
          initialData[field] !== null &&
          initialData[field] !== undefined
        ) {
          stepData[field] = initialData[field];
        }
      });
      if (Object.keys(stepData).length > 0) data[Number(stepIndex)] = stepData;
    });
    return data;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stepData, setStepData] =
    useState<Record<number, Record<string, any>>>(buildInitialStepData);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [apptStatus, setApptStatus] = useState<string | null>(
    appointment?.status ?? null,
  );
  const [apptSaving, setApptSaving] = useState(false);
  const [apptError, setApptError] = useState<string | null>(null);

  const handleDispatch = async () => {
    if (!appointment) return;
    setApptSaving(true);
    setApptError(null);
    try {
      const res = await fetch(`/api/appointment/${appointment.id}/dispatch`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setApptError(d.error ?? "Dispatch failed.");
        return;
      }
      setApptStatus("EN_ROUTE");
    } catch {
      setApptError("Dispatch failed.");
    } finally {
      setApptSaving(false);
    }
  };

  const handleArrive = async () => {
    if (!appointment) return;
    setApptSaving(true);
    setApptError(null);
    try {
      const res = await fetch(`/api/appointment/${appointment.id}/arrive`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setApptError(d.error ?? "Arrive failed.");
        return;
      }
      setApptStatus("IN_PROGRESS");
    } catch {
      setApptError("Arrive failed.");
    } finally {
      setApptSaving(false);
    }
  };

  const [dispoOpen, setDispoOpen] = useState(false);
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(
    initialData?.leadId ?? initialData?.lead?.id ?? null,
  );
  const [creatingLead, setCreatingLead] = useState(false);
  const [dispoError, setDispoError] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const pendingRescheduleRef = useRef(false);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const initial = buildInitialStepData();
    return new Set(
      Object.keys(initial)
        .map(Number)
        .filter((k) => Object.keys(initial[k] || {}).length > 0),
    );
  });

  const mergeStepData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (step: number, updates: Record<string, any>) => {
      setStepData((prev) => ({
        ...prev,
        [step]: { ...(prev[step] || {}), ...updates },
      }));
    },
    [],
  );

  const getCurrentStepData = useCallback(() => {
    return stepData[currentStep] || {};
  }, [stepData, currentStep]);

  const handleSave = useCallback(async () => {
    const data = getCurrentStepData();
    if (Object.keys(data).length === 0) return;
    await fetch(`/api/inspection/${inspectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, [getCurrentStepData, inspectionId]);

  const handleNext = async () => {
    setSaving(true);
    try {
      await handleSave();
      setSaved(true);
      setCompletedSteps((prev) => new Set([...Array.from(prev), currentStep]));
      setTimeout(() => setSaved(false), 2000);
      setCurrentStep((s) => s + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => setCurrentStep((s) => s - 1);

  const handleComplete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/inspection/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const handleDispoOpen = async () => {
    if (resolvedLeadId) {
      setDispoOpen(true);
      return;
    }
    setCreatingLead(true);
    setDispoError(null);
    try {
      const res = await fetch(`/api/inspection/${inspectionId}/create-lead`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create lead");
      setResolvedLeadId(data.leadId);
      setDispoOpen(true);
    } catch (err) {
      setDispoError(
        err instanceof Error ? err.message : "Failed to create lead",
      );
    } finally {
      setCreatingLead(false);
    }
  };

  const stepProps = {
    data: stepData[currentStep] || {},
    onChange: (updates: Record<string, unknown>) =>
      mergeStepData(currentStep, updates),
    inspectionId,
    initialData,
  };

  const stepComponents = [
    <Step1CustomerInfo key={0} {...stepProps} />,
    <Step2RoofPhotos
      key={1}
      inspectionId={inspectionId}
      initialData={initialData}
    />,
    <Step3AtticPhotos
      key={2}
      inspectionId={inspectionId}
      initialData={initialData}
    />,
    <Step4Diagnosis
      key={3}
      inspectionId={inspectionId}
      initialData={initialData}
    />,
    <Step5IntakeForm
      key={4}
      inspectionId={inspectionId}
      initialData={initialData}
      onAdvanceToWarningSigns={() => {
        setCompletedSteps((prev) => new Set([...Array.from(prev), 4]));
        setCurrentStep(5);
      }}
    />,
    <Step6WarningSigns
      key={5}
      inspectionId={inspectionId}
      initialData={initialData}
      onReturnToIntake={() => setCurrentStep(4)}
    />,
    <Step7ReviewShare
      key={6}
      {...stepProps}
      reportUuid={initialData?.reportUuid}
    />,
  ];

  // Step 5 (IntakeForm) manages its own "Complete Pass 1" button that advances to step 6.
  // Step 6 (WarningSigns) has its own "Return to Intake" button.
  // The standard Next/Back buttons still work for free navigation.
  const hideNextButton = currentStep === 4; // IntakeForm handles its own advance

  return (
    <div className="h-dvh bg-bg-base flex overflow-hidden">
      {dispoOpen && resolvedLeadId && (
        <DispoModal
          leadId={resolvedLeadId}
          inspectionId={inspectionId}
          currentWizardStep={currentStep}
          onClose={() => setDispoOpen(false)}
          onReschedule={(reason) => {
            pendingRescheduleRef.current = true;
            setRescheduleReason(reason);
          }}
          onComplete={() => {
            setDispoOpen(false);
            if (pendingRescheduleRef.current) {
              pendingRescheduleRef.current = false;
              setRescheduleOpen(true);
            } else {
              router.push(`/leads/${resolvedLeadId}`);
            }
          }}
        />
      )}

      {rescheduleOpen && resolvedLeadId && (
        <RescheduleWizard
          leadId={resolvedLeadId}
          defaultReason={rescheduleReason}
          onClose={() => setRescheduleOpen(false)}
          onComplete={() => {
            setRescheduleOpen(false);
            router.push(`/leads/${resolvedLeadId}`);
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? "w-56" : "w-16"} shrink-0 bg-bg-surface border-r border-border flex flex-col transition-all duration-200 ease-in-out relative z-10`}
      >
        <div className="flex items-center justify-between h-16 px-3 border-b border-border shrink-0">
          {sidebarOpen && (
            <span className="text-text-secondary text-xs font-semibold uppercase tracking-wider pl-1">
              Steps
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
          {STEPS.map((step, i) => {
            const isCompleted = completedSteps.has(i);
            const isCurrent = i === currentStep;
            const isClickable = isCompleted && !isCurrent;

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isClickable && !isCurrent}
                onClick={() => isClickable && setCurrentStep(i)}
                title={!sidebarOpen ? step.label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all min-h-11 w-full text-left ${
                  isCurrent
                    ? "bg-brand-blue text-text-primary shadow-md"
                    : isCompleted
                      ? "bg-brand-navy/40 text-text-accent hover:bg-brand-navy/60 cursor-pointer"
                      : "text-text-hint cursor-default"
                }`}
              >
                <span className="text-base leading-none shrink-0 w-5 text-center">
                  {isCompleted && !isCurrent ? "✓" : step.icon}
                </span>
                {sidebarOpen && <span className="truncate">{step.label}</span>}
              </button>
            );
          })}
          {/* Dispatch / Arrive — shown above DISPO while appointment is pre-arrival */}
          {appointment && apptStatus === "SCHEDULED" && (
            <button
              type="button"
              onClick={handleDispatch}
              disabled={apptSaving}
              title={!sidebarOpen ? "Dispatch" : undefined}
              className={`flex items-center justify-center gap-2 mt-auto rounded-xl min-h-10 text-sm font-semibold transition-colors bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white ${
                sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
              }`}
            >
              {sidebarOpen ? (apptSaving ? "Sending…" : "DISPATCH →") : "→"}
            </button>
          )}
          {appointment && apptStatus === "EN_ROUTE" && (
            <button
              type="button"
              onClick={handleArrive}
              disabled={apptSaving}
              title={!sidebarOpen ? "Arrive" : undefined}
              className={`flex items-center justify-center gap-2 mt-auto rounded-xl min-h-10 text-sm font-semibold transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white ${
                sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
              }`}
            >
              {sidebarOpen ? (apptSaving ? "Saving…" : "ARRIVED ✓") : "✓"}
            </button>
          )}
          {apptError && sidebarOpen && (
            <p className="text-red-400 text-xs px-1 leading-snug">{apptError}</p>
          )}
          <button
            type="button"
            onClick={handleDispoOpen}
            disabled={creatingLead}
            title={!sidebarOpen ? "DISPO" : undefined}
            className={`flex items-center justify-center gap-2 ${appointment && (apptStatus === "SCHEDULED" || apptStatus === "EN_ROUTE") ? "" : "mt-auto"} rounded-xl min-h-10 text-sm font-semibold transition-colors bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary ${
              sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
            }`}
          >
            {sidebarOpen ? (creatingLead ? "Creating…" : "DISPO") : "D"}
          </button>
          {dispoError && sidebarOpen && (
            <p className="text-red-400 text-xs px-1 leading-snug">
              {dispoError}
            </p>
          )}
        </nav>

        <div className="p-3 border-t border-border shrink-0 flex flex-col gap-2">
          <div className="min-h-5 flex items-center">
            {saving && (
              <span className="flex items-center gap-2 text-text-secondary text-xs">
                <svg
                  className="w-3 h-3 animate-spin shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                {sidebarOpen && "Saving…"}
              </span>
            )}
            {saved && !saving && (
              <span className="flex items-center gap-2 text-success-text text-xs">
                <span>✓</span>
                {sidebarOpen && "Saved"}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await handleSave();
              } finally {
                setSaving(false);
                router.push("/dashboard");
              }
            }}
            title={!sidebarOpen ? "Save and Exit" : undefined}
            className={`flex items-center justify-center gap-2 rounded-xl min-h-10 text-sm font-medium transition-colors disabled:opacity-50 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover ${
              sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
            }`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {sidebarOpen && "Save & Exit"}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {lead && (
          <div className="shrink-0 bg-bg-surface/90 backdrop-blur border-b border-border px-6 py-2">
            <a
              href={`/leads/${lead.id}`}
              className="text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              ← Lead: {lead.customerName}
            </a>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-none">
          <div className="max-w-2xl mx-auto px-6 py-6">
            {stepComponents[currentStep]}
          </div>
        </div>

        {/* Navigation footer */}
        <div className="bg-bg-surface/80 backdrop-blur border-t border-border px-6 py-4 shrink-0">
          <div className="max-w-2xl mx-auto flex gap-4">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-2xl min-h-14 text-base font-medium transition-all flex items-center justify-center gap-2"
              >
                ← Back
              </button>
            )}
            {!hideNextButton && currentStep < STEPS.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {saving ? "Saving…" : "Next →"}
              </button>
            )}
            {currentStep === STEPS.length - 1 && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 bg-success hover:bg-success/80 disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {saving ? "Saving..." : "Complete Inspection ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
