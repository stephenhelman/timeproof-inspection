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
        <h2 className="text-white text-2xl font-semibold">Inspection Findings</h2>
        <div className="mt-3 bg-blue-950 border border-blue-800 rounded-xl p-4 text-blue-300 text-sm">
          Findings are automatically updated as you tag photos in Step 4. Review and add anything you noticed that wasn&apos;t photographed.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-white font-semibold text-lg">{checkedCount} issue{checkedCount !== 1 ? "s" : ""} documented</span>
      </div>

      <div className="flex flex-col gap-6">
        {DAMAGE_GROUPS.map((group) => (
          <div key={group.group} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wider mb-3">
              {group.group}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
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
        <label className="text-gray-300 text-sm font-medium">Additional findings notes</label>
        <textarea
          value={(data.findingsNotes as string) || ""}
          onChange={(e) => onChange({ findingsNotes: e.target.value })}
          placeholder="Anything else observed during inspection..."
          rows={4}
          className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
