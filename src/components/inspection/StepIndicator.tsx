"use client";

interface Step {
  id: string;
  label: string;
  icon: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (index: number) => void;
}

export default function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-0.5 no-scrollbar">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.has(i);
        const isCurrent = i === currentStep;
        const isClickable = isCompleted && i !== currentStep;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!isClickable && !isCurrent}
            onClick={() => isClickable && onStepClick(i)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 min-h-12 ${
              isCompleted
                ? "bg-brand-navy/60 text-text-accent border border-border cursor-pointer hover:bg-brand-navy"
                : isCurrent
                ? "bg-brand-blue text-text-primary shadow-lg shadow-brand-navy/40"
                : "bg-bg-elevated/80 text-text-hint cursor-default border border-border"
            }`}
          >
            <span className="text-base leading-none">
              {isCompleted ? "✓" : step.icon}
            </span>
            <span className={isCurrent ? "inline" : "hidden lg:inline"}>
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
