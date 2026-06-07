"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Photo {
  id: string;
  r2Url: string;
  zone: string | null;
  damageTags: string[];
  photoNumber: number;
  photoSection: string;
}

interface EngagementRecord {
  photoId: string;
  dwellMs: number;
  slideIndex: number;
}

export default function PhotoSlideshow({
  photos,
  reportUuid,
}: {
  photos: Photo[];
  reportUuid: string;
}) {
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const slideEnterTime = useRef(Date.now());
  const pendingEngagements = useRef<EngagementRecord[]>([]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const flushCurrentSlide = useCallback(() => {
    const dwell = Date.now() - slideEnterTime.current;
    const idx = currentRef.current;
    if (dwell >= 3000 && photos[idx]) {
      pendingEngagements.current.push({
        photoId: photos[idx].id,
        dwellMs: dwell,
        slideIndex: idx,
      });
    }
  }, [photos]);

  const go = useCallback(
    (idx: number) => {
      flushCurrentSlide();
      currentRef.current = idx;
      slideEnterTime.current = Date.now();
      setCurrent(idx);
    },
    [flushCurrentSlide],
  );

  const goPrev = useCallback(() => {
    if (currentRef.current > 0) go(currentRef.current - 1);
  }, [go]);

  const goNext = useCallback(() => {
    if (currentRef.current < photos.length - 1) go(currentRef.current + 1);
  }, [go, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  // Send dwell data on page exit
  useEffect(() => {
    function onUnload() {
      flushCurrentSlide();
      if (pendingEngagements.current.length === 0) return;
      navigator.sendBeacon(
        `/api/report/${reportUuid}/photo-engagement`,
        JSON.stringify({ engagements: pendingEngagements.current }),
      );
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushCurrentSlide, reportUuid]);

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

  if (photos.length === 0) return null;

  const photo = photos[current];

  return (
    <div
      className="select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Photo */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.r2Url}
          alt={`Photo ${photo.photoNumber}`}
          className="w-full aspect-video object-cover rounded-xl border border-report-border"
        />

        {/* Prev arrow */}
        {current > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow-sm transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {current < photos.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow-sm transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Slide info + counter */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-report-text font-semibold text-sm">
            {photo.zone || photo.photoSection}
          </p>
          <span className="text-gray-400 text-xs tabular-nums shrink-0">
            {current + 1} / {photos.length}
          </span>
        </div>

        {photo.damageTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {photo.damageTags.map((tag) => (
              <span
                key={tag}
                className="bg-report-surface border border-report-border text-gray-600 text-xs px-2 py-0.5 rounded-full"
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
