import type { Metadata } from "next";
import GalleryClient, { type GalleryPhoto } from "./GalleryClient";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Real roof and attic inspection photos from the El Paso area. No stock photos — every image came from an actual Scope Report inspection.",
  openGraph: {
    title: "Inspection Photo Gallery | Scope Reports",
    description: "Real inspection findings from El Paso, Las Cruces, and Alamogordo.",
  },
};

export const revalidate = 60;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    const res = await fetch(`${BASE}/api/gallery`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.photos ?? [];
  } catch {
    return [];
  }
}

const DIAGNOSIS_EXAMPLES = [
  {
    title: "Northeast El Paso — Attic ventilation failure",
    roof: "Granule loss on south-facing slopes, minor curling on ridge",
    attic: "Amber deposits on rafters, blocked soffits, no functional ridge vent",
    diagnosis:
      "The roof surface shows age-related wear, but the real problem is inside. The attic is running hot — amber deposits confirm sustained temperature spikes. The soffits are blocked by insulation pushed against the eave, and the ridge vent is insufficient. Without airflow, the heat has been degrading the deck and shingle bond from below. This is a ventilation system failure, not just a shingle age issue.",
  },
  {
    title: "East El Paso — Active moisture intrusion",
    roof: "Missing shingles at valley, damaged step flashing at chimney base",
    attic: "Water staining on rafters, dark wet decking at north corner, early mold growth",
    diagnosis:
      "There are two active entry points: the open valley and the chimney flashing. Water has been entering both. The attic shows evidence of repeated wetting and drying over multiple seasons — the staining pattern indicates this has been happening for at least 2–3 years. The mold growth is early-stage but established. Left unaddressed, this becomes structural: the decking will deteriorate and require replacement beyond just resheathing.",
  },
];

export default async function GalleryPage() {
  const photos = await getGalleryPhotos();

  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          Real Inspections. Real Findings.
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          Every photo in this gallery came from an actual roof inspection in the El Paso area. No
          stock photos. No staged damage.
        </p>
      </section>

      {/* Filter + grid */}
      <GalleryClient photos={photos} />

      {/* Diagnosis examples */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          What we found — and what it meant
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DIAGNOSIS_EXAMPLES.map(({ title, roof, attic, diagnosis }) => (
            <div key={title} className="border border-border bg-bg-surface rounded-xl p-6">
              <h3 className="text-text-primary font-semibold text-base mb-4">{title}</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-text-hint text-xs uppercase tracking-wider mb-1">Roof surface</p>
                  <p className="text-text-secondary text-sm">{roof}</p>
                </div>
                <div>
                  <p className="text-text-hint text-xs uppercase tracking-wider mb-1">Attic</p>
                  <p className="text-text-secondary text-sm">{attic}</p>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Diagnosis</p>
                <p className="text-text-secondary text-sm leading-relaxed">{diagnosis}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
