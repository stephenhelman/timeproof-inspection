"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import DispoModal from "./DispoModal";
import TasksPanel from "@/src/components/tasks/TasksPanel";
import ReportVisitPanel from "./ReportVisitPanel";
import Step0Photos from "./steps/Step0Photos";
import Step1IntakeForm from "./steps/Step5IntakeForm";
import Step2WarningSigns from "./steps/Step6WarningSigns";
import Step3PhotoSlideshow from "./steps/Step3PhotoSlideshow";
import Step4AIDiagnosis from "./steps/Step4AIDiagnosis";
import Step5IntakePass2 from "./steps/Step5IntakePass2";
import Step6ReviewShare from "./steps/Step7ReviewShare";

// PRESERVED — not active in Qntum build
// import Step1CustomerInfo from "./steps/Step1CustomerInfo";
// import Step2Discovery from "./steps/Step2Discovery";
// import Step3Findings from "./steps/Step3Findings";
// import Step4Photos from "./steps/Step4Photos";
// import Step5Structures from "./steps/Step5Structures";
// import Step6Quote from "./steps/Step6Quote";
// import Step7ProductionNotes from "./steps/Step7ProductionNotes";
// import Step8Review from "./steps/Step8Review";

const STEPS = [
  { id: "photos", label: "Photos", icon: "📷" },
  { id: "intake", label: "Intake", icon: "📋" },
  { id: "warning-signs", label: "Warning Signs", icon: "⚠️" },
  { id: "slideshow", label: "Slideshow", icon: "🖼" },
  { id: "diagnosis", label: "Diagnosis", icon: "🔬" },
  { id: "intake-pass-2", label: "Pass 2", icon: "✍️" },
  { id: "review", label: "Review", icon: "✅" },
];

// Step 6 (Review & Share) uses shared stepData; all other steps manage their own saves.
const STEP_FIELDS: Record<number, string[]> = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: ["status"],
};

interface StepperProps {
  inspectionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>;
  lead?: { id: string; customerName: string; streetAddress?: string | null; city?: string | null } | null;
  appointment?: { id: string; status: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportVisits?: any[];
}

export default function Stepper({ inspectionId, initialData, lead, appointment, reportVisits: reportVisitsProp }: StepperProps) {
  const reportVisits = reportVisitsProp ?? (initialData?.reportVisits as unknown[]) ?? [];
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
  const isComplete = initialData?.status === "complete";
  const [currentStep, setCurrentStep] = useState(isComplete ? 6 : 0);
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

  // Tasks drawer state
  const [tasksOpen, setTasksOpen] = useState(false);

  // Analytics drawer state
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Escalate state
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateNotes, setEscalateNotes] = useState("");
  const [escalateSaving, setEscalateSaving] = useState(false);
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [escalateDone, setEscalateDone] = useState(false);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    if (initialData?.status === "complete") {
      return new Set([0, 1, 2, 3, 4, 5, 6]);
    }
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
      setCompletedSteps(new Set([0, 1, 2, 3, 4, 5, 6]));
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

  const handleEscalate = async () => {
    if (!resolvedLeadId) return;
    setEscalateSaving(true);
    setEscalateError(null);
    try {
      const res = await fetch(`/api/inspection/${inspectionId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: escalateNotes }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Escalation failed");
      setEscalateDone(true);
      setTimeout(() => {
        setEscalateOpen(false);
        setEscalateDone(false);
        setEscalateNotes("");
      }, 2000);
    } catch (err) {
      setEscalateError(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setEscalateSaving(false);
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
    // Step 0 — Photos (roof + attic, single + bulk upload)
    <Step0Photos key={0} inspectionId={inspectionId} initialData={initialData} />,

    // Step 1 — Intake Pass 1 (NEPQ intake, ~25 fields, writes to intakePass1 JSON)
    <Step1IntakeForm
      key={1}
      inspectionId={inspectionId}
      initialData={initialData}
      onAdvanceToWarningSigns={() => {
        setCompletedSteps((prev) => new Set([...Array.from(prev), 1]));
        setCurrentStep(2);
      }}
    />,

    // Step 2 — Warning Signs checklist
    <Step2WarningSigns
      key={2}
      inspectionId={inspectionId}
      initialData={initialData}
      onReturnToIntake={() => setCurrentStep(1)}
    />,

    // Step 3 — Photo Slideshow + Get Diagnosis
    <Step3PhotoSlideshow
      key={3}
      inspectionId={inspectionId}
      initialData={initialData}
      onDiagnosisReady={() => {
        setCompletedSteps((prev) => new Set([...Array.from(prev), 3]));
        setCurrentStep(4);
      }}
    />,

    // Step 4 — AI Diagnosis (Claude output)
    <Step4AIDiagnosis key={4} inspectionId={inspectionId} initialData={initialData} />,

    // Step 5 — Intake Pass 2 (read-only Pass 1 + postDiagnosisAdmission)
    <Step5IntakePass2 key={5} inspectionId={inspectionId} initialData={initialData} />,

    // Step 6 — Review & Share
    <Step6ReviewShare
      key={6}
      {...stepProps}
      reportUuid={initialData?.reportUuid as string | undefined}
    />,
  ];

  // Step 1 (Intake) manages its own advance button.
  // Step 3 (Slideshow) manages its own advance (triggers after diagnosis ready).
  const hideNextButton = currentStep === 1 || currentStep === 3;

  const leadAddress = lead
    ? [lead.streetAddress, lead.city].filter(Boolean).join(", ")
    : undefined;

  return (
    <div className="h-dvh bg-bg-base flex overflow-hidden">
      {dispoOpen && resolvedLeadId && (
        <DispoModal
          leadId={resolvedLeadId}
          leadName={lead?.customerName}
          leadAddress={leadAddress}
          inspectionId={inspectionId}
          appointmentId={appointment?.id ?? null}
          currentWizardStep={currentStep}
          onClose={() => setDispoOpen(false)}
          onComplete={() => {
            setDispoOpen(false);
            router.push(`/leads/${resolvedLeadId}`);
          }}
        />
      )}

      {/* ── Tasks drawer ── */}
      {tasksOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-text-primary font-semibold text-sm">Inspection Tasks</h3>
              <button
                type="button"
                onClick={() => setTasksOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <TasksPanel inspectionId={inspectionId} />
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics drawer ── */}
      {analyticsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-text-primary font-semibold text-sm">Report Visit Analytics</h3>
              <button
                type="button"
                onClick={() => setAnalyticsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <ReportVisitPanel visits={reportVisits as Parameters<typeof ReportVisitPanel>[0]["visits"]} />
            </div>
          </div>
        </div>
      )}

      {/* ── Escalate modal ── */}
      {escalateOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-text-primary font-semibold">Escalate</h3>
              <button
                type="button"
                onClick={() => { setEscalateOpen(false); setEscalateError(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>

            {escalateDone ? (
              <p className="text-success-text text-sm font-semibold text-center py-2">Escalated ✓</p>
            ) : (
              <>
                <p className="text-text-secondary text-sm">
                  Flag for manager review. Does not change appointment or bot status.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Notes</label>
                  <textarea
                    value={escalateNotes}
                    onChange={(e) => setEscalateNotes(e.target.value)}
                    rows={3}
                    placeholder="What needs manager attention?"
                    className="bg-bg-elevated border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:border-brand-blue resize-none"
                  />
                </div>
                {escalateError && (
                  <p className="text-accent-red text-xs">{escalateError}</p>
                )}
                <button
                  type="button"
                  onClick={handleEscalate}
                  disabled={escalateSaving}
                  className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                >
                  {escalateSaving ? "Escalating…" : "Confirm Escalation"}
                </button>
              </>
            )}
          </div>
        </div>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
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

          {/* DISPO button */}
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
            <p className="text-red-400 text-xs px-1 leading-snug">{dispoError}</p>
          )}

          {/* Tasks button */}
          <button
            type="button"
            onClick={() => setTasksOpen(true)}
            title={!sidebarOpen ? "Tasks" : undefined}
            className={`flex items-center justify-center gap-2 rounded-xl min-h-10 text-sm font-medium transition-colors bg-bg-elevated hover:bg-bg-elevated/80 border border-border text-text-secondary hover:text-text-primary ${
              sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
            }`}
          >
            {sidebarOpen ? "Tasks" : "T"}
          </button>

          {/* Analytics button — report visit pre-appointment intel */}
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            title={!sidebarOpen ? "Visit Analytics" : undefined}
            className={`flex items-center justify-center gap-2 rounded-xl min-h-10 text-sm font-medium transition-colors bg-bg-elevated hover:bg-bg-elevated/80 border border-border text-text-secondary hover:text-text-primary ${
              sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
            }`}
          >
            {sidebarOpen ? "Analytics" : "📊"}
          </button>

          {/* Escalate button — below Analytics, always visible */}
          <button
            type="button"
            onClick={() => { setEscalateOpen(true); setEscalateError(null); }}
            title={!sidebarOpen ? "Escalate" : undefined}
            className={`flex items-center justify-center gap-2 rounded-xl min-h-10 text-sm font-semibold transition-colors bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600/40 text-rose-400 ${
              sidebarOpen ? "w-full px-3" : "w-10 mx-auto"
            }`}
          >
            {sidebarOpen ? "Escalate" : "!"}
          </button>
        </nav>

        <div className="p-3 border-t border-border shrink-0 flex flex-col gap-2">
          <div className="min-h-5 flex items-center">
            {saving && (
              <span className="flex items-center gap-2 text-text-secondary text-xs">
                <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
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
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
