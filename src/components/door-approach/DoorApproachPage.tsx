"use client";

import { useState } from "react";
import { Presentation } from "lucide-react";
import DoorApproachSlideshow from "./DoorApproachSlideshow";
import { SHINGLE_SLIDES } from "./slides";

const OPTIONS = [
  { id: "shingle" as const, label: "Shingle", available: true },
  { id: "flat" as const, label: "Flat", available: false },
  { id: "both" as const, label: "Both", available: false },
];

interface Props {
  repSlug: string | null;
}

export default function DoorApproachPage({ repSlug }: Props) {
  const [roofType, setRoofType] = useState<"shingle" | null>(null);

  if (roofType === "shingle") {
    return (
      <DoorApproachSlideshow
        slides={SHINGLE_SLIDES}
        repSlug={repSlug}
        onClose={() => setRoofType(null)}
      />
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "#0a0e1a" }}
    >
      <div className="w-full max-w-sm">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <Presentation size={15} strokeWidth={1.75} style={{ color: "#4d6490" }} />
          <p
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: "#4d6490" }}
          >
            Door Approach
          </p>
        </div>

        <h2
          className="font-semibold text-xl mb-6"
          style={{ color: "#E4EEF4" }}
        >
          What type of roof?
        </h2>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) =>
            opt.available ? (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRoofType(opt.id as "shingle")}
                className="flex items-center justify-between w-full px-4 py-4 rounded-xl border border-border bg-bg-elevated hover:border-border-hover hover:bg-bg-base text-left transition-all active:scale-[0.98]"
              >
                <span
                  className="font-semibold"
                  style={{ color: "#E4EEF4" }}
                >
                  {opt.label}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  style={{ color: "#8fa8bf" }}
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
                <span
                  className="font-semibold"
                  style={{ color: "#8fa8bf" }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-xs font-medium rounded-full px-2.5 py-1"
                  style={{
                    color: "#4d6490",
                    background: "#0a0e1a",
                    border: "1px solid #1e3050",
                  }}
                >
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
