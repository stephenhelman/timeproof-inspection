"use client";

import type { StatsSlide } from "../slides";
import { Header } from "./components/Header";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

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
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <Header text={slide.header} color={C.textHint} />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {slide.stats.map(({ stat, body }) => (
          <div
            key={stat}
            className="rounded-xl p-5"
            style={{ background: C.bgSurface, border: `1px solid ${C.border}` }}
          >
            <p className="text-[#F06B30] text-sm font-bold mb-2">{stat}</p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: C.textSecondary }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lifespanChart}
          alt="Bar chart: Shingle lifespan — rated vs El Paso actual vs Qntum 50yr"
          className="w-full rounded-xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tempChart}
          alt="Line chart: Roof surface temperature by month — El Paso vs national average"
          className="w-full rounded-xl"
        />
      </div>

      <div className="border-l-2 border-[#F06B30] pl-4">
        <p
          className="text-sm leading-relaxed"
          style={{ color: C.textSecondary }}
        >
          {slide.callout}
        </p>
      </div>
    </div>
  );
}
