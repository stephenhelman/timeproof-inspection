"use client";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export default function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-13 py-1">
      {label && (
        <span className="text-text-primary text-base font-medium flex-1">{label}</span>
      )}
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-medium w-7 text-right ${value ? "text-text-accent" : "text-text-hint"}`}>
          {value ? "Yes" : "No"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-8 w-14.5 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-text-accent/40 ${
            value ? "bg-brand-blue" : "bg-bg-elevated"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
              value ? "translate-x-7.5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
