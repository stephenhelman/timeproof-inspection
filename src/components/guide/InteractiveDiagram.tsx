"use client";

import { useState, useCallback, useEffect } from "react";

export interface DiagramZone {
  id: string;
  label: string;
  description: string;
  callout?: string | null;
  hotspot: {
    x: number;
    y: number;
    width: number;
    height: number;
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? null;

  const handleZoneClick = useCallback((id: string) => {
    setActiveZoneId((prev) => (prev === id ? null : id));
  }, []);

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

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          style={{ pointerEvents: "all" }}
        >
          {/* DEV NOTE: To visually debug hotspots, temporarily change
              fill="transparent" to fill="rgba(255,0,0,0.2)" on the rect below.
              This shows the tap zones overlaid on the image.
              Revert before deploying. */}
          {zones.map((zone, i) => (
            <g key={zone.id} onClick={() => handleZoneClick(zone.id)} style={{ cursor: "pointer" }}>
              <rect
                x={zone.hotspot.x}
                y={zone.hotspot.y}
                width={zone.hotspot.width}
                height={zone.hotspot.height}
                fill="transparent"
              />
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
              <circle
                cx={zone.hotspot.x + 2}
                cy={zone.hotspot.y + 2}
                r="2.2"
                fill={activeZoneId === zone.id ? "#F06B30" : "rgba(0,0,0,0.55)"}
              />
              {/* suppress unused var warning */}
              <title>{i}</title>
            </g>
          ))}
        </svg>
      </div>

      {/* Zone index buttons */}
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

      {/* Detail panel */}
      {activeZone && (
        <>
          {isMobile ? (
            /* Mobile: centered modal overlay */
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5"
              onClick={dismiss}
            >
              <div
                className="w-full max-w-sm bg-[#1a2744] border border-border rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <ZonePanel zone={activeZone} onDismiss={dismiss} />
              </div>
            </div>
          ) : (
            /* Desktop: inline card */
            <div className="mt-4 bg-bg-surface border border-border rounded-xl p-5">
              <ZonePanel zone={activeZone} onDismiss={dismiss} />
            </div>
          )}
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
