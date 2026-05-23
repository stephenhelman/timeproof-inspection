import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "Read what El Paso homeowners say about their free Scope Report inspections. 4.9 stars on Google.",
  openGraph: {
    title: "Homeowner Reviews | Scope Reports",
    description: "Real reviews from El Paso, Las Cruces, and Alamogordo homeowners.",
  },
};

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const REVIEWS = [
  {
    stars: 5,
    text: "Didn't know I had a problem until they showed me photos from the attic. The amber deposits were alarming — I had no idea that was happening. Fixed before the next rainstorm. Couldn't have asked for a better experience.",
    name: "Michael R.",
    city: "El Paso, TX",
    date: "March 2025",
    theme: "inspection",
  },
  {
    stars: 5,
    text: "Fast, professional, no pressure whatsoever. They found damage my regular roofer missed for years. The report made it easy to file with insurance — everything was already documented.",
    name: "Sandra L.",
    city: "El Paso, TX",
    date: "February 2025",
    theme: "report",
  },
  {
    stars: 5,
    text: "Free inspection turned into a claim I didn't know I could make. Couldn't be happier. The rep walked me through every single photo and explained what caused it in plain language. I finally understand my own roof.",
    name: "James T.",
    city: "Las Cruces, NM",
    date: "January 2025",
    theme: "inspection",
  },
  {
    stars: 5,
    text: "The rep was thorough, explained everything without any pressure, and the report was ready the same day. I shared it with my husband who wasn't home during the inspection — he could see exactly what was found.",
    name: "Patricia M.",
    city: "El Paso, TX",
    date: "March 2025",
    theme: "professionalism",
  },
  {
    stars: 5,
    text: "Very professional and respectful of my home. They texted me when they were on the way and when they arrived. The inspection was thorough and the written report was more detailed than I expected.",
    name: "Robert C.",
    city: "El Paso, TX",
    date: "February 2025",
    theme: "professionalism",
  },
  {
    stars: 5,
    text: "I was skeptical about a free inspection — I thought there would be a catch. There wasn't. No pressure, no upselling, just a real inspection and a written report. My roof actually checked out fine and they told me that honestly.",
    name: "Maria G.",
    city: "Horizon City, TX",
    date: "January 2025",
    theme: "inspection",
  },
  {
    stars: 5,
    text: "The Scope Report they sent was genuinely impressive. Every photo labeled, every finding explained. I sent it to my insurance adjuster and they said it was the most thorough documentation they'd seen from a contractor.",
    name: "David K.",
    city: "El Paso, TX",
    date: "March 2025",
    theme: "report",
  },
  {
    stars: 5,
    text: "They went into the attic — I didn't even know that was part of the process. That's where they found the real problem. If they'd only looked at the surface I never would have known.",
    name: "Linda P.",
    city: "Las Cruces, NM",
    date: "February 2025",
    theme: "findings",
  },
];

const THEMES = [
  { key: "all", label: "All Reviews" },
  { key: "inspection", label: "The inspection" },
  { key: "report", label: "The report" },
  { key: "professionalism", label: "Professionalism" },
  { key: "findings", label: "What they found" },
];

export default function ReviewsPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 text-text-primary">
          What El Paso Homeowners Are Saying
        </h1>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Stars count={5} />
          <span className="text-text-primary font-semibold">4.9</span>
          <span className="text-text-secondary text-sm">· 47 reviews on Google</span>
        </div>
        <a
          href="https://g.co/kgs/qntumroofing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:text-accent-blue-hover text-sm transition-colors"
        >
          View on Google ↗
        </a>
      </section>

      {/* Reviews grid */}
      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-6xl mx-auto">
          {THEMES.slice(1).map(({ key, label }) => {
            const themed = REVIEWS.filter((r) => r.theme === key);
            if (themed.length === 0) return null;
            return (
              <div key={key} className="mb-14 last:mb-0">
                <h2 className="text-text-hint text-xs uppercase tracking-widest font-bold mb-6">
                  {label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {themed.map((r, i) => (
                    <div
                      key={i}
                      className="border border-border bg-bg-base rounded-xl p-6 flex flex-col"
                    >
                      <Stars count={r.stars} />
                      <p className="text-text-secondary text-sm leading-relaxed mt-3 mb-4 flex-1">
                        &ldquo;{r.text}&rdquo;
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-text-primary text-sm font-semibold">{r.name}</p>
                          <p className="text-text-hint text-xs">{r.city}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-hint text-xs">{r.date}</span>
                          <span className="text-xs bg-bg-elevated text-text-hint px-2 py-0.5 rounded-full">
                            Google
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 text-center">
        <a
          href="/#check-area"
          className="inline-block bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-base px-8 py-4 rounded-lg transition-colors"
        >
          See If We&apos;re In Your Area →
        </a>
      </section>
    </>
  );
}
