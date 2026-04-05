"use client";

import Toggle from "@/src/components/ui/Toggle";
import Input from "@/src/components/ui/Input";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

const OWNERSHIP_OPTIONS = ["Less than 1 year", "1–5 years", "5–10 years", "10+ years"];
const PRIORITY_CHIPS = ["Cost", "Durability", "Aesthetics", "Warranty", "Speed", "Financing"];

export default function Step2Discovery({ data, onChange }: Props) {
  const priorities = (data.priorities as string[]) || [];

  const togglePriority = (chip: string) => {
    const next = priorities.includes(chip)
      ? priorities.filter((p) => p !== chip)
      : [...priorities, chip];
    onChange({ priorities: next });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white text-2xl font-semibold">Discovery Questions</h2>
        <p className="text-gray-400 text-base mt-1">Learn about the homeowner&apos;s situation.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Ownership length */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">How long have you owned this home?</label>
          <select
            value={(data.ownershipLength as string) || ""}
            onChange={(e) => onChange({ ownershipLength: e.target.value })}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-blue-500"
          >
            <option value="">Select...</option>
            {OWNERSHIP_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Previous roof work */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
          <Toggle
            label="Previous roof work done?"
            value={!!(data.previousRoofWork)}
            onChange={(v) => onChange({ previousRoofWork: v })}
          />
          {!!(data.previousRoofWork) && (
            <Input
              label="When?"
              placeholder="e.g. 3 years ago"
              value={(data.previousRoofWhen as string) || ""}
              onChange={(e) => onChange({ previousRoofWhen: e.target.value })}
            />
          )}
        </div>

        {/* Active leaks */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
          <Toggle
            label="Currently experiencing leaks?"
            value={!!(data.activeLeaks)}
            onChange={(v) => onChange({ activeLeaks: v })}
          />
          {!!(data.activeLeaks) && (
            <Input
              label="Where?"
              placeholder="e.g. Master bedroom ceiling"
              value={(data.leakLocation as string) || ""}
              onChange={(e) => onChange({ leakLocation: e.target.value })}
            />
          )}
        </div>

        {/* Decision makers */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <Toggle
            label="All decision makers present today?"
            value={!!(data.allDecisionMakers)}
            onChange={(v) => onChange({ allDecisionMakers: v })}
          />
        </div>

        {/* Priorities */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm font-medium">What matters most? (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => togglePriority(chip)}
                className={`px-4 py-2.5 rounded-xl text-base font-medium transition-colors min-h-[44px] ${
                  priorities.includes(chip)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
