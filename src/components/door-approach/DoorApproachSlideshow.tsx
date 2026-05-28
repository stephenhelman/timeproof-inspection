"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import InteractiveDiagram from "@/src/components/guide/InteractiveDiagram";
import type {
  SlideData,
  CoverSlide,
  TimelineSlide,
  DiagramSlide,
  StatsSlide,
  ComparisonSlide,
  BulletsSlide,
  CtaSlide,
} from "./slides";

interface Props {
  slides: SlideData[];
  repSlug: string | null;
  onClose: () => void;
}

// ─── Slide renderers ──────────────────────────────────────────────────────────

function CoverRenderer({
  slide,
  repSlug,
}: {
  slide: CoverSlide;
  repSlug: string | null;
}) {
  console.log(repSlug);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = repSlug
      ? `https://scopereports.com/roof-guide/?source=door&rep=${repSlug}`
      : `https://scopereports.com/roof-guide/?source=door`;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#0a0e1a", light: "#E4EEF4" },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [repSlug]);

  console.log(slide);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center gap-8">
      <div>
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-4">
          {slide.eyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight mb-4 max-w-sm mx-auto">
          {slide.headline}
        </h1>
        <p className="text-text-secondary text-base leading-relaxed max-w-xs mx-auto">
          {slide.sub}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="QR code — scan to get your personalized guide"
            className="w-48 h-48 rounded-xl border border-border"
          />
        ) : (
          <div className="w-48 h-48 rounded-xl bg-bg-elevated border border-border animate-pulse" />
        )}
        <p className="text-text-secondary text-sm">{slide.qrLabel}</p>
      </div>

      <div className="flex items-center gap-2 text-text-hint text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F06B30]" />
        Powered by Qntum Roofing
      </div>
    </div>
  );
}

function TimelineRenderer({ slide }: { slide: TimelineSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
        {slide.headline}
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed mb-6 max-w-xl">
        {slide.intro}
      </p>

      <div className="rounded-xl overflow-hidden border border-border">
        <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">
            Year
          </div>
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">
            Looks Like
          </div>
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">
            Happening Inside
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.years}
            className={`grid grid-cols-3 border-b border-border last:border-0 ${
              i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"
            }`}
          >
            <div className="px-4 py-3 text-sm font-semibold text-[#F06B30]">
              {row.years}
            </div>
            <div className="px-4 py-3 text-sm text-success-text">
              {row.visible}
            </div>
            <div className="px-4 py-3 text-sm text-error-text">
              {row.hidden}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-l-2 border-[#F06B30] pl-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          {slide.callout}
        </p>
      </div>
    </div>
  );
}

function DiagramRenderer({ slide }: { slide: DiagramSlide }) {
  return (
    <div className="px-5 py-8 max-w-3xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
        {slide.headline}
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed mb-6 max-w-xl">
        {slide.intro}
      </p>
      <InteractiveDiagram
        imagePath={slide.imagePath}
        imageAlt={slide.imageAlt}
        title={slide.diagramTitle}
        zones={slide.zones}
      />
    </div>
  );
}

function StatsRenderer({ slide }: { slide: StatsSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-8">
        {slide.headline}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {slide.stats.map(({ stat, body }) => (
          <div
            key={stat}
            className="border border-border bg-bg-surface rounded-xl p-5"
          >
            <p className="text-[#F06B30] text-sm font-bold mb-2">{stat}</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 border-l-2 border-[#F06B30] pl-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          {slide.callout}
        </p>
      </div>
    </div>
  );
}

function ComparisonRenderer({ slide }: { slide: ComparisonSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-8">
        {slide.headline}
      </h2>

      <div className="rounded-xl overflow-hidden border border-border">
        <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">
            {slide.cols[0]}
          </div>
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">
            {slide.cols[1]}
          </div>
          <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">
            {slide.cols[2]}
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.feature}
            className={`grid grid-cols-3 border-b border-border last:border-0 ${
              i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"
            }`}
          >
            <div className="px-4 py-3 text-sm font-semibold text-text-primary">
              {row.feature}
            </div>
            <div className="px-4 py-3 text-sm text-error-text">{row.old}</div>
            <div className="px-4 py-3 text-sm text-success-text">
              {row.current}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulletsRenderer({ slide }: { slide: BulletsSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-8">
        {slide.headline}
      </h2>

      <div className="space-y-4">
        {slide.items.map(({ title, body, question }) => (
          <div
            key={title}
            className="border border-border bg-bg-surface rounded-xl p-5"
          >
            <p className="text-text-primary font-semibold text-sm mb-2">
              {title}
            </p>
            <p className="text-text-secondary text-sm leading-relaxed mb-3">
              {body}
            </p>
            <p className="border-l-2 border-[#F06B30] pl-3 text-[#F06B30] text-sm italic leading-relaxed">
              {question}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaRenderer({ slide }: { slide: CtaSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
        {slide.eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
        {slide.headline}
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed mb-8">
        {slide.intro}
      </p>

      <div className="space-y-3 mb-10">
        {slide.items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="shrink-0 text-success-text font-bold text-sm mt-0.5">
              ✓
            </span>
            <p className="text-text-secondary text-sm leading-relaxed">
              {item}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-[#F06B30]/10 border border-[#F06B30]/30 rounded-xl px-5 py-4 text-center">
        <p className="text-[#F06B30] font-semibold text-base">
          {slide.ctaText}
        </p>
      </div>
    </div>
  );
}

// ─── Slideshow shell ──────────────────────────────────────────────────────────

export default function DoorApproachSlideshow({
  slides,
  repSlug,
  onClose,
}: Props) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const goPrev = useCallback(() => {
    setCurrent((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrent((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  // Keyboard navigation
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
    // Only trigger slide change on predominantly horizontal swipes
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0) goNext();
      else goPrev();
    }
  }

  function renderSlide(slide: SlideData) {
    switch (slide.type) {
      case "cover":
        return <CoverRenderer slide={slide} repSlug={repSlug} />;
      case "timeline":
        return <TimelineRenderer slide={slide} />;
      case "diagram":
        return <DiagramRenderer slide={slide} />;
      case "stats":
        return <StatsRenderer slide={slide} />;
      case "comparison":
        return <ComparisonRenderer slide={slide} />;
      case "bullets":
        return <BulletsRenderer slide={slide} />;
      case "cta":
        return <CtaRenderer slide={slide} />;
    }
  }

  const slide = slides[current];

  return (
    <div
      className="fixed inset-0 z-[60] bg-bg-base flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit presentation"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
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

        <p className="text-text-secondary text-xs font-semibold tracking-wider uppercase">
          {slide.label}
        </p>

        {/* Prev / Next tap targets on desktop */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={current === 0}
            aria-label="Previous slide"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-30"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={current === slides.length - 1}
            aria-label="Next slide"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-30"
          >
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div
        className="flex-1 overflow-y-auto overscroll-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        {renderSlide(slide)}
      </div>

      {/* Bottom dot indicator */}
      <div
        className="flex justify-center items-center gap-2 py-4 shrink-0 border-t border-border"
        style={{
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all ${
              i === current
                ? "w-5 h-2 bg-[#F06B30]"
                : "w-2 h-2 bg-bg-elevated border border-border hover:border-border-hover"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
