"use client";

import { useState, useEffect, useCallback } from "react";
import { generateRevealStatement } from "@/src/lib/findings";

interface Photo {
  id: string;
  driveUrl: string;
  photoNumber: number;
  description?: string | null;
}

interface PhotoRevealProps {
  mode: "presentation" | "report";
  photos: Photo[];
  findings: Record<string, boolean>;
  address: string;
  repName: string;
  customerName: string;
}

export default function PhotoReveal({
  mode,
  photos,
  findings,
  address,
  repName,
  customerName,
}: PhotoRevealProps) {
  // Slides: 0 = title, 1..N = photos, N+1 = summary
  const totalSlides = photos.length + 2;
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setVisible(false);
      setTimeout(() => {
        setCurrent(Math.max(0, Math.min(index, totalSlides - 1)));
        setVisible(true);
      }, 150);
    },
    [totalSlides]
  );

  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);
  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Swipe handlers (presentation only)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== "presentation") return;
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || mode !== "presentation") return;
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      delta > 0 ? goNext() : goPrev();
    }
    setTouchStart(null);
  };

  const statement = generateRevealStatement({ findings, address, repName, mode });
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Render slide content
  const renderSlide = () => {
    // Title slide
    if (current === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-6 h-full px-8">
          <div className="w-full max-w-xs h-16 rounded-2xl flex items-center justify-center overflow-hidden bg-white">
            <img src="/logo.png" alt="TIMEPROOF" className="h-10 w-auto px-3" />
          </div>
          <h1 className={`font-bold ${mode === "presentation" ? "text-text-primary text-4xl" : "text-gray-900 text-3xl"}`}>
            Roof Inspection Report
          </h1>
          <div className={mode === "presentation" ? "text-text-secondary text-xl" : "text-gray-600 text-lg"}>
            <p className="font-semibold">{customerName}</p>
            <p>{address}</p>
            <p className="mt-2 text-sm">{today}</p>
          </div>
        </div>
      );
    }

    // Summary slide
    if (current === totalSlides - 1) {
      return (
        <div className={`flex flex-col gap-6 h-full overflow-y-auto px-4 py-6 ${mode === "presentation" ? "text-text-primary" : "text-gray-800"}`}>
          <p className={`text-xl leading-relaxed ${mode === "presentation" ? "text-text-primary" : "text-gray-800"}`}>
            {statement.opening}
          </p>
          {statement.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {statement.items.map((item) => (
                <li key={item} className={`flex items-start gap-3 text-lg ${mode === "presentation" ? "text-text-secondary" : "text-gray-700"}`}>
                  <span className={`mt-0.5 ${mode === "presentation" ? "text-text-accent" : "text-[#1B3A7A]"}`}>•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
          {statement.closing && (
            <p className={`text-base leading-relaxed whitespace-pre-line mt-4 ${mode === "presentation" ? "text-text-secondary" : "text-gray-600"}`}>
              {statement.closing}
            </p>
          )}
        </div>
      );
    }

    // Photo slide
    const photo = photos[current - 1];
    if (!photo) return null;
    return (
      <div className="flex flex-col h-full">
        <div className="relative flex-1 min-h-0">
          {/* Photo number badge */}
          <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
            {current} of {photos.length}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.driveUrl}
            alt={`Photo ${photo.photoNumber}`}
            className="w-full h-full object-contain"
          />
        </div>
        {photo.description && (
          <div className={`px-4 py-4 shrink-0 ${mode === "presentation" ? "text-text-primary" : "text-gray-800"}`}>
            <p className={mode === "presentation" ? "text-xl leading-relaxed" : "text-base leading-relaxed"}>
              {photo.description}
            </p>
          </div>
        )}
      </div>
    );
  };

  const isPresentation = mode === "presentation";

  return (
    <div
      className={`flex flex-col ${isPresentation ? "h-screen bg-bg-base" : "min-h-125 bg-white rounded-2xl border border-gray-200 overflow-hidden"}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide content */}
      <div
        className={`flex-1 min-h-0 transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        {renderSlide()}
      </div>

      {/* Navigation bar */}
      <div className={`flex items-center justify-between px-4 py-3 shrink-0 ${isPresentation ? "bg-bg-surface/80" : "bg-gray-50 border-t border-gray-200"}`}>
        <button
          onClick={goPrev}
          disabled={current === 0}
          className={`min-h-12 min-w-12 rounded-xl flex items-center justify-center text-2xl transition-opacity disabled:opacity-30 ${isPresentation ? "text-text-primary" : "text-gray-700"}`}
        >
          ←
        </button>
        <span className={`text-sm ${isPresentation ? "text-text-hint" : "text-gray-500"}`}>
          Slide {current + 1} of {totalSlides}
        </span>
        <button
          onClick={goNext}
          disabled={current === totalSlides - 1}
          className={`min-h-12 min-w-12 rounded-xl flex items-center justify-center text-2xl transition-opacity disabled:opacity-30 ${isPresentation ? "text-text-primary" : "text-gray-700"}`}
        >
          →
        </button>
      </div>
    </div>
  );
}
