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
    <div className="flex items-center gap-1 w-full overflow-x-auto pb-1">
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0 min-h-[44px] ${
              isCompleted
                ? "bg-blue-900 text-blue-300 cursor-pointer"
                : isCurrent
                ? "bg-transparent border-2 border-blue-500 text-blue-400"
                : "bg-gray-800 text-gray-500 cursor-default"
            }`}
          >
            <span className="text-base">
              {isCompleted ? "✓" : step.icon}
            </span>
            <span className={`hidden sm:inline ${isCurrent ? "inline" : ""}`}>
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
