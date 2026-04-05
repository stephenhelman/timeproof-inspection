"use client";

import { useState, useEffect } from "react";
import { DAMAGE_GROUPS } from "@/src/lib/findings";
import Checkbox from "@/src/components/ui/Checkbox";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

export default function Step3Findings({ data, onChange, inspectionId }: Props) {
  const [findings, setFindings] = useState<Record<string, boolean>>(
    (data.findings as Record<string, boolean>) || {}
  );

  // Fetch latest findings on mount (may have been updated by photo tags)
  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((inspection) => {
        if (inspection?.findings) {
          setFindings(inspection.findings as Record<string, boolean>);
          onChange({ findings: inspection.findings });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  const toggleItem = (key: string) => {
    const next = { ...findings, [key]: !findings[key] };
    if (!next[key]) delete next[key];
    setFindings(next);
    onChange({ findings: next });
  };

  const checkedCount = Object.values(findings).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Inspection Findings</h2>
        <div className="mt-3 bg-brand-navy/30 border border-border rounded-xl p-4 text-text-accent text-sm">
          Findings are automatically updated as you tag photos in Step 4. Review and add anything you noticed that wasn&apos;t photographed.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-text-primary font-semibold text-lg">{checkedCount} issue{checkedCount !== 1 ? "s" : ""} documented</span>
      </div>

      <div className="flex flex-col gap-6">
        {DAMAGE_GROUPS.map((group) => (
          <div key={group.group} className="bg-bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
              {group.group}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5">
              {group.items.map((item) => (
                <Checkbox
                  key={item.key}
                  checked={!!findings[item.key]}
                  onChange={() => toggleItem(item.key)}
                  label={item.label}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-secondary text-sm font-medium">Additional findings notes</label>
        <textarea
          value={(data.findingsNotes as string) || ""}
          onChange={(e) => onChange({ findingsNotes: e.target.value })}
          placeholder="Anything else observed during inspection..."
          rows={4}
          className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
        />
      </div>
    </div>
  );
}
