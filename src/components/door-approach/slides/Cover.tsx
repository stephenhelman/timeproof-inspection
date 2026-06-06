"use client";

import QRCode from "qrcode";
import type { CoverSlide } from "../slides";
import { useEffect, useState } from "react";
import { COLOR_CONFIG, type ColorMode } from "../colorConfig";

export function CoverRenderer({
  slide,
  repSlug,
  colorMode,
}: {
  slide: CoverSlide;
  repSlug: string | null;
  colorMode: ColorMode;
}) {
  const C = COLOR_CONFIG[colorMode];
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = repSlug
      ? `https://scopereports.com/roof-guide/?source=door&rep=${repSlug}`
      : `https://scopereports.com/roof-guide/?source=door`;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#0b1220", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [repSlug, C.textPrimary, C.bgBase]);

  return (
    <div
      className="flex flex-col items-center justify-start min-h-full gap-18"
      style={{ background: C.bgBase }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="flex flex-col pt-18 gap-9 justify-center items-center">
        <img
          src={
            colorMode === "dark"
              ? "/sr_logo_light_transparent.svg"
              : "/sr_logo_dark_transparent.svg"
          }
          alt="Scope Reports"
          style={{ height: 45, width: "auto" }}
        />
        <p
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: C.cardTitle }}
        >
          Powered by
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            colorMode === "light"
              ? "/qntum_logo_dark_transparent.png"
              : "/qntum_logo_light_transparent.png"
          }
          alt="Qntum Roofing"
          style={{ height: 28, width: "auto" }}
        />
      </div>

      <div className="flex flex-col justify-start items-center gap-3">
        <p className="text-lg" style={{ color: C.textPrimary }}>
          EL PASO&apos;S
        </p>

        <p className="text-5xl font-bold" style={{ color: C.cardTitle }}>
          PERSONALIZED
        </p>

        <p className="text-[28px]" style={{ color: C.textPrimary }}>
          ROOF HEALTH GUIDE
        </p>
        <div
          style={{ backgroundColor: C.textPrimary }}
          className="w-32 h-0.5"
        />
        <p
          className="text-[12px] leading-relaxed max-w-xs"
          style={{ color: C.textSecondary }}
        >
          {slide.sub}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Scan to get your personalized guide"
            className="w-50 h-50 rounded-xl border border-[0b1220]"
          />
        ) : (
          <div
            className="w-44 h-44 rounded-xl animate-pulse"
            style={{ background: C.bgElevated }}
          />
        )}
        <p className="text-xs" style={{ color: C.textPrimary }}>
          {slide.qrLabel}
        </p>
      </div>
    </div>
  );
}
