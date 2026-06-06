"use client";

import type { ComparisonSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Eyebrow } from "./components/Eyebrow";
import { Header } from "./components/Header";
import { Headline } from "./components/Headline";
import { GapTable } from "./components/GapTable";
import { Slide } from "./components/Slide";

export function OldVsNewRenderer({
  slide,
  colorMode,
}: {
  slide: ComparisonSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <Slide>
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/old-tech.png"
            alt="Standard 3-tab shingle — old technology"
            className="w-full rounded-xl"
          />
          <p className="text-xs mt-1.5 text-center" style={{ color: C.red }}>
            3-Tab (Old Standard)
          </p>
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/new-tech.png"
            alt="Architectural dimensional shingle — current standard"
            className="w-full rounded-xl"
          />
          <p className="text-xs mt-1.5 text-center" style={{ color: C.green }}>
            Architectural / Impact-Resistant (Current)
          </p>
        </div>
      </div>

      <GapTable colorMode={colorMode} keys={slide.cols} rows={slide.rows} />
    </Slide>
  );
}
