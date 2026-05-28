"use client";

interface Props {
  onSelect: (type: "shingle") => void;
  onClose: () => void;
}

const OPTIONS = [
  {
    id: "shingle" as const,
    label: "Shingle",
    available: true,
  },
  {
    id: "flat" as const,
    label: "Flat",
    available: false,
  },
  {
    id: "both" as const,
    label: "Both",
    available: false,
  },
];

export default function TypeSelectorModal({ onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg-base border border-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase mb-1">
              Door Approach
            </p>
            <h2 className="text-text-primary font-semibold text-lg">
              What type of roof?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) =>
            opt.available ? (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id as "shingle")}
                className="flex items-center justify-between w-full px-4 py-4 rounded-xl border border-border bg-bg-elevated hover:border-border-hover hover:bg-bg-base text-left transition-all active:scale-[0.98]"
              >
                <span className="text-text-primary font-semibold">
                  {opt.label}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <div
                key={opt.id}
                className="flex items-center justify-between w-full px-4 py-4 rounded-xl border border-border bg-bg-elevated opacity-40 cursor-not-allowed"
              >
                <span className="text-text-secondary font-semibold">
                  {opt.label}
                </span>
                <span className="text-xs font-medium text-text-hint bg-bg-base border border-border rounded-full px-2.5 py-1">
                  Coming Soon
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
