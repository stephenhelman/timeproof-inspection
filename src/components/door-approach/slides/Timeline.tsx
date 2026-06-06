"use client";

import type { TimelineSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Header } from "./components/Header";
import { Eyebrow } from "./components/Eyebrow";
import { Headline } from "./components/Headline";
import { Intro } from "./components/Intro";
import { TimelineTable } from "./components/TimelineTable";
import { Callout } from "./components/Callout";
import { Slide } from "./components/Slide";

export function TimelineRenderer({
  slide,
  colorMode,
}: {
  slide: TimelineSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <Slide>
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />
      <Intro text={slide.intro} color={C.textSecondary} />
      <TimelineTable
        colorMode={colorMode}
        keys={slide.keys}
        rows={slide.rows}
      />
      <Callout
        callout={slide.callout}
        backgroundColor={C.cardBackground}
        titleTextColor={C.cardTitle}
        subtextColor={C.subtitle}
        highlightColor={C.blue}
      />
    </Slide>
  );
}
