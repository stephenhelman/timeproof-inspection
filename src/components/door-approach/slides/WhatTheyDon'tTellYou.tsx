"use client";

import type { BulletsSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

export function WhatTheyDontTellYouRenderer({
  slide,
  colorMode,
}: {
  slide: BulletsSlide;
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
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: C.textPrimary }}
      >
        {slide.headline}
      </h2>

      <div className="space-y-4">
        {slide.items.map(({ title, body, question }, idx) => (
          <div
            key={title}
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            <div className="flex items-start gap-4 p-5 pb-4">
              <span
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#0f1e3d", color: "#ffffff" }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm mb-2"
                  style={{ color: C.textPrimary }}
                >
                  {title}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: C.textSecondary }}
                >
                  {body}
                </p>
              </div>
            </div>
            <div className="px-5 py-3" style={{ background: "#0f1e3d" }}>
              <p
                className="text-sm italic leading-relaxed"
                style={{ color: "#E4EEF4" }}
              >
                &ldquo;{question}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
