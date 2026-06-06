"use client";

import type { BulletsSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Slide } from "./components/Slide";
import { Header } from "./components/Header";
import { Eyebrow } from "./components/Eyebrow";
import { Headline } from "./components/Headline";
import { Intro } from "./components/Intro";
import { Bullets } from "./components/Bullets";

export function WhatTheyDontTellYouRenderer({
  slide,
  colorMode,
}: {
  slide: BulletsSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <Slide>
      <Eyebrow text={slide.eyebrow} color={C.textPrimary} />
      <Header text={slide.header} color={C.textHint} />
      <Headline text={slide.headline} color={C.textPrimary} />
      <Bullets items={slide.items} colorMode={colorMode} />
    </Slide>
  );
}
