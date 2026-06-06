"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SlideData } from "./slides";
import { COLOR_CONFIG, type ColorMode } from "./colorConfig";
import { CoverRenderer } from "./slides/Cover";
import { TimelineRenderer } from "./slides/Timeline";
import { DiagramRenderer } from "./slides/RoofZones";
import { StatsRenderer } from "./slides/Stats";
import { OldVsNewRenderer } from "./slides/OldVsNew";
import { WhatTheyDontTellYouRenderer } from "./slides/WhatTheyDon'tTellYou";
import { ReportRenderer } from "./slides/Report";

interface Props {
  slides: SlideData[];
  repSlug: string | null;
  onClose: () => void;
}

export default function DoorApproachSlideshow({
  slides,
  repSlug,
  onClose,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const C = COLOR_CONFIG[colorMode];

  const goPrev = useCallback(() => {
    setCurrent((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrent((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0) goNext();
      else goPrev();
    }
  }

  function renderSlide(slide: SlideData) {
    switch (slide.type) {
      case "cover":
        return (
          <CoverRenderer
            slide={slide}
            repSlug={repSlug}
            colorMode={colorMode}
          />
        );
      case "timeline":
        return <TimelineRenderer slide={slide} colorMode={colorMode} />;
      case "diagram":
        return <DiagramRenderer slide={slide} colorMode={colorMode} />;
      case "stats":
        return <StatsRenderer slide={slide} colorMode={colorMode} />;
      case "comparison":
        return <OldVsNewRenderer slide={slide} colorMode={colorMode} />;
      case "bullets":
        return (
          <WhatTheyDontTellYouRenderer slide={slide} colorMode={colorMode} />
        );
      case "cta":
        return <ReportRenderer slide={slide} colorMode={colorMode} />;
    }
  }

  const slide = slides[current];

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col"
      style={{
        background: C.bgBase,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Dark navy header bar — always dark regardless of color mode */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          background: "#0B1220",
          height: 52,
          borderBottom: "3px solid #4a7fa5",
        }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit presentation"
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#8fa8bf" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sr_logo_light_transparent.svg"
            alt="Scope Reports"
            style={{ height: 13, width: "auto" }}
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              setColorMode((m) => (m === "light" ? "dark" : "light"))
            }
            aria-label={
              colorMode === "light"
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#8fa8bf" }}
          >
            {colorMode === "light" ? (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                />
              </svg>
            )}
          </button>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: "#4d6490" }}
          >
            {current + 1} / {slides.length}
          </span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto overscroll-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderSlide(slide)}
      </div>

      {/* Bottom dot indicator */}
      <div
        className="flex justify-center items-center gap-2 py-4 shrink-0"
        style={{
          background: colorMode === "light" ? "#E4EEF4" : "#0D1A32",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="rounded-full transition-all"
            style={
              i === current
                ? { width: 20, height: 8, background: "#F06B30" }
                : {
                    width: 8,
                    height: 8,
                    background: C.bgElevated,
                    border: `1px solid ${C.border}`,
                  }
            }
          />
        ))}
      </div>
    </div>
  );
}
