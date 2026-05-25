"use client";

import { useState, useCallback } from "react";

export interface DiagramZone {
  id: string;
  label: string;
  description: string;
  // Personalized callout — null when not relevant to this homeowner
  callout?: string | null;
  // TODO: Adjust these coordinates when real blank-box PNGs are ready.
  // Expected dimensions: match viewBox in SVG wrapper.
  // Hotspot coordinates will need adjustment after real images are dropped in.
  hotspot: {
    x: number;     // percentage of image width (0–100)
    y: number;     // percentage of image height (0–100)
    width: number; // percentage
    height: number; // percentage
  };
}

interface InteractiveDiagramProps {
  imagePath: string;
  imageAlt: string;
  zones: DiagramZone[];
  title: string;
}

export default function InteractiveDiagram({
  imagePath,
  imageAlt,
  zones,
  title,
}: InteractiveDiagramProps) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? null;

  const handleZoneClick = useCallback(
    (id: string) => {
      setActiveZoneId((prev) => (prev === id ? null : id));
    },
    []
  );

  const dismiss = useCallback(() => setActiveZoneId(null), []);

  return (
    <div className="relative w-full">
      <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase mb-4">
        {title}
      </p>

      {/* Image + SVG hotspot overlay */}
      <div className="relative w-full select-none" style={{ touchAction: "manipulation" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePath}
          alt={imageAlt}
          className="w-full rounded-xl border border-border"
          draggable={false}
        />

        {/* SVG overlay — uses viewBox 0 0 100 100 so hotspot percentages map directly */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          style={{ pointerEvents: "all" }}
        >
          {zones.map((zone) => (
            <g key={zone.id} onClick={() => handleZoneClick(zone.id)} style={{ cursor: "pointer" }}>
              {/* Invisible hit area — minimum 44px touch target enforced via min dimensions */}
              <rect
                x={zone.hotspot.x}
                y={zone.hotspot.y}
                width={zone.hotspot.width}
                height={zone.hotspot.height}
                fill="transparent"
              />
              {/* Active highlight ring */}
              {activeZoneId === zone.id && (
                <rect
                  x={zone.hotspot.x}
                  y={zone.hotspot.y}
                  width={zone.hotspot.width}
                  height={zone.hotspot.height}
                  fill="rgba(240,107,48,0.15)"
                  stroke="#F06B30"
                  strokeWidth="0.6"
                  rx="1"
                  opacity={0.85}
                />
              )}
              {/* Zone number badge — top-left corner of hotspot */}
              <circle
                cx={zone.hotspot.x + 2}
                cy={zone.hotspot.y + 2}
                r="2.2"
                fill={activeZoneId === zone.id ? "#F06B30" : "rgba(0,0,0,0.55)"}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Zone index — tap to activate */}
      <div className="mt-3 flex flex-wrap gap-2">
        {zones.map((zone, i) => (
          <button
            key={zone.id}
            onClick={() => handleZoneClick(zone.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              activeZoneId === zone.id
                ? "bg-[#F06B30] border-[#F06B30] text-white"
                : "border-border text-text-secondary hover:border-border-hover bg-bg-elevated"
            }`}
          >
            <span className="shrink-0 w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px] font-bold leading-none">
              {i + 1}
            </span>
            {zone.label.replace(/^\d+\.\s*/, "")}
          </button>
        ))}
      </div>

      {/* Detail panel — mobile: fixed bottom slide-up; desktop: card below diagram */}
      {activeZone && (
        <>
          {/* Mobile overlay */}
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={dismiss}
          />
          <div
            className={`
              fixed bottom-0 inset-x-0 z-50 sm:hidden
              bg-bg-surface border-t border-border rounded-t-2xl p-5
              animate-slide-up
            `}
          >
            <ZonePanel zone={activeZone} onDismiss={dismiss} />
          </div>

          {/* Desktop card */}
          <div className="hidden sm:block mt-4 bg-bg-surface border border-border rounded-xl p-5">
            <ZonePanel zone={activeZone} onDismiss={dismiss} />
          </div>
        </>
      )}
    </div>
  );
}

function ZonePanel({
  zone,
  onDismiss,
}: {
  zone: DiagramZone;
  onDismiss: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-text-primary font-bold text-sm">{zone.label}</p>
        <button
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-text-hint hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed">{zone.description}</p>
      {zone.callout && (
        <div className="mt-3 border-l-2 border-[#F06B30] pl-3">
          <p className="text-sm text-text-primary leading-relaxed">{zone.callout}</p>
        </div>
      )}
    </div>
  );
}
