"use client";

import { useState, useEffect } from "react";
import Toggle from "@/src/components/ui/Toggle";
import Input from "@/src/components/ui/Input";
import { getColorsForPackage, detectPackageId } from "@/src/lib/packages";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>;
}

export default function Step7ProductionNotes({ data, onChange, inspectionId, initialData }: Props) {
  // Fetch live packages so we always reflect the latest Step 6 state
  const [packages, setPackages] = useState<Array<{ name: string; recommended: boolean }>>(
    (initialData?.packages as Array<{ name: string; recommended: boolean }>) || []
  );

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.packages) setPackages(d.packages); })
      .catch(() => {});
  }, [inspectionId]);

  const recommendedPkg = packages.find((p) => p.recommended);
  const configPackageId = recommendedPkg ? detectPackageId(recommendedPkg.name) : null;
  const colors = configPackageId ? getColorsForPackage(configPackageId) : [];
  const isStorm = configPackageId === "storm";

  const selectedColor = (data.colorSelected as string) || "";

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

        {/* Color picker */}
        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <label className="text-text-secondary text-sm font-medium">Color Selected</label>

          {!configPackageId && (
            <p className="text-text-hint text-sm">
              Select a package in Step 6 to see available colors.
            </p>
          )}

          {configPackageId && !isStorm && colors.length > 0 && (
            <>
              <p className="text-text-hint text-xs uppercase tracking-wider">
                Available Colors — {recommendedPkg?.name}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {(colors as Array<{ name: string; hex: string }>).map((color) => {
                  const isSelected = selectedColor === color.name;
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => onChange({ colorSelected: color.name })}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          isSelected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-bg-surface border-text-accent scale-110"
                            : "border-border hover:border-border-hover"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                      <span
                        className={`text-xs text-center leading-tight ${
                          isSelected ? "text-text-primary font-medium" : "text-text-hint"
                        }`}
                      >
                        {color.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedColor && (
                <p className="text-text-secondary text-sm">
                  Selected: <span className="text-text-primary font-medium">{selectedColor}</span>
                </p>
              )}
            </>
          )}

          {isStorm && (
            <>
              <p className="text-text-hint text-sm">
                Storm package colors depend on the associated package. Please note the color below.
              </p>
              <Input
                label=""
                placeholder="e.g. Charcoal"
                value={selectedColor}
                onChange={(e) => onChange({ colorSelected: e.target.value })}
              />
            </>
          )}
        </div>

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
