"use client";

import { useState, useEffect } from "react";
import { WARNING_SIGNS } from "@/src/lib/warning-signs";

const SECTION_LABELS = {
  "always-first": null,
  outside: "Outside",
  inside: "Inside",
  closer: null,
};

function WarningSignCard({ sign, isCovered, onToggle, isHighlighted }) {
  const [scriptOpen, setScriptOpen] = useState(false);

  return (
    <div className={`bg-bg-surface border rounded-2xl overflow-hidden transition-colors ${
      isHighlighted ? "border-accent-red/50" : "border-border"
    }`}>
      {/* Photo placeholder */}
      <div className="bg-bg-elevated h-32 flex items-center justify-center border-b border-border">
        <p className="text-text-hint text-sm text-center px-4">{sign.title}</p>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-text-primary font-semibold text-base">{sign.title}</h3>
          {isHighlighted && (
            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/20">
              Found in your inspection
            </span>
          )}
        </div>

        {/* Script toggle */}
        <button
          type="button"
          onClick={() => setScriptOpen((v) => !v)}
          className="text-text-secondary hover:text-text-primary text-sm text-left flex items-center gap-1.5 transition-colors"
        >
          {scriptOpen ? "▲ Hide Script" : "▼ Show Script"}
        </button>
        {scriptOpen && (
          <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
            <p className="text-text-primary text-sm leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
              {sign.script}
            </p>
            {sign.note && (
              <p className="text-text-secondary text-xs mt-3 italic border-t border-border pt-2">{sign.note}</p>
            )}
          </div>
        )}

        {/* Covered checkbox */}
        <label className="flex items-center gap-3 min-h-9 cursor-pointer">
          <input
            type="checkbox"
            checked={isCovered}
            onChange={(e) => onToggle(sign.id, e.target.checked)}
            className="w-5 h-5 rounded accent-brand-blue"
          />
          <span className={`text-sm font-medium ${isCovered ? "text-success-text" : "text-text-secondary"}`}>
            {isCovered ? "Covered with homeowner ✓" : "Mark as covered"}
          </span>
        </label>
      </div>
    </div>
  );
}

export default function Step6WarningSigns({ inspectionId, initialData, onReturnToIntake }) {
  const [covered, setCovered] = useState(
    Array.isArray(initialData?.warningSignsCovered) ? initialData.warningSignsCovered : []
  );
  const [allPhotosTagged, setAllPhotosTagged] = useState([]);

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((data) => {
        const tags = (data.photos || []).flatMap((p) => p.damageTags);
        setAllPhotosTagged(tags);
        if (Array.isArray(data.warningSignsCovered)) {
          setCovered(data.warningSignsCovered);
        }
      })
      .catch(() => {});
  }, [inspectionId]);

  const handleToggle = async (signId, checked) => {
    const next = checked
      ? [...new Set([...covered, signId])]
      : covered.filter((id) => id !== signId);
    setCovered(next);
    await fetch(`/api/inspection/${inspectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warningSignsCovered: next,
        warningSignResponses: { covered: next, updatedAt: new Date().toISOString() },
      }),
    });
  };

  const isHighlighted = (sign) =>
    [...sign.correlatedRoofTags, ...sign.correlatedAtticTags].some((t) =>
      allPhotosTagged.includes(t)
    );

  let lastSection = null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Warning Signs</h2>
        <p className="text-text-secondary text-base mt-1">
          Walk through each warning sign with the homeowner. Check off what you cover.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {WARNING_SIGNS.map((sign) => {
          const sectionLabel = SECTION_LABELS[sign.section];
          const showHeader = sectionLabel && sectionLabel !== lastSection;
          if (showHeader) lastSection = sectionLabel;

          return (
            <div key={sign.id}>
              {showHeader && (
                <div className="border-b border-border pb-1.5 mb-3">
                  <p className="text-text-hint text-xs uppercase tracking-widest font-semibold">{sectionLabel}</p>
                </div>
              )}
              <WarningSignCard
                sign={sign}
                isCovered={covered.includes(sign.id)}
                onToggle={handleToggle}
                isHighlighted={isHighlighted(sign)}
              />
            </div>
          );
        })}
      </div>

      <div className="bg-bg-elevated border border-border rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-text-secondary text-sm">
          Done reviewing warning signs? Use the <strong className="text-text-primary">Next</strong> button below to continue to the Photo Slideshow.
        </p>
      </div>
    </div>
  );
}
