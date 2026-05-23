"use client";

import { useState } from "react";

export const dynamic = "force-static";

type FAQItem = { q: string; a: string };

const CATEGORIES: { title: string; items: FAQItem[] }[] = [
  {
    title: "About the inspection",
    items: [
      {
        q: "Is it really free?",
        a: "Yes — no cost, no obligation, ever. You get a full roof and attic inspection plus a written Scope Report. We don't charge for inspections. There is no catch.",
      },
      {
        q: "Do I have to buy anything?",
        a: "No. The inspection and report are yours regardless of what you decide to do with the findings. We walk you through what we found, answer your questions, and let you make an informed decision on your own timeline.",
      },
      {
        q: "What if my roof is in good condition?",
        a: "We document that too. A clean report is still a report — you now have written, photographic evidence that your roof was inspected and was in good condition on a specific date. That's useful for insurance purposes and for your own records.",
      },
      {
        q: "How long does the inspection take?",
        a: "Most inspections take 45–60 minutes. We inspect the roof surface, go into the attic, and then sit down with you to walk through every finding with real photos from your home.",
      },
      {
        q: "Will you walk on my roof?",
        a: "Yes. We inspect the roof surface directly. We also go into the attic — which is where most failures actually start.",
      },
      {
        q: "Do I need to be home?",
        a: "Yes. We go over the findings with you in person. A Scope Report walkthrough is part of the inspection — we don't just leave a report on the door.",
      },
      {
        q: "What areas do you serve?",
        a: "We currently serve El Paso, Las Cruces, and Alamogordo. We're expanding — check your ZIP at scopereports.com to confirm coverage.",
      },
    ],
  },
  {
    title: "About the report",
    items: [
      {
        q: "What's in the Scope Report?",
        a: "Real photos from your roof and attic, organized by finding. A plain-English diagnosis of what was found. A record of what you believed going in vs. what you understood after the inspection. Topics covered during the walkthrough. No pricing, no sales pitch — just the findings.",
      },
      {
        q: "Who gets to see my report?",
        a: "You. We don't share your report with anyone. No homeowner names, addresses, or report links are ever published publicly. If we use a photo in our gallery, it's anonymized — no identifying information attached.",
      },
      {
        q: "Can I share it with my insurance company?",
        a: "Yes. That's one of the most common uses. The report gives your adjuster documented evidence — photos, findings, and a diagnosis — rather than just a verbal claim.",
      },
      {
        q: "How long do I have access to the report?",
        a: "Your report link is permanent. There's no expiration date. You can share it with anyone and access it anytime.",
      },
    ],
  },
  {
    title: "About Qntum Roofing",
    items: [
      {
        q: "Are you licensed and insured?",
        a: "Yes. Qntum Roofing is a licensed roofing contractor. We carry general liability and workers' compensation insurance on every job.",
      },
      {
        q: "What is an Owens Corning Preferred Contractor?",
        a: "Owens Corning is one of the largest roofing product manufacturers in North America. Their Preferred Contractor program requires contractors to meet installation standards, carry proper licensing and insurance, and maintain a history of completed work using OC products. Preferred status unlocks system-level warranties — not just product warranties.",
      },
      {
        q: "What products do you use?",
        a: "Qntum's standard install includes TruDef Duration shingles, DeckDefense synthetic underlayment, and Titanium UDL on steeper slopes and high-exposure areas. These aren't upgrades — they're the baseline on every Qntum job.",
      },
      {
        q: "What warranties come with the work?",
        a: "Qntum jobs are backed by an Owens Corning system warranty, which covers materials and workmanship together. The specific terms depend on the product package and installation details — your rep will explain the warranty that applies to your job.",
      },
    ],
  },
  {
    title: "About the process",
    items: [
      {
        q: "How do I book an inspection?",
        a: "Enter your ZIP at scopereports.com to confirm we service your area, then fill out the short form. One of our inspection specialists will reach out to schedule.",
      },
      {
        q: "How quickly can you come out?",
        a: "We typically schedule within 2–5 business days depending on availability in your area. We work mornings, afternoons, and evenings to schedule around you.",
      },
      {
        q: "What happens after the inspection?",
        a: "You get your Scope Report the same day. If we found issues, you'll understand exactly what they are and what they mean. There's no follow-up pressure — we leave the next step to you.",
      },
      {
        q: "Do I have to make a decision the same day?",
        a: "No. The report is yours and there's no deadline. We understand you may want to talk it over with your family, consult your insurance, or think it through. That's completely fine.",
      },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-border bg-bg-base rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
          >
            <span className="text-text-primary font-medium text-sm">{item.q}</span>
            <span
              className={`shrink-0 text-text-secondary transition-transform duration-200 ${
                open === i ? "rotate-45" : ""
              }`}
            >
              +
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-text-secondary text-sm leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FAQPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 text-text-primary">
          Questions We Hear All The Time
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed">
          Honest answers. No sales pitch.
        </p>
      </section>

      {/* FAQ categories */}
      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-3xl mx-auto space-y-12">
          {CATEGORIES.map(({ title, items }) => (
            <div key={title}>
              <h2 className="text-text-hint text-xs uppercase tracking-widest font-bold mb-5">
                {title}
              </h2>
              <FAQAccordion items={items} />
            </div>
          ))}
        </div>
      </section>

      {/* Still have questions */}
      <section className="px-5 py-16 text-center">
        <p className="text-text-secondary text-sm mb-4">Still have a question?</p>
        <a
          href="/contact"
          className="inline-block text-accent-blue hover:text-accent-blue-hover font-semibold text-sm transition-colors"
        >
          Contact us →
        </a>
      </section>
    </>
  );
}
