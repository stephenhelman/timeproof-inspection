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
      color: { dark: C.textPrimary, light: C.bgBase },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [repSlug, C.textPrimary, C.bgBase]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-8 py-10 text-center gap-6"
      style={{ background: C.bgBase }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={colorMode === "dark" ? "/sr_logo_light_transparent.svg" : "/sr_logo_dark_transparent.svg"}
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

      <div>
        <h1
          className="text-3xl sm:text-4xl font-bold leading-tight"
          style={{ color: C.textPrimary, lineHeight: 1.15 }}
        >
          EL PASO&apos;S
          <br />
          <span style={{ color: "#F06B30" }}>PERSONALIZED</span>
          <br />
          ROOF HEALTH GUIDE
        </h1>
      </div>

      <div className="w-12 h-px" style={{ background: C.border }} />

      <p
        className="text-sm leading-relaxed max-w-xs"
        style={{ color: C.textSecondary }}
      >
        {slide.sub}
      </p>

      <div className="flex flex-col items-center gap-2">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Scan to get your personalized guide"
            className="w-44 h-44 rounded-xl"
          />
        ) : (
          <div
            className="w-44 h-44 rounded-xl animate-pulse"
            style={{ background: C.bgElevated }}
          />
        )}
        <p className="text-xs" style={{ color: C.textHint }}>
          {slide.qrLabel}
        </p>
      </div>
    </div>
  );
}
