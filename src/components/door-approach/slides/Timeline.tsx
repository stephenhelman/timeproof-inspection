"use client";

import type { TimelineSlide } from "../slides";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";
import { Header } from "./components/Header";
import { Eyebrow } from "./components/Eyebrow";
import { Headline } from "./components/Headline";
import { Intro } from "./components/Intro";
import { TimelineTable } from "./components/TimelineTable";
import { Callout } from "./components/Callout";

function PhotoPlaceholder({
  label,
  caption,
  accent = false,
  colorMode,
}: {
  label: string;
  caption?: string;
  accent?: boolean;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.border}` }}
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{
            aspectRatio: "16/9",
            background: accent ? "#fff7ed" : C.bgElevated,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 mb-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: accent ? "#F06B30" : C.borderHover }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M21 7.5H3M12 3v.01"
            />
          </svg>
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: accent ? "#F06B30" : C.textHint }}
          >
            {label}
          </p>
        </div>
      </div>
      {caption && (
        <p className="text-xs mt-1.5 text-center" style={{ color: C.textHint }}>
          {caption}
        </p>
      )}
    </div>
  );
}

export function TimelineRenderer({
  slide,
  colorMode,
}: {
  slide: TimelineSlide;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  const tableConfig = {
    keys: slide.keys,
    rows: slide.rows,
    colors: {
      border: C.border,
      bgElevated: C.bgElevated,
    },
  };
  return (
    <div className="px-5 py-4 max-w-180 mx-auto w-full min-h-full flex flex-col">
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
    </div>
  );
}
