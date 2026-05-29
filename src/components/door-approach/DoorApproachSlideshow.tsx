"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import DoorApproachDiagram from "./DoorApproachDiagram";
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

// Light-mode CSS variable overrides — scoped to the slide content area only.
// The slideshow forces white backgrounds and dark text regardless of the app's dark theme.
const LIGHT_VARS: React.CSSProperties = {
  "--color-bg-base": "#ffffff",
  "--color-bg-surface": "#f8f9fa",
  "--color-bg-elevated": "#f1f3f4",
  "--color-border": "#e5e7eb",
  "--color-border-hover": "#d1d5db",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#6b7280",
  "--color-text-hint": "#9ca3af",
  "--color-success-text": "#16a34a",
  "--color-error-text": "#dc2626",
  backgroundColor: "#ffffff",
} as React.CSSProperties;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function PhotoPlaceholder({
  label,
  caption,
  accent = false,
}: {
  label: string;
  caption?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{
            aspectRatio: "16/9",
            background: accent ? "#fff7ed" : "#f1f3f4",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 mb-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: accent ? "#F06B30" : "#d1d5db" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M21 7.5H3M12 3v.01"
            />
          </svg>
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: accent ? "#F06B30" : "#9ca3af" }}
          >
            {label}
          </p>
        </div>
      </div>
      {caption && (
        <p className="text-xs mt-1.5 text-center" style={{ color: "#9ca3af" }}>
          {caption}
        </p>
      )}
    </div>
  );
}

// ─── Slide renderers ──────────────────────────────────────────────────────────

function CoverRenderer({
  slide,
  repSlug,
}: {
  slide: CoverSlide;
  repSlug: string | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = repSlug
      ? `https://scopereports.com/roof-guide/?source=door&rep=${repSlug}`
      : `https://scopereports.com/roof-guide/?source=door`;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [repSlug]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-8 py-10 text-center gap-6"
      style={{ background: "#ffffff" }}
    >
      {/* SR wordmark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sr_logo_dark_transparent.svg"
        alt="Scope Reports"
        style={{ height: 44, width: "auto" }}
      />

      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{ background: "#0f1e3d" }}
      >
        <p
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: "#8fa8bf" }}
        >
          Powered by
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qntum-logo.svg"
          alt="Qntum Roofing"
          style={{ height: 18, width: "auto" }}
        />
      </div>

      {/* Headline */}
      <div>
        <h1
          className="text-3xl sm:text-4xl font-bold leading-tight"
          style={{ color: "#111827", lineHeight: 1.15 }}
        >
          EL PASO&apos;S
          <br />
          <span style={{ color: "#F06B30" }}>PERSONALIZED</span>
          <br />
          ROOF HEALTH GUIDE
        </h1>
      </div>

      {/* Divider */}
      <div className="w-12 h-px" style={{ background: "#e5e7eb" }} />

      {/* Sub */}
      <p
        className="text-sm leading-relaxed max-w-xs"
        style={{ color: "#6b7280" }}
      >
        {slide.sub}
      </p>

      {/* Powered by badge */}

      {/* QR code */}
      <div className="flex flex-col items-center gap-2">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Scan to get your personalized guide"
            className="w-44 h-44 rounded-xl"
            style={{ border: "1px solid #e5e7eb" }}
          />
        ) : (
          <div
            className="w-44 h-44 rounded-xl animate-pulse"
            style={{ background: "#f1f3f4", border: "1px solid #e5e7eb" }}
          />
        )}
        <p className="text-xs" style={{ color: "#9ca3af" }}>
          {slide.qrLabel}
        </p>
      </div>
    </div>
  );
}

function TimelineRenderer({ slide }: { slide: TimelineSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-4"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>
      <p
        className="text-sm leading-relaxed mb-6 max-w-xl"
        style={{ color: "#6b7280" }}
      >
        {slide.intro}
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div
          className="grid grid-cols-3 border-b"
          style={{ background: "#f1f3f4", borderColor: "#e5e7eb" }}
        >
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#9ca3af" }}
          >
            Year
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#16a34a" }}
          >
            Looks Like
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#dc2626" }}
          >
            Happening Inside
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.years}
            className="grid grid-cols-3 border-b last:border-0"
            style={{
              borderColor: "#e5e7eb",
              background: i % 2 === 0 ? "#ffffff" : "#f8f9fa",
            }}
          >
            <div
              className="px-4 py-3 text-sm font-semibold"
              style={{ color: "#F06B30" }}
            >
              {row.years}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#16a34a" }}>
              {row.visible}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#dc2626" }}>
              {row.hidden}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-l-2 border-[#F06B30] pl-4">
        <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
          {slide.callout}
        </p>
      </div>

      {/* Before / After photo placeholders */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <PhotoPlaceholder
          label="Before"
          caption="Year 10 — looks fine from street"
        />
        <PhotoPlaceholder
          label="After inspection"
          caption="Same roof — decking compromise found"
          accent
        />
      </div>
    </div>
  );
}

function DiagramRenderer({ slide }: { slide: DiagramSlide }) {
  return (
    <div className="px-5 py-8 max-w-3xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-xl sm:text-2xl font-bold mb-2"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>
      <p
        className="text-sm leading-relaxed mb-6 max-w-xl"
        style={{ color: "#6b7280" }}
      >
        {slide.intro}
      </p>
      <DoorApproachDiagram
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
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {slide.stats.map(({ stat, body }) => (
          <div
            key={stat}
            className="rounded-xl p-5"
            style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}
          >
            <p className="text-[#F06B30] text-sm font-bold mb-2">{stat}</p>
            <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      {/* Charts — exported from Figma, placed at /public/door-approach/ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/door-approach/chart-shingle-lifespan.png"
          alt="Bar chart: Shingle lifespan — rated vs El Paso actual vs Qntum 50yr"
          className="w-full rounded-xl"
          style={{ border: "1px solid #e5e7eb" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/door-approach/chart-roof-temp.png"
          alt="Line chart: Roof surface temperature by month — El Paso vs national average"
          className="w-full rounded-xl"
          style={{ border: "1px solid #e5e7eb" }}
        />
      </div>

      <div className="border-l-2 border-[#F06B30] pl-4">
        <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
          {slide.callout}
        </p>
      </div>
    </div>
  );
}

function ComparisonRenderer({ slide }: { slide: ComparisonSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-6"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>

      {/* Shingle comparison photos — exported from Figma, placed at /public/door-approach/ */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/door-approach/shingle-old.png"
            alt="Standard 3-tab shingle — old technology"
            className="w-full rounded-xl"
            style={{ border: "1px solid #e5e7eb" }}
          />
          <p
            className="text-xs mt-1.5 text-center"
            style={{ color: "#9ca3af" }}
          >
            Old technology
          </p>
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/door-approach/shingle-new.png"
            alt="Architectural dimensional shingle — current standard"
            className="w-full rounded-xl"
            style={{ border: "1px solid #e5e7eb" }}
          />
          <p
            className="text-xs mt-1.5 text-center"
            style={{ color: "#9ca3af" }}
          >
            Current standard
          </p>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div
          className="grid grid-cols-3 border-b"
          style={{ background: "#f1f3f4", borderColor: "#e5e7eb" }}
        >
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#9ca3af" }}
          >
            {slide.cols[0]}
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#dc2626" }}
          >
            {slide.cols[1]}
          </div>
          <div
            className="px-4 py-3 text-xs font-bold tracking-wider uppercase"
            style={{ color: "#16a34a" }}
          >
            {slide.cols[2]}
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.feature}
            className="grid grid-cols-3 border-b last:border-0"
            style={{
              borderColor: "#e5e7eb",
              background: i % 2 === 0 ? "#ffffff" : "#f8f9fa",
            }}
          >
            <div
              className="px-4 py-3 text-sm font-semibold"
              style={{ color: "#111827" }}
            >
              {row.feature}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#dc2626" }}>
              {row.old}
            </div>
            <div className="px-4 py-3 text-sm" style={{ color: "#16a34a" }}>
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
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>

      <div className="space-y-4">
        {slide.items.map(({ title, body, question }, idx) => (
          <div
            key={title}
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-start gap-4 p-5 pb-4">
              {/* Number badge */}
              <span
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#0f1e3d", color: "#ffffff" }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm mb-2"
                  style={{ color: "#111827" }}
                >
                  {title}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#6b7280" }}
                >
                  {body}
                </p>
              </div>
            </div>
            {/* NEPQ question callout bar */}
            <div className="px-5 py-3" style={{ background: "#0f1e3d" }}>
              <p
                className="text-sm italic leading-relaxed"
                style={{ color: "#E4EEF4" }}
              >
                &ldquo;{question}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaRenderer({ slide }: { slide: CtaSlide }) {
  return (
    <div className="px-5 py-8 max-w-2xl mx-auto w-full">
      <p
        className="text-xs font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color: "#9ca3af" }}
      >
        {slide.eyebrow}
      </p>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-3"
        style={{ color: "#111827" }}
      >
        {slide.headline}
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: "#6b7280" }}>
        {slide.intro}
      </p>

      {/* Report mockup card */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{ border: "1px solid #e5e7eb" }}
      >
        {/* Report header strip */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: "#0f1e3d" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qntum-logo.svg"
            alt="Qntum Roofing"
            style={{ height: 18, width: "auto" }}
          />
          <span className="text-xs font-semibold" style={{ color: "#8fa8bf" }}>
            Roof Inspection Report
          </span>
        </div>
        {/* Customer info row */}
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: "#e5e7eb", background: "#f8f9fa" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <div
                className="h-2.5 rounded"
                style={{ background: "#e5e7eb", width: "65%" }}
              />
              <div
                className="h-2 rounded"
                style={{ background: "#f1f3f4", width: "45%" }}
              />
            </div>
            <div
              className="w-16 h-10 rounded"
              style={{ background: "#e5e7eb" }}
            />
          </div>
        </div>
        {/* Photo grid placeholder */}
        <div
          className="grid grid-cols-3 gap-1 p-3"
          style={{ background: "#f8f9fa" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded"
              style={{ aspectRatio: "4/3", background: "#e5e7eb" }}
            />
          ))}
        </div>
        {/* Issues panel */}
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "#e5e7eb", background: "#f8f9fa" }}
        >
          <div className="space-y-2">
            {[
              "Granule loss — high severity",
              "Ridge cap — moderate",
              "Attic ventilation — critical",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: "#F06B30" }}
                />
                <div
                  className="h-2 rounded flex-1"
                  style={{ background: "#e5e7eb" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-3 mb-8">
        {slide.items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span
              className="shrink-0 text-sm font-bold mt-0.5"
              style={{ color: "#16a34a" }}
            >
              ✓
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
              {item}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl px-5 py-4 text-center"
        style={{
          background: "rgba(240,107,48,0.08)",
          border: "1px solid rgba(240,107,48,0.25)",
        }}
      >
        <p className="text-[#F06B30] font-semibold text-base">
          {slide.ctaText}
        </p>
      </div>
    </div>
  );
}

// ─── Slideshow shell ──────────────────────────────────────────────────────────

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
  const [lightMode, setLightMode] = useState(true);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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
      className="fixed inset-0 z-60 flex flex-col"
      style={{
        background: lightMode ? "#ffffff" : "#0a0e1a",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Dark navy header bar — SR logo (left) · page count (right) */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{ background: "#0f1e3d", height: 52 }}
      >
        {/* Left: close + SR logo */}
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
            style={{ height: 22, width: "auto" }}
          />
        </div>

        {/* Right: light/dark toggle + page count */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setLightMode((m) => !m)}
            aria-label={
              lightMode ? "Switch to dark mode" : "Switch to light mode"
            }
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#8fa8bf" }}
          >
            {lightMode ? (
              /* Moon — switch to dark */
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
              /* Sun — switch to light */
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

      {/* Slide content — CSS variable scope switches with lightMode toggle */}
      <div
        className="flex-1 overflow-y-auto overscroll-none"
        style={lightMode ? LIGHT_VARS : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderSlide(slide)}
      </div>

      {/* Bottom dot indicator */}
      <div
        className="flex justify-center items-center gap-2 py-4 shrink-0"
        style={{
          background: lightMode ? "#ffffff" : "#0f1626",
          borderTop: lightMode ? "1px solid #e5e7eb" : "1px solid #1e3050",
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
                    background: lightMode ? "#f1f3f4" : "#162030",
                    border: lightMode
                      ? "1px solid #d1d5db"
                      : "1px solid #1e3050",
                  }
            }
          />
        ))}
      </div>
    </div>
  );
}
