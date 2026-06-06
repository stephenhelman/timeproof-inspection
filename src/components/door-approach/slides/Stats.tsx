"use client";

import type { StatsSlide } from "../slides";
import { Header } from "./components/Header";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Eyebrow } from "./components/Eyebrow";
import { Headline } from "./components/Headline";
import { Callout } from "./components/Callout";
import { StatRow } from "./components/StatRow";
import { DiagramHeader } from "./components/DiagramHeader";

export function StatsRenderer({
  slide,
  colorMode,
}: {
  slide: StatsSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  const lifespanChart =
    colorMode === "light"
      ? "/door-approach/chart-shingle-lifespan.png"
      : "/door-approach/chart-shingle-lifespan-dark.png";
  const tempChart =
    colorMode === "light"
      ? "/door-approach/chart-roof-temp.png"
      : "/door-approach/chart-roof-temp-dark.png";

  return (
    <div className="px-5 py-4 max-w-180 mx-auto w-full min-h-full flex flex-col">
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />

      <StatRow
        stats={slide.stats}
        cardColor={C.cardBackground}
        subtextColor={C.cardSubtitle}
        titleColor={C.cardTitle}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="mt-4">
        <div
          style={{ backgroundColor: C.cardBackground }}
          className=" px-6 py-2 rounded-t-lg"
        >
          <p style={{ color: C.textPrimary }}>
            Shingle lifespan - rated vs actual El Paso performance
          </p>
          <p style={{ color: C.textPrimary }}>
            El Paso's UV index and heat cycling reduce standard shingle lifespan
            significantly
          </p>
        </div>
        <img
          src={lifespanChart}
          alt="Bar chart: Shingle lifespan — rated vs El Paso actual vs Qntum 50yr"
          className="w-full rounded-b-lg"
          style={{ border: `2px solid ${C.cardBackground}` }}
        />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}

      <div className="my-auto">
        <Callout
          callout={slide.callout}
          highlightColor={C.blue}
          backgroundColor={C.cardBackground}
          titleTextColor={C.cardTitle}
          subtextColor={C.cardSubtitle}
        />
      </div>
      <div className="mb-4">
        <div
          style={{ backgroundColor: C.cardBackground }}
          className=" px-6 py-2 rounded-t-lg"
        >
          <p style={{ color: C.textPrimary }}>
            Roof surface temperature by month
          </p>
          <p style={{ color: C.textPrimary }}>
            El Paso vs. national average — shingles expand and contract with
            every cycle
          </p>
        </div>
        <img
          src={tempChart}
          alt="Line chart: Roof surface temperature by month — El Paso vs national average"
          className="w-full rounded-b-lg"
          style={{ border: `2px solid ${C.cardBackground}` }}
        />
      </div>
    </div>
  );
}
