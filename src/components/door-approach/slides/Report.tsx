"use client";

import type { CtaSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

export function ReportRenderer({
  slide,
  colorMode,
}: {
  slide: CtaSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: C.textHint }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-3"
        style={{ color: C.textPrimary }}
      >
        {slide.headline}
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: C.textSecondary }}>
        {slide.intro}
      </p>

      {/* Report mockup card */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{ border: `1px solid ${C.border}` }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: "#0f1e3d" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qntum-logo.svg" alt="Qntum Roofing" style={{ height: 18, width: "auto" }} />
          <span className="text-xs font-semibold" style={{ color: "#8fa8bf" }}>
            Roof Inspection Report
          </span>
        </div>
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: C.border, background: C.bgSurface }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 rounded" style={{ background: C.bgElevated, width: "65%" }} />
              <div className="h-2 rounded" style={{ background: C.border, width: "45%" }} />
            </div>
            <div className="w-16 h-10 rounded" style={{ background: C.bgElevated }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 p-3" style={{ background: C.bgSurface }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded"
              style={{ aspectRatio: "4/3", background: C.bgElevated }}
            />
          ))}
        </div>
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: C.border, background: C.bgSurface }}
        >
          <div className="space-y-2">
            {[
              "Granule loss — high severity",
              "Ridge cap — moderate",
              "Attic ventilation — critical",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#F06B30" }} />
                <div className="h-2 rounded flex-1" style={{ background: C.bgElevated }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {slide.items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span
              className="shrink-0 text-sm font-bold mt-0.5"
              style={{ color: "#16a34a" }}
            >
              ✓
            </span>
            <p className="text-sm leading-relaxed" style={{ color: C.textSecondary }}>
              {item}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl px-5 py-4 text-center"
        style={{
          background: "rgba(240,107,48,0.08)",
          border: "1px solid rgba(240,107,48,0.25)",
        }}
      >
        <p className="text-[#F06B30] font-semibold text-base">{slide.ctaText}</p>
      </div>
    </div>
  );
}
