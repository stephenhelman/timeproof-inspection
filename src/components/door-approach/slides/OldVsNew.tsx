"use client";

import type { ComparisonSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

export function OldVsNewRenderer({
  slide,
  colorMode,
}: {
  slide: ComparisonSlide;
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
        className="text-2xl sm:text-3xl font-bold mb-6"
        style={{ color: C.textPrimary }}
      >
        {slide.headline}
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/door-approach/shingle-old.png"
            alt="Standard 3-tab shingle — old technology"
            className="w-full rounded-xl"
          />
          <p className="text-xs mt-1.5 text-center" style={{ color: C.textHint }}>
            Old technology
          </p>
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/door-approach/shingle-new.png"
            alt="Architectural dimensional shingle — current standard"
            className="w-full rounded-xl"
          />
          <p className="text-xs mt-1.5 text-center" style={{ color: C.textHint }}>
            Current standard
          </p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div
          className="grid grid-cols-3 border-b"
          style={{ background: C.bgElevated, borderColor: C.border }}
        >
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: C.textHint }}
          >
            {slide.cols[0]}
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#dc2626" }}
          >
            {slide.cols[1]}
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#16a34a" }}
          >
            {slide.cols[2]}
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.feature}
            className="grid grid-cols-3 border-b last:border-0"
            style={{
              borderColor: C.border,
              background: i % 2 === 0 ? C.bgBase : C.bgSurface,
            }}
          >
            <div
              className="px-4 py-3 text-sm font-semibold"
              style={{ color: C.textPrimary }}
            >
              {row.feature}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#dc2626" }}>
              {row.old}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#16a34a" }}>
              {row.current}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
