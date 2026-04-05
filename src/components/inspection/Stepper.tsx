"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Step1CustomerInfo from "./steps/Step1CustomerInfo";
import Step2Discovery from "./steps/Step2Discovery";
import Step3Findings from "./steps/Step3Findings";
import Step4Photos from "./steps/Step4Photos";
import Step5Structures from "./steps/Step5Structures";
import Step6Quote from "./steps/Step6Quote";
import Step7ProductionNotes from "./steps/Step7ProductionNotes";
import Step8Review from "./steps/Step8Review";

const STEPS = [
  { id: "customer", label: "Customer", icon: "👤" },
  { id: "discovery", label: "Discovery", icon: "🔍" },
  { id: "findings", label: "Findings", icon: "📋" },
  { id: "photos", label: "Photos", icon: "📷" },
  { id: "structures", label: "Structures", icon: "🏠" },
  { id: "quote", label: "Quote", icon: "💰" },
  { id: "production", label: "Production", icon: "⚙️" },
  { id: "review", label: "Review", icon: "✅" },
];

const STEP_FIELDS: Record<number, string[]> = {
  0: ["customerName", "address", "phone", "email", "heardAboutUs", "repName"],
  1: ["ownershipLength", "previousRoofWork", "previousRoofWhen", "activeLeaks", "leakLocation", "allDecisionMakers", "priorities"],
  2: ["findings", "findingsNotes"],
  3: [],
  4: [],
  5: ["quote"],
  6: ["productionNotes", "gateCode", "hasPets", "accessIssues", "hoaRestrictions", "hoaDetails", "colorSelected", "specialRequests", "followUpNotes"],
  7: ["status"],
};

interface StepperProps {
  inspectionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>;
}

export default function Stepper({ inspectionId, initialData }: StepperProps) {
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
        if (field in initialData && initialData[field] !== null && initialData[field] !== undefined) {
          stepData[field] = initialData[field];
        }
      });
      if (Number(stepIndex) === 0 && initialData.customer) {
        stepData.customerName = initialData.customer.name;
        stepData.address = initialData.customer.address;
        stepData.phone = initialData.customer.phone ?? "";
        stepData.email = initialData.customer.email ?? "";
        stepData.heardAboutUs = initialData.customer.heardAboutUs ?? "";
      }
      if (Object.keys(stepData).length > 0) data[Number(stepIndex)] = stepData;
    });
    return data;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stepData, setStepData] = useState<Record<number, Record<string, any>>>(buildInitialStepData);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const initial = buildInitialStepData();
    return new Set(Object.keys(initial).map(Number).filter((k) => Object.keys(initial[k] || {}).length > 0));
  });

  const mergeStepData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (step: number, updates: Record<string, any>) => {
      setStepData((prev) => ({
        ...prev,
        [step]: { ...(prev[step] || {}), ...updates },
      }));
    },
    []
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

  const stepProps = {
    data: stepData[currentStep] || {},
    onChange: (updates: Record<string, unknown>) => mergeStepData(currentStep, updates),
    inspectionId,
    initialData,
  };

  const stepComponents = [
    <Step1CustomerInfo key={0} {...stepProps} />,
    <Step2Discovery key={1} {...stepProps} />,
    <Step3Findings key={2} {...stepProps} />,
    <Step4Photos key={3} {...stepProps} />,
    <Step5Structures key={4} {...stepProps} />,
    <Step6Quote key={5} {...stepProps} />,
    <Step7ProductionNotes key={6} {...stepProps} />,
    <Step8Review key={7} {...stepProps} reportUuid={initialData?.reportUuid} />,
  ];

  return (
    <div className="h-screen bg-bg-base flex overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? "w-56" : "w-16"} shrink-0 bg-bg-surface border-r border-border flex flex-col transition-all duration-200 ease-in-out`}
      >
        {/* Sidebar header / toggle */}
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

        {/* Step list */}
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
                    ? "bg-brand-blue text-text-primary shadow-md shadow-brand-navy/40"
                    : isCompleted
                    ? "bg-brand-navy/40 text-text-accent hover:bg-brand-navy/60 cursor-pointer"
                    : "text-text-hint cursor-default"
                }`}
              >
                <span className="text-base leading-none shrink-0 w-5 text-center">
                  {isCompleted && !isCurrent ? "✓" : step.icon}
                </span>
                {sidebarOpen && (
                  <span className="truncate">{step.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Save status at bottom of sidebar */}
        <div className="p-3 border-t border-border shrink-0 min-h-12 flex items-center">
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
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Step content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10">
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
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="flex-1 bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-navy/30"
              >
                {saving ? "Saving…" : "Next →"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 bg-success hover:bg-success/80 disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-success/30"
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
