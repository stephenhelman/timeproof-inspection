"use client";

import { useRef, useState } from "react";
import InteractiveDiagram, {
  type DiagramZone,
} from "@/src/components/guide/InteractiveDiagram";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonalizationConfig {
  leadWithTimeline: boolean;
  highlightAttic: boolean;
  highlightFlashing: boolean;
  highlightGranules: boolean;
  highlightRidgeCap: boolean;
  urgencyBanner: boolean;
  zoneCallouts: {
    flashing: string | null;
    atticVentilation: string | null;
    ridgeCap: string | null;
    deckingUnderside: string | null;
    fieldShingles: string | null;
  };
  banner: { type: "warning" | "info"; text: string } | null;
  hasMissingShingles: boolean;
  hasPonding: boolean;
  hasSagging: boolean;
  hasWaterStains: boolean;
  hasGranules: boolean;
  isOldRoof: boolean;
}

interface Props {
  firstName: string;
  roofType: string;
  roofAge: string;
  issuesNoticed: string[];
  config: PersonalizationConfig;
  token: string;
}

// ─── Static diagram data ──────────────────────────────────────────────────────

// Last calibrated: 2026-05-24
// To adjust: change hotspot x/y/width/height percentages
// Test on live page at /roof-guide/[any-valid-slug]
// Tap each numbered box and verify the correct panel opens
const FAILURE_ZONE_ZONES: DiagramZone[] = [
  {
    id: "shingles",
    label: "1. Field Shingles",
    description:
      "Granule loss and UV damage start here — but rarely end here. Visible from the street but the least predictive of overall roof health.",
    hotspot: { x: 2.5, y: 27, width: 18, height: 19 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "ridge-cap",
    label: "2. Ridge Cap",
    description:
      "The peak of the roof concentrates the highest heat on the entire structure. First zone to fail. Last zone most inspectors check.",
    hotspot: { x: 60.25, y: 3, width: 18, height: 19 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "flashing",
    label: "3. Flashing & Seams",
    description:
      "Where the roof surface meets walls, vents, chimneys, and valleys. The single most common point of water intrusion on any roof.",
    hotspot: { x: 80.5, y: 27, width: 18, height: 19 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "decking",
    label: "4. Roof Decking",
    description:
      "The structural wood layer beneath everything else. Moisture here means the problem is already serious — and getting worse daily.",
    hotspot: { x: 80.5, y: 47.5, width: 18, height: 19 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "attic-ventilation",
    label: "5. Attic Ventilation",
    description:
      "The most overlooked failure zone on every roof. Poor attic ventilation traps heat and moisture — directly accelerating failure in every other zone simultaneously. Almost never included in a standard inspection.",
    hotspot: { x: 35.25, y: 54, width: 19.25, height: 20 }, // Calibrated — adjust if box position differs on actual PNG
  },
];

// Last calibrated: 2026-05-24
// To adjust: change hotspot x/y/width/height percentages
// Test on live page at /roof-guide/[any-valid-slug]
// Tap each numbered box and verify the correct panel opens
const SHINGLE_COMPONENT_ZONES: DiagramZone[] = [
  {
    id: "decking",
    label: "Roof Decking",
    description:
      "Structural wood layer. Foundation of everything above. Moisture here is critical.",
    hotspot: { x: 78.5, y: 39, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "underlayment",
    label: "Underlayment",
    description:
      "Waterproof barrier between decking and shingles. Your secondary defense if shingles fail.",
    hotspot: { x: 2, y: 53, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "ice-water",
    label: "Ice & Water Shield",
    description:
      "Waterproof membrane at eaves and valleys. Prevents wind-driven moisture from working under the shingles.",
    hotspot: { x: 2, y: 70.5, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "shingles",
    label: "Shingles",
    description:
      "Primary weather surface. Where most homeowners focus — but not where most failures start.",
    hotspot: { x: 2, y: 35.5, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "ridge-cap",
    label: "Ridge Cap",
    description:
      "Seals the peak. Highest heat exposure on the entire roof surface.",
    hotspot: { x: 2, y: 19.5, width: 20.5, height: 11.5 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "flashing",
    label: "Flashing",
    description:
      "Metal seals at walls, vents, chimneys. Single most common active leak point on any roof.",
    hotspot: { x: 78.5, y: 18, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "drip-edge",
    label: "Drip Edge",
    description:
      "Directs water off the roof edge into the gutter. Frequently skipped on lower-cost installations.",
    hotspot: { x: 78.5, y: 60, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "gutters",
    label: "Gutters",
    description:
      "Final drainage. Failure causes fascia rot, soffit damage, and foundation issues over time.",
    hotspot: { x: 78.5, y: 80, width: 20.5, height: 13 }, // Calibrated — adjust if box position differs on actual PNG
  },
];

// Last calibrated: 2026-05-24
// To adjust: change hotspot x/y/width/height percentages
// Test on live page at /roof-guide/[any-valid-slug]
// Tap each numbered box and verify the correct panel opens
const ATTIC_ZONES: DiagramZone[] = [
  {
    id: "decking-underside",
    label: "Decking Underside",
    description:
      "Moisture staining here signals active water intrusion invisible from the exterior. This is the first thing we look for when we go up.",
    hotspot: { x: 2.5, y: 17, width: 22.5, height: 17 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "rafters",
    label: "Rafters",
    description:
      "Structural framing members supporting the entire roof load. Compromised rafters are a safety issue — not just a roofing issue.",
    hotspot: { x: 1, y: 37, width: 17.25, height: 20 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "insulation",
    label: "Insulation",
    description:
      "Wet or compressed insulation signals long-term moisture damage — plus a utility bill problem you are already paying for.",
    hotspot: { x: 35, y: 80, width: 19.5, height: 17.5 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "soffit-vents",
    label: "Soffit Vents",
    description:
      "Intake vents that allow outside air into the attic. Blocked soffits trap heat and directly accelerate shingle failure above.",
    hotspot: { x: 2, y: 78, width: 17.5, height: 20 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "ridge-vent",
    label: "Ridge Vent",
    description:
      "Exhaust point for hot attic air. A failed ridge vent turns your attic into an oven and voids most manufacturer warranties.",
    hotspot: { x: 59, y: 2, width: 20, height: 18 }, // Calibrated — adjust if box position differs on actual PNG
  },
  {
    id: "vapor-barrier",
    label: "Vapor Barrier",
    description:
      "Prevents condensation from forming inside the attic. Missing in many older El Paso homes.",
    hotspot: { x: 80, y: 29, width: 19, height: 18 }, // Calibrated — adjust if box position differs on actual PNG
  },
];

// ─── Static content ───────────────────────────────────────────────────────────

const TIMELINE = [
  {
    years: "Year 1–2",
    visible: "Looks brand new",
    hidden: "Granule bonding weakens from UV",
  },
  {
    years: "Year 3–5",
    visible: "Still looks fine",
    hidden: "Granule loss accelerates, underlayment stress",
  },
  {
    years: "Year 7–10",
    visible: "Minor surface wear",
    hidden: "Decking moisture begins, ventilation failing",
  },
  {
    years: "Year 12–15",
    visible: "Noticeable aging",
    hidden: "Active attic moisture, structural decking at risk",
  },
  {
    years: "Year 15+",
    visible: "Ceiling stains appear",
    hidden: "Damage has been building for years",
  },
];

const SHINGLE_COMPARISON = [
  {
    feature: "Type",
    old: "3-tab (single layer)",
    current: "Architectural dimensional",
  },
  {
    feature: "Lifespan",
    old: "10–15 yrs in El Paso",
    current: "50-year warranted",
  },
  { feature: "Wind rating", old: "60–70 mph", current: "130+ mph" },
  {
    feature: "Granules",
    old: "Standard (degrades fast)",
    current: "UV-reflective, algae-resistant",
  },
  {
    feature: "Warranty",
    old: "Frequently voided",
    current: "Spec-compliant installation",
  },
];

const FLAT_COMPARISON = [
  {
    feature: "Technology",
    old: "BUR / modified bitumen",
    current: "EPDM / TPO single-ply",
  },
  {
    feature: "Lifespan",
    old: "10–15 years",
    current: "20–25 years with maintenance",
  },
  {
    feature: "Heat resistance",
    old: "Poor — absorbs UV",
    current: "Reflective membranes reduce heat",
  },
  {
    feature: "Seam strength",
    old: "Mop-applied, prone to cracking",
    current: "Heat-welded seams",
  },
  {
    feature: "Drainage",
    old: "Often relies on slope alone",
    current: "Engineered drain placement",
  },
];

const DTTY = [
  {
    title: "The warranty problem",
    body: "Most homeowners assume their roof is under warranty. In most cases the warranty was never valid — if shingles were not installed precisely to the manufacturer's specification, it was void from day one.",
    question:
      "When's the last time someone actually confirmed your installation was to spec?",
  },
  {
    title: "It can look fine and be failing",
    body: "A roof can look completely fine from the street and already be past the point where it should have been replaced. Decking condition, ventilation, and underlayment — none of that is visible from the ground.",
    question: "If you couldn't see it from the street, how would you know?",
  },
  {
    title: "That stain is not where the problem is",
    body: "Water stains inside the house show up at the lowest point the water travels to — not where it came in. The actual entry point is almost always somewhere else on the roof entirely.",
    question:
      "Have you traced it back, or are you still guessing where it started?",
  },
];

const DIFFERENTIATORS = [
  "We go into the attic. Most companies don't. That's where the real condition of your roof is visible.",
  "Full digital condition report — photos by zone, condition ratings, attic findings delivered digitally.",
  "Same-day written report — a document you keep, not a verbal summary.",
  "50-year warranted architectural shingles when the installation meets manufacturer spec.",
  "El Paso climate expertise — we know how this market ages roofs differently.",
];

// ─── Component helpers ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-4">
      {children}
    </p>
  );
}

function TabGroup({
  tabs,
  children,
}: {
  tabs: string[];
  children: (active: number) => React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border mb-6 overflow-x-hidden">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActive(i)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              active === i
                ? "border-[#F06B30] text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function GuideClient({
  firstName,
  roofType,
  roofAge,
  issuesNoticed,
  config,
  token,
}: Props) {
  const ctaRef = useRef<HTMLElement>(null);

  const isShingle = roofType === "Shingle" || roofType === "Both";
  const isFlat = roofType === "Flat" || roofType === "Both";

  const failureZonesWithCallouts: DiagramZone[] = FAILURE_ZONE_ZONES.map(
    (z) => ({
      ...z,
      callout:
        z.id === "flashing"
          ? config.zoneCallouts.flashing
          : z.id === "attic-ventilation"
            ? config.zoneCallouts.atticVentilation
            : z.id === "ridge-cap"
              ? config.zoneCallouts.ridgeCap
              : z.id === "shingles"
                ? config.zoneCallouts.fieldShingles
                : z.id === "decking"
                  ? config.zoneCallouts.deckingUnderside
                  : null,
    }),
  );

  const shingleZonesWithCallouts: DiagramZone[] = SHINGLE_COMPONENT_ZONES.map(
    (z) => ({
      ...z,
      callout:
        z.id === "flashing"
          ? config.zoneCallouts.flashing
          : z.id === "ridge-cap"
            ? config.zoneCallouts.ridgeCap
            : z.id === "shingles"
              ? config.zoneCallouts.fieldShingles
              : null,
    }),
  );

  const atticZonesWithCallouts: DiagramZone[] = ATTIC_ZONES.map((z) => ({
    ...z,
    callout:
      z.id === "decking-underside"
        ? config.zoneCallouts.deckingUnderside
        : z.id === "ridge-vent"
          ? config.zoneCallouts.atticVentilation
          : null,
  }));

  const issuesList = issuesNoticed.filter((i) => i !== "None of the above");

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <section className="px-5 pt-16 pb-10 max-w-3xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-6 text-center">
          Scope Reports / Qntum Roofing
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary leading-tight mb-3 text-center">
          Hey {firstName}, here&apos;s what we found about El Paso roofs — and
          what it means for yours.
        </h1>

        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <span className="inline-flex items-center gap-1.5 bg-bg-elevated border border-border rounded-full px-3 py-1.5 text-xs text-text-secondary">
            <span className="text-[#F06B30]">■</span> {roofType} roof
          </span>
          {roofAge && (
            <span className="inline-flex items-center gap-1.5 bg-bg-elevated border border-border rounded-full px-3 py-1.5 text-xs text-text-secondary">
              <span className="text-[#F06B30]">■</span> {roofAge}
            </span>
          )}
          {issuesList.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-bg-elevated border border-border rounded-full px-3 py-1.5 text-xs text-text-secondary">
              <span className="text-warning-text">■</span> {issuesList.length}{" "}
              issue{issuesList.length !== 1 ? "s" : ""} noted
            </span>
          )}
        </div>

        {config.banner && (
          <div
            className={`mt-6 rounded-xl px-5 py-4 border ${
              config.banner.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-accent-blue/10 border-accent-blue/25"
            }`}
          >
            <p className="text-sm leading-relaxed text-text-primary">
              {config.banner.type === "warning" ? "⚠ " : "ℹ "}
              {config.banner.text}
            </p>
          </div>
        )}
      </section>

      {/* ── Section 1: Hidden Damage Timeline ────────────────────────── */}
      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>The Hidden Damage Timeline</SectionLabel>
          <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-xl">
            By the time you see it inside, it&apos;s already been years in the
            making. El Paso&apos;s UV index ranks among the highest in the
            nation — heat cycling and 297+ sunny days per year accelerate
            degradation faster than manufacturer ratings account for.
          </p>
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">
                Year
              </div>
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">
                Looks Like
              </div>
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">
                Happening Inside
              </div>
            </div>
            {TIMELINE.map((row, i) => (
              <div
                key={row.years}
                className={`grid grid-cols-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"}`}
              >
                <div className="px-4 py-3 text-sm font-semibold text-[#F06B30]">
                  {row.years}
                </div>
                <div className="px-4 py-3 text-sm text-success-text">
                  {row.visible}
                </div>
                <div className="px-4 py-3 text-sm text-error-text">
                  {row.hidden}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-l-2 border-[#F06B30] pl-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="text-[#F06B30] font-semibold">
                ⚠ El Paso Climate Reality:
              </span>{" "}
              A standard shingle installed here realistically performs 10–15
              years — not the 25 years on the box. That&apos;s why we install
              50-year warranted architectural shingles rated for this climate.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Where Roofs Actually Fail ─────────────────────── */}
      <section className="px-5 py-12">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Where Roofs Actually Fail</SectionLabel>
          <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-xl">
            Most inspections only check the field shingles — sometimes the
            ridge. There are 5 zones where roofs actually fail, and most of the
            serious ones are invisible from the ground. Tap any zone to learn
            more.
          </p>
          <InteractiveDiagram
            imagePath="/diagrams/failure-zones.png"
            imageAlt="5 zones where roofs fail"
            title="Tap a zone to learn what it means"
            zones={failureZonesWithCallouts}
          />
        </div>
      </section>

      {/* ── Section 3: El Paso Climate + Lifespan ────────────────────── */}
      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>El Paso Climate &amp; Roof Lifespan</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                stat: "Top 3 UV Index",
                body: "El Paso ranks among the top 3 cities nationally. Manufacturer lifespan ratings are based on national averages — El Paso is not average.",
              },
              {
                stat: "297 Sunny Days/Year",
                body: "vs. 205 nationally. Every one of those days is UV exposure breaking down granule adhesion on your roof surface.",
              },
              {
                stat: "150–172°F Roof Surface",
                body: "While air temps hit 104°F, roof surfaces reach 150–172°F in summer. Daily heat cycling stresses every seam and granule bond.",
              },
              {
                stat: "Up to 40% Shorter Lifespan",
                body: "A 3-tab shingle rated for 15–20 years realistically performs 10–15 years here. The climate matters more than the label.",
              },
            ].map(({ stat, body }) => (
              <div
                key={stat}
                className="border border-border bg-bg-base rounded-xl p-5"
              >
                <p className="text-[#F06B30] text-sm font-bold mb-2">{stat}</p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Shingle sections (Shingle or Both) ────────────── */}
      {isShingle && (
        <section className="px-5 py-12">
          <div className="max-w-3xl mx-auto">
            <SectionLabel>
              Shingle Roof — What You&apos;re Actually Working With
            </SectionLabel>
            <TabGroup
              tabs={[
                "Components",
                "Attic",
                "Old vs. New Tech",
                "What They Don't Tell You",
              ]}
            >
              {(active) => (
                <>
                  {active === 0 && (
                    <div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-6">
                        A shingle roof has 8 components. Most homeowners only
                        know about the shingles. Tap any zone to understand what
                        it does — and why it matters.
                      </p>
                      <InteractiveDiagram
                        imagePath="/diagrams/shingle-components.png"
                        imageAlt="Shingle roof components diagram"
                        title="Components of a shingle roof"
                        zones={shingleZonesWithCallouts}
                      />
                    </div>
                  )}
                  {active === 1 && (
                    <div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-6">
                        Most roofing companies never go into the attic. The
                        attic is where the real condition of your roof is
                        visible. Tap any zone to understand what we look for.
                      </p>
                      <InteractiveDiagram
                        imagePath="/diagrams/attic-components.png"
                        imageAlt="Attic components diagram"
                        title="What we find in the attic"
                        zones={atticZonesWithCallouts}
                      />
                    </div>
                  )}
                  {active === 2 && (
                    <div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-6">
                        The gap between a roof installed 12–15 years ago and
                        what&apos;s available now is significant in every
                        measurable category.
                      </p>
                      <div className="rounded-xl overflow-hidden border border-border">
                        <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">
                            Feature
                          </div>
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">
                            Old Standard
                          </div>
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">
                            Current
                          </div>
                        </div>
                        {SHINGLE_COMPARISON.map((row, i) => (
                          <div
                            key={row.feature}
                            className={`grid grid-cols-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"}`}
                          >
                            <div className="px-4 py-3 text-sm font-semibold text-text-primary">
                              {row.feature}
                            </div>
                            <div className="px-4 py-3 text-sm text-error-text">
                              {row.old}
                            </div>
                            <div className="px-4 py-3 text-sm text-success-text">
                              {row.current}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {active === 3 && (
                    <div className="space-y-4">
                      {DTTY.map(({ title, body, question }) => (
                        <div
                          key={title}
                          className="border border-border bg-bg-surface rounded-xl p-5"
                        >
                          <p className="text-text-primary font-semibold text-sm mb-2">
                            {title}
                          </p>
                          <p className="text-text-secondary text-sm leading-relaxed mb-3">
                            {body}
                          </p>
                          <p className="border-l-2 border-[#F06B30] pl-3 text-[#F06B30] text-sm italic leading-relaxed">
                            {question}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabGroup>
          </div>
        </section>
      )}

      {/* ── Section 5: Flat sections (Flat or Both) ───────────────────── */}
      {isFlat && (
        <section className={`px-5 py-12 ${isShingle ? "bg-bg-surface" : ""}`}>
          <div className="max-w-3xl mx-auto">
            <SectionLabel>
              Flat Roof — What You&apos;re Actually Working With
            </SectionLabel>
            <TabGroup
              tabs={[
                "Components",
                "Old vs. New Tech",
                "What They Don't Tell You",
              ]}
            >
              {(active) => (
                <>
                  {active === 0 && (
                    <div className="space-y-4">
                      {[
                        {
                          label: "EPDM / TPO Membrane",
                          body: "The primary waterproof layer. Susceptible to UV degradation, punctures, and seam failure over time.",
                        },
                        {
                          label: "Insulation Layer",
                          body: "Provides thermal separation and supports the membrane. Wet insulation compresses and loses R-value.",
                        },
                        {
                          label: "Roof Decking",
                          body: "Structural substrate beneath the insulation. Moisture from above or below leads to rot and structural risk.",
                        },
                        {
                          label: "Drains & Scuppers",
                          body: "Drainage points that prevent ponding. Blocked drains are the number one cause of flat roof failure.",
                        },
                        {
                          label: "Flashing & Edges",
                          body: "Seals at perimeters, penetrations, and walls. Most active leak points originate here.",
                        },
                        {
                          label: "Pitch Pockets",
                          body: "Sealed openings around pipes and equipment. Require periodic maintenance — frequently neglected.",
                        },
                      ].map(({ label, body }) => (
                        <div
                          key={label}
                          className="border border-border bg-bg-surface rounded-xl p-4"
                        >
                          <p className="text-text-primary font-semibold text-sm mb-1">
                            {label}
                          </p>
                          <p className="text-text-secondary text-sm leading-relaxed">
                            {body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {active === 1 && (
                    <div>
                      <p className="text-text-secondary text-sm leading-relaxed mb-6">
                        Flat roofing technology has evolved significantly.
                        Modern single-ply membranes outperform built-up systems
                        in heat resistance, lifespan, and seam reliability.
                      </p>
                      <div className="rounded-xl overflow-hidden border border-border">
                        <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">
                            Feature
                          </div>
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">
                            Old Standard
                          </div>
                          <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">
                            Current
                          </div>
                        </div>
                        {FLAT_COMPARISON.map((row, i) => (
                          <div
                            key={row.feature}
                            className={`grid grid-cols-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"}`}
                          >
                            <div className="px-4 py-3 text-sm font-semibold text-text-primary">
                              {row.feature}
                            </div>
                            <div className="px-4 py-3 text-sm text-error-text">
                              {row.old}
                            </div>
                            <div className="px-4 py-3 text-sm text-success-text">
                              {row.current}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {active === 2 && (
                    <div className="space-y-4">
                      {DTTY.map(({ title, body, question }) => (
                        <div
                          key={title}
                          className="border border-border bg-bg-surface rounded-xl p-5"
                        >
                          <p className="text-text-primary font-semibold text-sm mb-2">
                            {title}
                          </p>
                          <p className="text-text-secondary text-sm leading-relaxed mb-3">
                            {body}
                          </p>
                          <p className="border-l-2 border-[#F06B30] pl-3 text-[#F06B30] text-sm italic leading-relaxed">
                            {question}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabGroup>
          </div>
        </section>
      )}

      {/* ── Section 6: Scope Reports differentiator ───────────────────── */}
      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>How Scope Reports Works</SectionLabel>
          <h2 className="text-xl font-bold text-text-primary mb-6">
            Every inspection includes a full digital condition report
          </h2>
          <div className="space-y-3">
            {DIFFERENTIATORS.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="shrink-0 text-success-text font-bold text-sm mt-0.5">
                  ✓
                </span>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Inspection CTA section ────────────────────────────────────── */}
      <section ref={ctaRef} id="inspection-cta" className="px-5 pb-24 pt-20">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-5">
            Ready to find out?
          </p>
          <h2 className="text-2xl font-bold text-text-primary mb-3">
            Ready to find out what&apos;s actually on your roof?
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-2">
            Our inspectors go into the attic. Most don&apos;t.
          </p>
          <p className="text-text-hint text-sm mb-8">
            Free inspection. Same-day written report. No obligation.
          </p>
          <a
            href="/qualify"
            className="inline-block w-full py-4 rounded-lg text-base font-bold bg-[#F06B30] hover:bg-[#e05520] text-white transition-colors text-center"
          >
            Schedule My Free Inspection
          </a>
        </div>
      </section>

      {/* ── Sticky bottom CTA ─────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 bg-bg-elevated border-t border-border px-4 py-3 flex gap-3"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <a
          href="#inspection-cta"
          onClick={(e) => {
            e.preventDefault();
            ctaRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex-1 py-3 rounded-lg text-sm font-bold bg-[#F06B30] hover:bg-[#e05520] text-white transition-colors text-center"
        >
          Schedule My Free Inspection →
        </a>
        <a
          href={`/api/guide/pdf/${token}`}
          className="flex items-center gap-1.5 px-4 py-3 rounded-lg border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-border-hover transition-all whitespace-nowrap"
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          Save My Guide
        </a>
      </div>
    </>
  );
}
