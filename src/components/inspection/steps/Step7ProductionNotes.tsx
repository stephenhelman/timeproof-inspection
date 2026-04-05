"use client";

import Input from "@/src/components/ui/Input";
import Toggle from "@/src/components/ui/Toggle";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

export default function Step7ProductionNotes({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white text-2xl font-semibold">Production Notes</h2>
        <p className="text-gray-400 text-base mt-1">Details the crew will need on install day.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Gate Code"
          placeholder="e.g. #1234"
          value={(data.gateCode as string) || ""}
          onChange={(e) => onChange({ gateCode: e.target.value })}
        />

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <Toggle
            label="Pets on property?"
            value={!!(data.hasPets)}
            onChange={(v) => onChange({ hasPets: v })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Access Issues</label>
          <textarea
            value={(data.accessIssues as string) || ""}
            onChange={(e) => onChange({ accessIssues: e.target.value })}
            placeholder="e.g. Narrow gate on south side..."
            rows={3}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
          <Toggle
            label="HOA restrictions?"
            value={!!(data.hoaRestrictions)}
            onChange={(v) => onChange({ hoaRestrictions: v })}
          />
          {!!(data.hoaRestrictions) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-300 text-sm font-medium">HOA Details</label>
              <textarea
                value={(data.hoaDetails as string) || ""}
                onChange={(e) => onChange({ hoaDetails: e.target.value })}
                placeholder="Approved colors, permit requirements..."
                rows={3}
                className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        <Input
          label="Color Selected"
          placeholder="e.g. Charcoal"
          value={(data.colorSelected as string) || ""}
          onChange={(e) => onChange({ colorSelected: e.target.value })}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Special Requests</label>
          <textarea
            value={(data.specialRequests as string) || ""}
            onChange={(e) => onChange({ specialRequests: e.target.value })}
            placeholder="Any special instructions for the crew..."
            rows={3}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Follow-up Notes <span className="text-gray-500 font-normal">(internal only)</span></label>
          <textarea
            value={(data.followUpNotes as string) || ""}
            onChange={(e) => onChange({ followUpNotes: e.target.value })}
            placeholder="Internal notes, next steps..."
            rows={3}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
