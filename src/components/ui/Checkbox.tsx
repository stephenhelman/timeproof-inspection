"use client";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export default function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 min-h-[48px] cursor-pointer select-none group">
      <div
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          checked
            ? "bg-brand-blue border-brand-blue shadow-sm shadow-brand-navy/50"
            : "bg-bg-input border-border group-hover:border-border-hover"
        }`}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span className={`text-base leading-snug transition-colors ${checked ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}>
        {label}
      </span>
    </label>
  );
}
