"use client";

import DoorApproachDiagram from "../DoorApproachDiagram";
import type { DiagramSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Eyebrow } from "./components/Eyebrow";
import { Header } from "./components/Header";
import { Headline } from "./components/Headline";
import { Intro } from "./components/Intro";
import { Slide } from "./components/Slide";

export function DiagramRenderer({
  slide,
  colorMode,
}: {
  slide: DiagramSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  const imagePath =
    colorMode === "light"
      ? slide.imagePath
      : slide.imagePath.replace(".png", "-dark.png");

  return (
    <Slide>
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />
      <Intro text={slide.intro} color={C.textSecondary} />
      <DoorApproachDiagram
        imagePath={imagePath}
        imageAlt={slide.imageAlt}
        title={slide.diagramTitle}
        zones={slide.zones}
        colorMode={colorMode}
      />
    </Slide>
  );
}
