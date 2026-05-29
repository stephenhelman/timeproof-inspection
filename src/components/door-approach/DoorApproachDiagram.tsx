"use client";

import { useState, useCallback, useEffect } from "react";
import type { DiagramZone } from "@/src/components/guide/InteractiveDiagram";

interface Props {
  imagePath: string;
  imageAlt: string;
  zones: DiagramZone[];
  title: string;
}

export default function DoorApproachDiagram({
  imagePath,
  imageAlt,
  zones,
  title,
}: Props) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  // Touch devices (any pointer: coarse) always get the modal overlay.
  // Only mouse/trackpad (pointer: fine) get the inline expansion panel.
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setIsTouch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? null;

  const handleZoneClick = useCallback((id: string) => {
    setActiveZoneId((prev) => (prev === id ? null : id));
  }, []);

  const dismiss = useCallback(() => setActiveZoneId(null), []);

  return (
    <div className="relative w-full">
      <p
        className="text-xs font-bold tracking-[0.2em] uppercase mb-4"
        style={{ color: "#9ca3af" }}
      >
        {title}
      </p>

      {/* Image + SVG hotspot overlay */}
      <div
        className="relative w-full select-none"
        style={{ touchAction: "manipulation" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePath}
          alt={imageAlt}
          className="w-full rounded-xl"
          style={{ border: "1px solid #e5e7eb" }}
          draggable={false}
        />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          style={{ pointerEvents: "all" }}
        >
          {zones.map((zone, i) => (
            <g
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              style={{ cursor: "pointer" }}
            >
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
                cx={`${zone.hotspot.x + zone.hotspot.width / 2}%`}
                cy={`${zone.hotspot.y + zone.hotspot.height / 2}%`}
                r="3%"
                fill={
                  activeZone?.id === zone.id
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.55)"
                }
                strokeWidth="1.5"
                pointerEvents="none"
              />
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
            type="button"
            onClick={() => handleZoneClick(zone.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={
              activeZoneId === zone.id
                ? { background: "#F06B30", borderColor: "#F06B30", color: "#ffffff" }
                : { background: "#f1f3f4", borderColor: "#e5e7eb", color: "#6b7280" }
            }
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
          {isTouch ? (
            /* Touch device: centered modal overlay */
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-5"
              onClick={dismiss}
            >
              <div
                className="w-full max-w-sm rounded-2xl p-5"
                style={{ background: "#1a2744", border: "1px solid #1e3050" }}
                onClick={(e) => e.stopPropagation()}
              >
                <ZonePanel zone={activeZone} onDismiss={dismiss} dark />
              </div>
            </div>
          ) : (
            /* Mouse/desktop: inline card */
            <div
              className="mt-4 rounded-xl p-5"
              style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}
            >
              <ZonePanel zone={activeZone} onDismiss={dismiss} dark={false} />
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
  dark,
}: {
  zone: DiagramZone;
  onDismiss: () => void;
  dark: boolean;
}) {
  const labelColor = dark ? "#E4EEF4" : "#111827";
  const textColor = dark ? "#8fa8bf" : "#6b7280";
  const iconColor = dark ? "#8fa8bf" : "#9ca3af";

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-bold text-sm" style={{ color: labelColor }}>
          {zone.label}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
          style={{ color: iconColor }}
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: textColor }}>
        {zone.description}
      </p>
      {zone.callout && (
        <div className="mt-3 border-l-2 border-[#F06B30] pl-3">
          <p className="text-sm leading-relaxed" style={{ color: labelColor }}>
            {zone.callout}
          </p>
        </div>
      )}
    </div>
  );
}
