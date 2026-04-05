"use client";

import { useEffect, useRef, useCallback } from "react";
import React from "react";

interface SectionTrackerProps {
  uuid: string;
  children: React.ReactNode;
}

export default function SectionTracker({ uuid, children }: SectionTrackerProps) {
  const sectionTimers = useRef<Record<string, number>>({});
  const sectionStarts = useRef<Record<string, number>>({});

  const startTimer = useCallback((key: string) => {
    if (sectionStarts.current[key]) return;
    sectionStarts.current[key] = Date.now();
  }, []);

  const stopTimer = useCallback((key: string) => {
    const start = sectionStarts.current[key];
    if (!start) return;
    const elapsed = Math.round((Date.now() - start) / 1000);
    sectionTimers.current[key] = (sectionTimers.current[key] || 0) + elapsed;
    delete sectionStarts.current[key];
  }, []);

  const getAccumulatedSections = useCallback(() => {
    // Stop any running timers
    Object.keys(sectionStarts.current).forEach(stopTimer);
    return Object.entries(sectionTimers.current).map(([sectionKey, secondsViewed]) => ({
      sectionKey,
      secondsViewed,
    }));
  }, [stopTimer]);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    const observers: IntersectionObserver[] = [];

    sections.forEach((el) => {
      const key = el.dataset.section!;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startTimer(key);
          } else {
            stopTimer(key);
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    const handleBeforeUnload = () => {
      const device = /iPad|iPhone|Android/.test(navigator.userAgent) ? "mobile" : "desktop";
      navigator.sendBeacon(
        `/api/report/${uuid}/view`,
        JSON.stringify({
          device,
          userAgent: navigator.userAgent,
          sections: getAccumulatedSections(),
        })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uuid, startTimer, stopTimer, getAccumulatedSections]);

  return <>{children}</>;
}
