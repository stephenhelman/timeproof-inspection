"use client";

import { useState } from "react";
import { useLanguage } from "@/src/components/marketing/LanguageProvider";

export type GalleryPhoto = {
  r2Url: string;
  damageTags: string[];
  photoSection: string;
  cityArea: string | null;
  description: string | null;
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Granule Loss", value: "granule-loss" },
  { label: "Curling Shingles", value: "curling" },
  { label: "Nail Pops", value: "nail-pops" },
  { label: "Missing Shingles", value: "missing-shingles" },
  { label: "Water Damage", value: "water-staining-rafters" },
  { label: "Amber Deposits", value: "amber-deposits" },
  { label: "Cat Eyes", value: "cat-eyes" },
  { label: "Ventilation", value: "blocked-soffits" },
  { label: "Flashing", value: "damaged-flashing" },
];

function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    "granule-loss": "Granule Loss",
    "exposed-fiberglass": "Exposed Fiberglass",
    curling: "Curling Shingles",
    "fish-lip": "Fish Lip",
    "nail-pops": "Nail Pops",
    "missing-shingles": "Missing Shingles",
    vegetation: "Vegetation",
    "damaged-flashing": "Damaged Flashing",
    "other-roof": "Other",
    "water-staining-rafters": "Water Staining",
    "dark-wet-decking": "Dark Decking",
    "amber-deposits": "Amber Deposits",
    "cat-eyes": "Cat Eyes",
    mold: "Mold",
    "blocked-soffits": "Blocked Soffits",
    "inadequate-ridge-vent": "Ridge Vent Issue",
    "daylight-decking": "Daylight Through Deck",
    "other-attic": "Other",
    staining: "Staining",
  };
  return map[tag] ?? tag;
}

export default function GalleryClient({ photos }: { photos: GalleryPhoto[] }) {
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState("");
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  const limit = Number(process.env.NEXT_PUBLIC_GALLERY_PHOTO_LIMIT || 20);

  const filtered = activeFilter
    ? photos.filter((p) => p.damageTags.includes(activeFilter))
    : photos;

  const visible = filtered.slice(0, limit);

  return (
    <>
      {/* Filter bar */}
      <div className="px-5 py-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max mx-auto justify-start lg:justify-center">
          {FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === value
                  ? "bg-accent-blue text-white"
                  : "bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-5 pb-20 max-w-7xl mx-auto">
        {visible.length === 0 ? (
          <p className="text-text-hint text-sm text-center py-20">{t("gallery.noPhotos")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map((photo, i) => (
              <button
                key={i}
                onClick={() => setLightbox(photo)}
                className="border border-border bg-bg-surface rounded-xl overflow-hidden text-left hover:border-border-hover transition-colors group"
              >
                <div className="relative h-48 overflow-hidden bg-bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.r2Url}
                    alt={photo.description || photo.damageTags.join(", ")}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className="bg-bg-base/80 text-xs text-text-secondary px-2 py-0.5 rounded-full capitalize">
                      {photo.photoSection}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {photo.damageTags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-bg-elevated text-text-secondary px-2 py-0.5 rounded-full"
                      >
                        {tagLabel(tag)}
                      </span>
                    ))}
                  </div>
                  {photo.cityArea && (
                    <p className="text-text-hint text-xs">{photo.cityArea}</p>
                  )}
                  {photo.description && (
                    <p className="text-text-secondary text-xs leading-relaxed mt-1 line-clamp-2">
                      {photo.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-3xl w-full bg-bg-surface border border-border rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.r2Url}
              alt={lightbox.description || "Inspection photo"}
              className="w-full max-h-[60vh] object-contain bg-bg-base"
            />
            <div className="p-5">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {lightbox.damageTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-bg-elevated text-text-secondary px-2.5 py-1 rounded-full"
                  >
                    {tagLabel(tag)}
                  </span>
                ))}
              </div>
              {lightbox.cityArea && (
                <p className="text-text-hint text-xs mb-1">{lightbox.cityArea}</p>
              )}
              {lightbox.description && (
                <p className="text-text-secondary text-sm leading-relaxed">{lightbox.description}</p>
              )}
              <button
                onClick={() => setLightbox(null)}
                className="mt-4 text-text-hint hover:text-text-secondary text-xs transition-colors"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <section className="px-5 py-12 bg-bg-surface text-center">
        <a
          href="/#check-area"
          className="inline-block bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-base px-8 py-4 rounded-lg transition-colors"
        >
          {t("cta.bookInspection")}
        </a>
      </section>
    </>
  );
}
