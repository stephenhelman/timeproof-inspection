"use client";

import { useState, useCallback, useEffect } from "react";
import type { DiagramZone } from "@/src/components/guide/InteractiveDiagram";
import { COLOR_CONFIG, type ColorMode } from "./colorConfig";

interface Props {
  imagePath: string;
  imageAlt: string;
  zones: DiagramZone[];
  title: string;
  colorMode: ColorMode;
}

export default function DoorApproachDiagram({
  imagePath,
  imageAlt,
  zones,
  title,
  colorMode,
}: Props) {
  const C = COLOR_CONFIG[colorMode];
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
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
        style={{ color: C.textHint }}
      >
        {title}
      </p>

      <div
        className="relative w-full select-none"
        style={{ touchAction: "manipulation" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePath}
          alt={imageAlt}
          className="w-full rounded-xl"
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
                  fill={C.cardBackground}
                  stroke={C.cardTitle}
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
                ? {
                    background: C.cardBackground,
                    borderColor: C.cardTitle,
                    color: C.subtitle,
                  }
                : {
                    background: C.bgSurface,
                    borderColor: C.border,
                    color: C.textSecondary,
                  }
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
            <div
              className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 px-5"
              onClick={dismiss}
            >
              <div
                className="w-full max-w-sm rounded-2xl p-5"
                style={{
                  background: C.cardBackground,
                  border: `1px solid ${C.border}`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ZonePanel
                  zone={activeZone}
                  onDismiss={dismiss}
                  colorMode={colorMode}
                />
              </div>
            </div>
          ) : (
            <div
              className="mt-4 rounded-xl p-5"
              style={{
                background: C.bgSurface,
                border: `1px solid ${C.border}`,
              }}
            >
              <ZonePanel
                zone={activeZone}
                onDismiss={dismiss}
                colorMode={colorMode}
              />
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
  colorMode,
}: {
  zone: DiagramZone;
  onDismiss: () => void;
  colorMode: "light" | "dark";
}) {
  const C = COLOR_CONFIG[colorMode];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-bold text-sm" style={{ color: C.cardTitle }}>
          {zone.label}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
          style={{ color: C.textPrimary }}
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
      <p className="text-sm leading-relaxed" style={{ color: C.cardSubtitle }}>
        {zone.description}
      </p>
      {zone.callout && (
        <div
          className="mt-3 border-l-2 pl-3"
          style={{ borderColor: C.cardTitle }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: C.cardSubtitle }}
          >
            {zone.callout}
          </p>
        </div>
      )}
    </div>
  );
}
