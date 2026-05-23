import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn exactly what happens during a Scope Report inspection — from booking to your written report. No surprises, no sales pressure.",
  openGraph: {
    title: "How a Scope Report Works | Scope Reports",
    description: "A step-by-step look at the free roof and attic inspection process.",
  },
};

const STEPS = [
  {
    num: "01",
    title: "You check your area",
    desc: "You enter your ZIP and confirm you're a homeowner. If we serve your area, you fill out a quick form. Takes about 2 minutes.",
  },
  {
    num: "02",
    title: "We reach out to schedule",
    desc: "One of our inspection specialists contacts you to confirm a time. We schedule around you — morning, afternoon, or evening.",
  },
  {
    num: "03",
    title: "We show up and inspect",
    desc: "Your specialist arrives and texts you when they're on the way and when they're at the door. We inspect the roof surface and the attic. Most inspections take 45–60 minutes.",
  },
  {
    num: "04",
    title: "We document everything",
    desc: "Every area of concern is photographed. We tag what we found — granule loss, nail pops, water staining, ventilation issues — organized by roof and attic separately.",
  },
  {
    num: "05",
    title: "We sit down with you",
    desc: "We walk you through what we found with real photos from your roof. We explain what each finding means in plain English — not roofing jargon.",
  },
  {
    num: "06",
    title: "You get your report the same day",
    desc: "A full written Scope Report is sent to you with all photos, the diagnosis, and a summary of everything we reviewed together. No login required. You can share it with family, your insurance company, or keep it for your records.",
  },
];

const ROOF_ITEMS = [
  "Shingle condition and age",
  "Granule loss and exposed fiberglass",
  "Curling, cracking, or lifting shingles",
  "Nail pops and flashing damage",
  "Missing shingles and open penetrations",
];

const ATTIC_ITEMS = [
  "Water staining on rafters and decking",
  "Amber deposits (heat damage / sap bleed)",
  "Cat eyes (nail rot from condensation)",
  "Mold and biological growth",
  "Ventilation — soffits and ridge vent condition",
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          Here&apos;s Exactly What Happens When You Book a Scope Report
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          No surprises. No sales pressure. Just a thorough documented inspection.
        </p>
      </section>

      {/* Step-by-step */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto space-y-0">
          {STEPS.map(({ num, title, desc }, idx) => (
            <div key={num} className="relative flex gap-6 pb-12 last:pb-0">
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
              )}
              {/* Number bubble */}
              <div className="shrink-0 w-10 h-10 rounded-full bg-bg-base border border-border flex items-center justify-center z-10">
                <span className="text-accent-blue text-xs font-bold">{num}</span>
              </div>
              <div className="pt-1.5">
                <h2 className="text-text-primary font-semibold text-lg mb-2">{title}</h2>
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What we inspect */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          What we inspect
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border bg-bg-surface rounded-xl p-6">
            <h3 className="text-text-primary font-semibold text-base mb-4">Roof Surface</h3>
            <ul className="space-y-2.5">
              {ROOF_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="text-accent-blue mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-border bg-bg-surface rounded-xl p-6">
            <h3 className="text-text-primary font-semibold text-base mb-4">Attic</h3>
            <ul className="space-y-2.5">
              {ATTIC_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="text-accent-blue mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Attic callout */}
        <div className="mt-8 border border-accent-blue bg-bg-surface rounded-xl p-6">
          <p className="text-text-primary text-sm leading-relaxed">
            <span className="font-semibold text-accent-blue">Why the attic matters:</span>{" "}
            We&apos;re one of the few inspection services in El Paso that goes in the attic on every
            inspection. Most contractors skip it. We don&apos;t — because that&apos;s where most
            failures start.
          </p>
        </div>
      </section>

      {/* The Scope Report */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
            What you receive
          </p>
          <h2 className="text-2xl font-bold text-text-primary mb-6 text-center">
            The Scope Report
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              "Your photos organized by what was found",
              "Auto-generated diagnosis in plain English",
              "What you believed before vs. what you understood after",
              "Topics reviewed during the inspection walkthrough",
              "No pricing, no sales pitch — just the findings",
              "Shareable link you keep forever, no login required",
            ].map((item) => (
              <div
                key={item}
                className="border border-border bg-bg-base rounded-lg p-4 flex items-start gap-3 text-sm text-text-secondary"
              >
                <span className="text-success-text shrink-0">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 text-center">
        <a
          href="/#check-area"
          className="inline-block bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-base px-8 py-4 rounded-lg transition-colors"
        >
          Check If We Service Your Area →
        </a>
      </section>
    </>
  );
}
