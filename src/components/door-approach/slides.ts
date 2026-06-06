// All door approach slide content lives here.
// Copy, brand updates, zone coords — one-file change.

import type { DiagramZone } from "@/src/components/guide/InteractiveDiagram";

// ─── Slide type system ────────────────────────────────────────────────────────

export type SlideType =
  | "cover"
  | "timeline"
  | "diagram"
  | "stats"
  | "comparison"
  | "bullets"
  | "cta";

interface BaseSlide {
  id: string;
  type: SlideType;
  /** Short label shown in the progress indicator */
  label: string;
}

export interface CoverSlide extends BaseSlide {
  type: "cover";
  eyebrow: string;
  headline: string;
  sub: string;
  qrLabel: string;
}

export interface TimelineSlide extends BaseSlide {
  type: "timeline";
  header: string;
  eyebrow: string;
  headline: string;
  intro: string;
  keys: string[];
  rows: { years: string; visible: string; hidden: string }[];
  callout: {
    title: string;
    subtext: string;
  };
}

export interface DiagramSlide extends BaseSlide {
  type: "diagram";
  header: string;
  eyebrow: string;
  headline: string;
  intro: string;
  imagePath: string;
  imageAlt: string;
  diagramTitle: string;
  zones: DiagramZone[];
}

export interface StatsSlide extends BaseSlide {
  header: string;
  type: "stats";
  eyebrow: string;
  headline: string;
  stats: { stat: string; body: string }[];
  callout: {
    title: string;
    subtext: string;
  };
}

export interface ComparisonSlide extends BaseSlide {
  type: "comparison";
  header: string;
  eyebrow: string;
  headline: string;
  cols: [string, string, string];
  rows: { feature: string; old: string; current: string }[];
}

export interface BulletsSlide extends BaseSlide {
  type: "bullets";
  header: string;
  eyebrow: string;
  headline: string;
  items: { title: string; body: string; question: string }[];
}

export interface CtaSlide extends BaseSlide {
  type: "cta";
  header: string;
  eyebrow: string;
  headline: string;
  intro: string;
  items: string[];
  ctaText: string;
}

export type SlideData =
  | CoverSlide
  | TimelineSlide
  | DiagramSlide
  | StatsSlide
  | ComparisonSlide
  | BulletsSlide
  | CtaSlide;

// ─── Zone data ────────────────────────────────────────────────────────────────
// Coords calibrated 2026-05-24 against actual PNGs in /public/diagrams/.
// If PNGs are replaced, re-calibrate by tapping each numbered box
// at /roof-guide/[any-valid-slug] and verifying the correct panel opens.

const FAILURE_ZONE_ZONES: DiagramZone[] = [
  {
    id: "shingles",
    label: "1. Field Shingles",
    description:
      "Granule loss and UV damage start here — but rarely end here. Visible from the street but the least predictive of overall roof health.",
    hotspot: { x: 2.5, y: 27, width: 18, height: 19 },
  },
  {
    id: "ridge-cap",
    label: "2. Ridge Cap",
    description:
      "The peak of the roof concentrates the highest heat on the entire structure. First zone to fail. Last zone most inspectors check.",
    hotspot: { x: 60.25, y: 3, width: 18, height: 19 },
  },
  {
    id: "flashing",
    label: "3. Flashing & Seams",
    description:
      "Where the roof surface meets walls, vents, chimneys, and valleys. The single most common point of water intrusion on any roof.",
    hotspot: { x: 80.5, y: 27, width: 18, height: 19 },
  },
  {
    id: "decking",
    label: "4. Roof Decking",
    description:
      "The structural wood layer beneath everything else. Moisture here means the problem is already serious — and getting worse daily.",
    hotspot: { x: 80.5, y: 47.5, width: 18, height: 19 },
  },
  {
    id: "attic-ventilation",
    label: "5. Attic Ventilation",
    description:
      "The most overlooked failure zone on every roof. Poor attic ventilation traps heat and moisture — directly accelerating failure in every other zone simultaneously. Almost never included in a standard inspection.",
    hotspot: { x: 35.25, y: 54, width: 19.25, height: 20 },
  },
];

const SHINGLE_COMPONENT_ZONES: DiagramZone[] = [
  {
    id: "decking",
    label: "Roof Decking",
    description:
      "Structural wood layer. Foundation of everything above. Moisture here is critical.",
    hotspot: { x: 78.5, y: 39, width: 20.5, height: 13 },
  },
  {
    id: "underlayment",
    label: "Underlayment",
    description:
      "Waterproof barrier between decking and shingles. Your secondary defense if shingles fail.",
    hotspot: { x: 2, y: 53, width: 20.5, height: 13 },
  },
  {
    id: "ice-water",
    label: "Ice & Water Shield",
    description:
      "Waterproof membrane at eaves and valleys. Prevents wind-driven moisture from working under the shingles.",
    hotspot: { x: 2, y: 70.5, width: 20.5, height: 13 },
  },
  {
    id: "shingles",
    label: "Shingles",
    description:
      "Primary weather surface. Where most homeowners focus — but not where most failures start.",
    hotspot: { x: 2, y: 35.5, width: 20.5, height: 13 },
  },
  {
    id: "ridge-cap",
    label: "Ridge Cap",
    description:
      "Seals the peak. Highest heat exposure on the entire roof surface.",
    hotspot: { x: 2, y: 19.5, width: 20.5, height: 11.5 },
  },
  {
    id: "flashing",
    label: "Flashing",
    description:
      "Metal seals at walls, vents, chimneys. Single most common active leak point on any roof.",
    hotspot: { x: 78.5, y: 18, width: 20.5, height: 13 },
  },
  {
    id: "drip-edge",
    label: "Drip Edge",
    description:
      "Directs water off the roof edge into the gutter. Frequently skipped on lower-cost installations.",
    hotspot: { x: 78.5, y: 60, width: 20.5, height: 13 },
  },
  {
    id: "gutters",
    label: "Gutters",
    description:
      "Final drainage. Failure causes fascia rot, soffit damage, and foundation issues over time.",
    hotspot: { x: 78.5, y: 80, width: 20.5, height: 13 },
  },
];

const ATTIC_ZONES: DiagramZone[] = [
  {
    id: "decking-underside",
    label: "Decking Underside",
    description:
      "Moisture staining here signals active water intrusion invisible from the exterior. This is the first thing we look for when we go up.",
    hotspot: { x: 2.5, y: 17, width: 22.5, height: 17 },
  },
  {
    id: "rafters",
    label: "Rafters",
    description:
      "Structural framing members supporting the entire roof load. Compromised rafters are a safety issue — not just a roofing issue.",
    hotspot: { x: 1, y: 37, width: 17.25, height: 20 },
  },
  {
    id: "insulation",
    label: "Insulation",
    description:
      "Wet or compressed insulation signals long-term moisture damage — plus a utility bill problem you're already paying for.",
    hotspot: { x: 35, y: 80, width: 19.5, height: 17.5 },
  },
  {
    id: "soffit-vents",
    label: "Soffit Vents",
    description:
      "Intake vents that allow outside air into the attic. Blocked soffits trap heat and directly accelerate shingle failure above.",
    hotspot: { x: 2, y: 78, width: 17.5, height: 20 },
  },
  {
    id: "ridge-vent",
    label: "Ridge Vent",
    description:
      "Exhaust point for hot attic air. A failed ridge vent turns your attic into an oven and voids most manufacturer warranties.",
    hotspot: { x: 59, y: 2, width: 20, height: 18 },
  },
  {
    id: "vapor-barrier",
    label: "Vapor Barrier",
    description:
      "Prevents condensation from forming inside the attic. Missing in many older El Paso homes.",
    hotspot: { x: 80, y: 29, width: 19, height: 18 },
  },
];

// ─── Shingle deck ─────────────────────────────────────────────────────────────

export const SHINGLE_SLIDES: SlideData[] = [
  // Cover
  {
    id: "cover",
    type: "cover",
    label: "Cover",
    eyebrow: "Scope Reports / Qntum Roofing",
    headline: "Get your personalized Roof Health Guide.",
    sub: "What your roof is hiding - and what tro do about it.",
    qrLabel: "Scan to get your FREE personalized guide",
  },

  // 01 — Hidden Damage Timeline
  {
    id: "01",
    type: "timeline",
    label: "01",
    header: "WHY WAITING COSTS MORE THAN ACTING",
    eyebrow: "The Hidden Damage Timeline",
    headline:
      "By the time you see it inside, it's already been years in the making",
    intro:
      "El Paso's UV index ranks among the highest in the nation. Heat cycling, monsoon stress, and 297+ sunny days per year accelerate roof degradation significantly faster than national manufacturer ratings account for.",
    keys: ["YEAR", "LOOKS LIKE", "HAPPENING INSIDE"],
    rows: [
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
    ],
    callout: {
      title: "⚠ El Paso Climate Reality",
      subtext:
        "A standard shingle here realistically performs 10–15 years — not the 25 years on the box. That's why we install 50-year warranted architectural shingles rated for this climate.",
    },
  },

  // 02 — Where Roofs Actually Fail (diagram)
  {
    id: "02",
    type: "diagram",
    label: "02",

    header: "THE 5 FAILURE ZONES — MOST INSPECTIONS CHECK ONLY 2",
    eyebrow: "Where Roofs Actually Fail",
    headline: "Most inspections only check 2 of these 5 failure zones",
    intro:
      "Most companies only look at the field shingles - sometimes the ridge. There are 5 zones where roofs actually fail, and most of the serious ones are invisible from the ground. Tap any zone.",
    imagePath: "/diagrams/failure-zones.png",
    imageAlt: "5 zones where roofs fail",
    diagramTitle: "Tap a zone to learn what it means",
    zones: FAILURE_ZONE_ZONES,
  },

  // 03 — El Paso Climate stats
  {
    id: "03",
    header: "WHY EL PASO IS DIFFERENT FROM EVERYWHERE ELSE",
    type: "stats",
    label: "03",
    eyebrow: "El Paso Climate + Roof Lifespan",
    headline: "Your roof was rated for a different climate",
    stats: [
      {
        stat: "Top 3",
        body: "UV Index Nationally",
      },
      {
        stat: "297",
        body: "Sunny days per year",
      },
      {
        stat: "#1",
        body: "Lifespan reduction on standard shingles",
      },
    ],
    callout: {
      title: "⚠  What This Means for Your Home",
      subtext:
        "Older 3-tab shingles installed in El Paso realistically perform 10–15 years due to UV cycling, summer heat extremes, and monsoon moisture stress. Qntum installs 50-year warranted architectural shingles — built to handle this climate.",
    },
  },

  // 04 — Shingle Components (diagram)
  {
    id: "04",
    type: "diagram",
    label: "04",
    header: "KNOW WHAT'S PROTECTING YOUR HOME",
    eyebrow: "Components of a Shingle Roof",
    headline: "Components of a shingle roof - what we inspect in every zone",
    intro:
      "A shingle roof has 8 components. Most homeowners - and most inspectors - only talk about the shingles. Everything beneath them determines how long the roof actually lasts. Tap any zone.",
    imagePath: "/diagrams/shingle-components.png",
    imageAlt: "Shingle roof components diagram",
    diagramTitle: "Components of a shingle roof",
    zones: SHINGLE_COMPONENT_ZONES,
  },

  // 05 — Attic (diagram)
  {
    id: "05",
    type: "diagram",
    label: "05",
    header: "WHERE THE REAL STORY LIVES - WHAT MOST ROOFERS SKIP",
    eyebrow: "Components of an Attic",
    headline: "Most roofing companies never go into the attic",
    intro:
      "The attic is where the real condition of your roof is visible - moisture staining, ventilation failure, insulation damage, rafter condition. None of that is visible from the ground or the street. Tap any zone.",
    imagePath: "/diagrams/attic-components.png",
    imageAlt: "Attic components diagram",
    diagramTitle: "What we look for in the attic",
    zones: ATTIC_ZONES,
  },

  // 06 — Old vs New Technology (comparison)
  {
    id: "06",
    type: "comparison",
    label: "06",
    header: "WHAT WAS STANDARD 15 YEARS AGO IS NOT STANDARD ANYMORE",
    eyebrow: "Old Technology vs. Current Standards",
    headline: "The gap is significant in every measurable category.",
    cols: ["Feature", "Old Standard (3-Tab)", "Current (Architectural/IR)"],
    rows: [
      { feature: "Wind rating", old: "60 - 70 mph", current: "130+ mph" },
      {
        feature: "Lifespan (rated)",
        old: "15 - 20 years",
        current: "50 years",
      },
      {
        feature: "Lifespan in El Paso",
        old: "10 - 15 years (if not voided)",
        current: "50 years",
      },
      {
        feature: "UV resistance",
        old: "Standard granules - degrades rapidly",
        current: "UV-reflective, algae-resistant coating",
      },
      {
        feature: "Warranty validity",
        old: "Often voided by heat cycling",
        current: "Climate-rated options available",
      },
      {
        feature: "Warranty",
        old: "20 - 25 year warranty (if not voided)",
        current: "50 - year warranty",
      },
      {
        feature: "Thickness",
        old: "Single layer - minimal impact protection",
        current: "Multi-layer laminate - hail and impact rated",
      },
    ],
  },

  // 07 — What They Don't Tell You (bullets)
  {
    id: "07",
    type: "bullets",
    label: "07",
    header: "THREE THINGS YOUR LAST ROOFER PROBABLY DIDN'T MENTION",
    eyebrow: "What They Don't Tell You - Shingles",
    headline: "Are you asking the right questions?",
    items: [
      {
        title: "The warranty problem",
        body: "Most homeowners assume their roof is under warranty. In most cases it never was — if shingles weren't installed precisely to the manufacturer's specification, the warranty was void from day one.",
        question:
          "When's the last time someone confirmed your installation was to spec?",
      },
      {
        title: "It can look fine and be failing",
        body: "A roof can look completely fine from the street and already be past the point where it should have been replaced. Decking condition, ventilation, and underlayment — none of that is visible from the ground.",
        question: "If you couldn't see it from the street, how would you know?",
      },
      {
        title: "That stain is not where the problem is",
        body: "Water stains inside the house show up at the lowest point water travels to — not where it entered. The actual entry point is almost always somewhere else on the roof entirely.",
        question:
          "Have you traced it back, or are you still guessing where it started?",
      },
    ],
  },

  // 11 — How Scope Reports Works (CTA / close)
  {
    id: "11",
    type: "cta",
    label: "11",
    header: "WHAT YOU GET — THAT NOBODY ELSE IN EL PASO PROVIDES",
    eyebrow: "The Scope Reports Difference",
    headline: "Every inspection includes a full digital condition report.",
    intro:
      "Not a verbal summary. Not a handwritten note. A documented report with photos of every finding — organized by roof zone, delivered digitally, yours to keep, share, and reference.",
    items: [
      "We go into the attic. Most companies don't. That's where the real condition of your roof is visible.",
      "Full digital condition report — photos by zone, condition ratings, attic findings delivered same day.",
      "Same-day written report — a document you keep, not a verbal summary.",
      "50-year warranted architectural shingles when the installation meets manufacturer spec.",
      "El Paso climate expertise — we know how this market ages roofs differently.",
    ],
    ctaText: "Free inspection. Same-day written report. No obligation.",
  },
];

// ─── Flat deck — stub ─────────────────────────────────────────────────────────
// Populate when the Flat presentation is ready.
// Suggested order: Cover, 08 (Flat components), 09 (Old vs New), 10 (DTTY), 11 (CTA)

export const FLAT_SLIDES: SlideData[] = [];

// ─── Both deck — stub ─────────────────────────────────────────────────────────
// Populate when the Both presentation is ready.
// Suggested order: Cover, 01 (Timeline), 02 (Failure zones), 03 (Climate),
//   04 (Shingle components), 05 (Attic), 06 (Shingle comparison),
//   08 (Flat components), 09 (Flat comparison), 10 (DTTY), 11 (CTA)

export const BOTH_SLIDES: SlideData[] = [];
