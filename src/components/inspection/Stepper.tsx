"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StepIndicator from "./StepIndicator";
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
  3: [], // Photos managed independently via API
  4: [], // Structures managed independently via API
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

  // Initialize step data from initialData
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
      // Customer fields come from nested customer object
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

  // Mark steps with data as completed
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

  const handleBack = () => {
    setCurrentStep((s) => s - 1);
  };

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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Save status — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 h-8 flex items-center">
        {saving && (
          <span className="text-gray-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Saving...
          </span>
        )}
        {saved && !saving && (
          <span className="text-green-400 text-sm">Saved ✓</span>
        )}
      </div>

      {/* Header with step indicator */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={setCurrentStep}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {stepComponents[currentStep]}
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 border border-gray-700 text-gray-300 hover:text-white rounded-xl min-h-14 text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              ← Back
            </button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl min-h-14 text-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? "Saving..." : "Next →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl min-h-14 text-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? "Saving..." : "Complete Inspection ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
