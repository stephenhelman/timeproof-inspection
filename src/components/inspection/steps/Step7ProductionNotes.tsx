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
        <h2 className="text-text-primary text-2xl font-semibold">Production Notes</h2>
        <p className="text-text-secondary text-base mt-1">Details the crew will need on install day.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Gate Code"
          placeholder="e.g. #1234"
          value={(data.gateCode as string) || ""}
          onChange={(e) => onChange({ gateCode: e.target.value })}
        />

        <div className="bg-bg-surface border border-border rounded-2xl p-4">
          <Toggle
            label="Pets on property?"
            value={!!(data.hasPets)}
            onChange={(v) => onChange({ hasPets: v })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Access Issues</label>
          <textarea
            value={(data.accessIssues as string) || ""}
            onChange={(e) => onChange({ accessIssues: e.target.value })}
            placeholder="e.g. Narrow gate on south side..."
            rows={3}
            className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
          />
        </div>

        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <Toggle
            label="HOA restrictions?"
            value={!!(data.hoaRestrictions)}
            onChange={(v) => onChange({ hoaRestrictions: v })}
          />
          {!!(data.hoaRestrictions) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">HOA Details</label>
              <textarea
                value={(data.hoaDetails as string) || ""}
                onChange={(e) => onChange({ hoaDetails: e.target.value })}
                placeholder="Approved colors, permit requirements..."
                rows={3}
                className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
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
          <label className="text-text-secondary text-sm font-medium">Special Requests</label>
          <textarea
            value={(data.specialRequests as string) || ""}
            onChange={(e) => onChange({ specialRequests: e.target.value })}
            placeholder="Any special instructions for the crew..."
            rows={3}
            className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Follow-up Notes <span className="text-text-hint font-normal">(internal only)</span></label>
          <textarea
            value={(data.followUpNotes as string) || ""}
            onChange={(e) => onChange({ followUpNotes: e.target.value })}
            placeholder="Internal notes, next steps..."
            rows={3}
            className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
