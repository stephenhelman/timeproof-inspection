"use client";

import type { CtaSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Slide } from "./components/Slide";
import { ReportSkeleton } from "./components/ReportSkeleton";
import { Header } from "./components/Header";
import { Eyebrow } from "./components/Eyebrow";
import { Headline } from "./components/Headline";
import { Intro } from "./components/Intro";

export function ReportRenderer({
  slide,
  colorMode,
}: {
  slide: CtaSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <Slide>
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />
      <Intro text={slide.intro} color={C.textSecondary} />

      {/* Report mockup card */}
      <ReportSkeleton colorMode={colorMode} />

      <div className="space-y-3 mb-8">
        {slide.items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span
              className="shrink-0 text-sm font-bold mt-0.5"
              style={{ color: C.green }}
            >
              ✓
            </span>
            <p
              className="text-sm leading-relaxed"
              style={{ color: C.textPrimary }}
            >
              {item}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl px-5 py-4 text-center"
        style={{
          background: C.cardBackground,
          opacity: "80%",
        }}
      >
        <p className="font-semibold text-base" style={{ color: C.cardTitle }}>
          {slide.ctaText}
        </p>
      </div>
    </Slide>
  );
}
