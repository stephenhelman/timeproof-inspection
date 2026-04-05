"use client";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export default function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <div className="flex items-center gap-4 min-h-[48px]">
      {label && <span className="text-gray-300 text-base flex-1">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-9" : "translate-x-1"
          }`}
        />
        <span className="sr-only">{value ? "Yes" : "No"}</span>
      </button>
      <span className={`text-base font-medium w-8 ${value ? "text-blue-400" : "text-gray-500"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}
