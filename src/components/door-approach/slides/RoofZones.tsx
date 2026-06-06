"use client";

import DoorApproachDiagram from "../DoorApproachDiagram";
import type { DiagramSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

export function DiagramRenderer({
  slide,
  colorMode,
}: {
  slide: DiagramSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  const imagePath = colorMode === "light"
    ? slide.imagePath
    : slide.imagePath.replace(".png", "-dark.png");

  return (
    <div className="px-5 py-8 max-w-3xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: C.textHint }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-xl sm:text-2xl font-bold mb-2"
        style={{ color: C.textPrimary }}
      >
        {slide.headline}
      </h2>
      <p
        className="text-sm leading-relaxed mb-6 max-w-xl"
        style={{ color: C.textSecondary }}
      >
        {slide.intro}
      </p>
      <DoorApproachDiagram
        imagePath={imagePath}
        imageAlt={slide.imageAlt}
        title={slide.diagramTitle}
        zones={slide.zones}
        colorMode={colorMode}
      />
    </div>
  );
}
