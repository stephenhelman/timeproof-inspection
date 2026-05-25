import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import React from "react";
import path from "path";

// ─── Colors ────────────────────────────────────────────────────────────────────
const NAVY = "#0F1E3C";
const ORANGE = "#F06B30";
const BODY = "#374151";
const MUTED = "#64748b";
const HINT = "#94a3b8";
const CARD_BG = "#f8fafc";

// ─── Asset paths ──────────────────────────────────────────────────────────────
const LOGO_PATHS = {
  scopeReports: path.join(
    process.cwd(),
    "public/sr_logo_light_transparent.png",
  ),
  qntum: path.join(process.cwd(), "public/qntum_logo_light_transparent.png"),
};

const DIAGRAM_PATHS = {
  failureZones: path.join(
    process.cwd(),
    "public/diagrams/failure-zones-original.png",
  ),
  shingleComponents: path.join(
    process.cwd(),
    "public/diagrams/shingle-components-original.png",
  ),
  atticComponents: path.join(
    process.cwd(),
    "public/diagrams/attic-components-original.png",
  ),
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Pages
  contentPage: { fontFamily: "Helvetica", backgroundColor: "white" },
  coverPage: { fontFamily: "Helvetica", backgroundColor: "white" },

  // Content area on all content pages
  contentArea: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 24 },

  // Section headings
  heading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headingOrange: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  // Body text
  intro: { fontSize: 9.5, color: BODY, lineHeight: 1.6, marginBottom: 12 },

  // Generic card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0",
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 4,
  },
  cardBody: { fontSize: 9.5, color: BODY, lineHeight: 1.6 },

  // Stat card (orange left border)
  statCard: {
    backgroundColor: CARD_BG,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    marginBottom: 4,
  },

  // Table
  tableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeadCell: {
    fontSize: 8,
    color: "white",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableCell: { fontSize: 9, color: BODY, lineHeight: 1.4 },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    lineHeight: 1.4,
  },

  // Warning / callout box
  callout: {
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    backgroundColor: "#fff7ed",
    padding: 12,
    borderRadius: 4,
    marginTop: 10,
  },
  calloutText: { fontSize: 8.5, color: "#92400e", lineHeight: 1.6 },

  // Differentiator list
  diffItem: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  diffCheck: {
    fontSize: 10,
    color: "#16a34a",
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    width: 12,
  },
  diffText: { flex: 1, fontSize: 9.5, color: BODY, lineHeight: 1.5 },

  // Diagram image
  diagram: { width: "100%", marginTop: 12, marginBottom: 16 },
});

// ─── Shared header ────────────────────────────────────────────────────────────
// Appears on every content page (not the cover).
function makePdfHeader() {
  return React.createElement(
    View,
    {
      style: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: NAVY,
        paddingHorizontal: 24,
        paddingVertical: 10,
      },
    },
    // Scope Reports logo (full wordmark — replaces text label)
    React.createElement(Image, {
      src: LOGO_PATHS.scopeReports,
      style: { height: 16, marginRight: 12 },
    }),
    // Divider
    React.createElement(View, {
      style: {
        width: 1,
        height: 14,
        backgroundColor: "rgba(255,255,255,0.2)",
        marginRight: 10,
      },
    }),
    // "POWERED BY"
    React.createElement(
      Text,
      {
        style: {
          color: "rgba(255,255,255,0.45)",
          fontSize: 7,
          letterSpacing: 1,
          marginRight: 6,
        },
      },
      "POWERED BY",
    ),
    // Qntum logo (PNG — SVG not supported by @react-pdf/renderer)
    React.createElement(Image, {
      src: LOGO_PATHS.qntum,
      style: { height: 13 },
    }),
    // Spacer
    React.createElement(View, { style: { flex: 1 } }),
    // Page number
    React.createElement(Text, {
      style: { color: "rgba(255,255,255,0.35)", fontSize: 8 },
      render: ({
        pageNumber,
        totalPages,
      }: {
        pageNumber: number;
        totalPages: number;
      }) => `${pageNumber} / ${totalPages}`,
    }),
  );
}

// ─── Static content ───────────────────────────────────────────────────────────
export interface GuideJWTPayload {
  leadId: string;
  roofType: string;
  roofAge: string;
  issuesNoticed: string[];
  firstName: string;
}

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

const FAILURE_ZONES = [
  {
    label: "1. Field Shingles",
    body: "Granule loss and UV damage start here — but rarely end here. Visible from the street but the least predictive of overall roof health.",
  },
  {
    label: "2. Ridge Cap",
    body: "The peak of the roof concentrates the highest heat on the entire structure. First zone to fail. Last zone most inspectors check.",
  },
  {
    label: "3. Flashing & Seams",
    body: "Where the roof surface meets walls, vents, chimneys, and valleys. The single most common point of water intrusion on any roof.",
  },
  {
    label: "4. Roof Decking",
    body: "The structural wood layer beneath everything else. Moisture here means the problem is already serious — and getting worse daily.",
  },
  {
    label: "5. Attic Ventilation",
    body: "The most overlooked failure zone. Poor attic ventilation traps heat and moisture — directly accelerating failure in every other zone simultaneously. Almost never included in a standard inspection.",
  },
];

const SHINGLE_COMPONENTS = [
  {
    label: "Roof Decking",
    body: "Structural wood layer. Foundation of everything above. Moisture here is critical.",
  },
  {
    label: "Underlayment",
    body: "Waterproof barrier between decking and shingles. Your secondary defense if shingles fail.",
  },
  {
    label: "Ice & Water Shield",
    body: "Waterproof membrane at eaves and valleys. Prevents wind-driven moisture from working under the shingles.",
  },
  {
    label: "Shingles",
    body: "Primary weather surface. Where most homeowners focus — but not where most failures start.",
  },
  {
    label: "Ridge Cap",
    body: "Seals the peak. Highest heat exposure on the entire roof surface.",
  },
  {
    label: "Flashing",
    body: "Metal seals at walls, vents, chimneys. Single most common active leak point on any roof.",
  },
  {
    label: "Drip Edge",
    body: "Directs water off the roof edge into the gutter. Frequently skipped on lower-cost installations.",
  },
  {
    label: "Gutters",
    body: "Final drainage. Failure causes fascia rot, soffit damage, and foundation issues over time.",
  },
];

const ATTIC_COMPONENTS = [
  {
    label: "Decking Underside",
    body: "Moisture staining here signals active water intrusion invisible from the exterior. The first thing we look for when we go up.",
  },
  {
    label: "Rafters",
    body: "Structural framing members supporting the entire roof load. Compromised rafters are a safety issue — not just a roofing issue.",
  },
  {
    label: "Insulation",
    body: "Wet or compressed insulation signals long-term moisture damage — plus a utility bill problem you are already paying for.",
  },
  {
    label: "Soffit Vents",
    body: "Intake vents that allow outside air into the attic. Blocked soffits trap heat and directly accelerate shingle failure above.",
  },
  {
    label: "Ridge Vent",
    body: "Exhaust point for hot attic air. A failed ridge vent turns your attic into an oven and voids most manufacturer warranties.",
  },
  {
    label: "Vapor Barrier",
    body: "Prevents condensation from forming inside the attic. Missing in many older El Paso homes.",
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

const FLAT_COMPONENTS = [
  {
    label: "EPDM / TPO Membrane",
    body: "The primary waterproof layer on a flat roof. Susceptible to UV degradation, punctures, and seam failure over time.",
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
    body: "Drainage points that prevent ponding water. Blocked drains are the number one cause of flat roof failure.",
  },
  {
    label: "Flashing & Edges",
    body: "Seals at perimeters, penetrations, and walls. Most active leak points on a flat roof originate here.",
  },
  {
    label: "Pitch Pockets",
    body: "Sealed openings around pipes and equipment. Require periodic maintenance — frequently neglected.",
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
  "Most homeowners assume their roof is under warranty. In most cases the warranty was never valid — if shingles were not installed precisely to the manufacturer's specification, it was void from day one.",
  "A roof that looks fine from the street can already be past its functional life. UV degradation, decking moisture, and ventilation failure all progress invisibly. The street view tells you almost nothing.",
  "Interior ceiling stains appear at the lowest point water travels to — not at the entry point. The source is almost always somewhere else on the roof. By the time you see it inside, it has been active for a while.",
];

const DIFFERENTIATORS = [
  "Full digital condition report — photos by zone, condition ratings, attic findings",
  "We go into the attic. Most companies don't. That's where the real condition of your roof is visible.",
  "Same-day written report — you get a document you keep, not a verbal summary",
  "50-year warranted architectural shingles when installation meets manufacturer spec",
  "El Paso climate expertise — we know how this market ages roofs differently",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(label: string, body: string, key: string, statStyle = false) {
  return React.createElement(
    View,
    { key, wrap: false, style: statStyle ? S.statCard : S.card },
    React.createElement(
      Text,
      { style: statStyle ? S.statLabel : S.cardLabel },
      label,
    ),
    React.createElement(Text, { style: S.cardBody }, body),
  );
}

function comparisonTable(
  cols: [string, string, string],
  rows: { feature: string; old: string; current: string }[],
) {
  return React.createElement(
    View,
    { style: { marginBottom: 12 } },
    // Header
    React.createElement(
      View,
      { style: S.tableHead },
      React.createElement(
        Text,
        { style: [S.tableHeadCell, { flex: 1.2 }] },
        cols[0],
      ),
      React.createElement(
        Text,
        { style: [S.tableHeadCell, { flex: 2 }] },
        cols[1],
      ),
      React.createElement(
        Text,
        { style: [S.tableHeadCell, { flex: 2 }] },
        cols[2],
      ),
    ),
    // Rows
    ...rows.map((r, i) =>
      React.createElement(
        View,
        {
          key: r.feature,
          wrap: false,
          style: [
            S.tableRow,
            { backgroundColor: i % 2 === 0 ? CARD_BG : "white" },
          ],
        },
        React.createElement(
          Text,
          { style: [S.tableCellBold, { flex: 1.2 }] },
          r.feature,
        ),
        React.createElement(
          Text,
          { style: [S.tableCell, { flex: 2, color: "#dc2626" }] },
          r.old,
        ),
        React.createElement(
          Text,
          { style: [S.tableCell, { flex: 2, color: "#16a34a" }] },
          r.current,
        ),
      ),
    ),
  );
}

// ─── PDF generator ────────────────────────────────────────────────────────────
export async function generateGuidePdf(
  payload: GuideJWTPayload,
): Promise<Buffer> {
  const { firstName, roofType, roofAge, issuesNoticed } = payload;
  const issuesList = issuesNoticed.filter((i) => i !== "None of the above");
  const isShingle = roofType === "Shingle" || roofType === "Both";
  const isFlat = roofType === "Flat" || roofType === "Both";
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const doc = React.createElement(
    Document,
    null,

    // ── Cover page ─────────────────────────────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: S.coverPage },

      // Top header — matches every other page
      makePdfHeader(),

      // White content area
      React.createElement(
        View,
        { style: { paddingHorizontal: 40, paddingTop: 36, flex: 1 } },

        // Location tag
        React.createElement(
          Text,
          {
            style: {
              fontSize: 9,
              color: ORANGE,
              letterSpacing: 2,
              marginBottom: 8,
            },
          },
          "EL PASO, TX",
        ),

        // Title
        React.createElement(
          Text,
          {
            style: {
              fontSize: 28,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              lineHeight: 1.2,
              marginBottom: 4,
            },
          },
          "Personalized",
        ),
        React.createElement(
          Text,
          {
            style: {
              fontSize: 28,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              lineHeight: 1.2,
              marginBottom: 4,
            },
          },
          "Roof Health Guide",
        ),

        // Subtitle
        React.createElement(
          Text,
          { style: { fontSize: 12, color: MUTED, marginBottom: 28 } },
          "What your roof is hiding — and what to do about it",
        ),

        // Orange divider
        React.createElement(View, {
          style: {
            width: 40,
            height: 3,
            backgroundColor: ORANGE,
            marginBottom: 28,
          },
        }),

        // Prepared for
        React.createElement(
          Text,
          {
            style: {
              fontSize: 9,
              color: HINT,
              letterSpacing: 1,
              marginBottom: 6,
            },
          },
          "PREPARED FOR",
        ),
        React.createElement(
          Text,
          {
            style: {
              fontSize: 20,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              marginBottom: 28,
            },
          },
          firstName,
        ),

        // Roof profile card
        React.createElement(
          View,
          {
            style: {
              backgroundColor: CARD_BG,
              borderRadius: 8,
              padding: 16,
              borderLeftWidth: 3,
              borderLeftColor: ORANGE,
              marginBottom: 24,
            },
          },
          React.createElement(
            Text,
            {
              style: {
                fontSize: 8,
                color: HINT,
                letterSpacing: 1,
                marginBottom: 10,
              },
            },
            "YOUR ROOF PROFILE",
          ),
          React.createElement(
            View,
            {
              style: {
                flexDirection: "row" as const,
                marginBottom: roofAge ? 8 : 0,
              },
            },
            React.createElement(
              View,
              { style: { marginRight: 32 } },
              React.createElement(
                Text,
                { style: { fontSize: 8, color: HINT, marginBottom: 2 } },
                "ROOF TYPE",
              ),
              React.createElement(
                Text,
                {
                  style: {
                    fontSize: 11,
                    fontFamily: "Helvetica-Bold",
                    color: NAVY,
                  },
                },
                roofType,
              ),
            ),
            roofAge
              ? React.createElement(
                  View,
                  null,
                  React.createElement(
                    Text,
                    { style: { fontSize: 8, color: HINT, marginBottom: 2 } },
                    "ESTIMATED AGE",
                  ),
                  React.createElement(
                    Text,
                    {
                      style: {
                        fontSize: 11,
                        fontFamily: "Helvetica-Bold",
                        color: NAVY,
                      },
                    },
                    roofAge,
                  ),
                )
              : null,
          ),
          issuesList.length > 0
            ? React.createElement(
                View,
                { style: { marginTop: 8 } },
                React.createElement(
                  Text,
                  { style: { fontSize: 8, color: HINT, marginBottom: 4 } },
                  "ISSUES REPORTED",
                ),
                React.createElement(
                  Text,
                  { style: { fontSize: 9.5, color: NAVY, lineHeight: 1.4 } },
                  issuesList.join(", "),
                ),
              )
            : null,
        ),

        // Footer note
        React.createElement(
          Text,
          { style: { fontSize: 9, color: HINT, lineHeight: 1.5 } },
          "This guide was generated based on what you told us about your roof. The sections below explain what El Paso’s climate does to roofs — and what the symptoms you reported may mean.",
        ),
      ),

      // Bottom navy bar
      React.createElement(
        View,
        {
          style: {
            backgroundColor: NAVY,
            paddingHorizontal: 40,
            paddingVertical: 12,
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            alignItems: "center" as const,
          },
        },
        React.createElement(
          Text,
          { style: { color: "rgba(255,255,255,0.4)", fontSize: 8 } },
          "scopereports.com",
        ),
        React.createElement(
          Text,
          { style: { color: "rgba(255,255,255,0.4)", fontSize: 8 } },
          date,
        ),
      ),
    ),

    // ── Page: Hidden Damage Timeline ──────────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: S.contentPage },
      makePdfHeader(),
      React.createElement(
        View,
        { style: S.contentArea },
        React.createElement(
          Text,
          { style: S.heading },
          "The Hidden Damage Timeline",
        ),
        React.createElement(
          Text,
          { style: S.intro },
          "By the time you see it inside, it’s already been years in the making. El Paso’s UV index ranks among the highest in the nation. Heat cycling, monsoon stress, and 297+ sunny days per year accelerate roof degradation significantly faster than national ratings account for.",
        ),

        // Timeline table
        React.createElement(
          View,
          { style: { marginBottom: 12 } },
          // Header
          React.createElement(
            View,
            { style: S.tableHead },
            React.createElement(
              Text,
              { style: [S.tableHeadCell, { flex: 1 }] },
              "YEAR",
            ),
            React.createElement(
              Text,
              { style: [S.tableHeadCell, { flex: 2 }] },
              "LOOKS LIKE",
            ),
            React.createElement(
              Text,
              { style: [S.tableHeadCell, { flex: 3 }] },
              "HAPPENING INSIDE",
            ),
          ),
          // Rows
          ...TIMELINE.map((row, i) =>
            React.createElement(
              View,
              {
                key: row.years,
                wrap: false,
                style: [
                  S.tableRow,
                  { backgroundColor: i % 2 === 0 ? CARD_BG : "white" },
                ],
              },
              React.createElement(
                Text,
                {
                  style: [
                    S.tableCell,
                    { flex: 1, color: ORANGE, fontFamily: "Helvetica-Bold" },
                  ],
                },
                row.years,
              ),
              React.createElement(
                Text,
                { style: [S.tableCell, { flex: 2, color: "#16a34a" }] },
                row.visible,
              ),
              React.createElement(
                Text,
                { style: [S.tableCell, { flex: 3, color: "#dc2626" }] },
                row.hidden,
              ),
            ),
          ),
        ),

        // Climate reality callout
        React.createElement(
          View,
          { wrap: false, style: S.callout },
          React.createElement(
            Text,
            { style: S.calloutText },
            "⚠ El Paso Climate Reality: A standard shingle installed here realistically performs 10–15 years — not the 25 years on the box. That’s why we install 50-year warranted architectural shingles rated for this climate.",
          ),
        ),
      ),
    ),

    // ── Page: Where Roofs Actually Fail ──────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: S.contentPage },
      makePdfHeader(),
      React.createElement(
        View,
        { style: S.contentArea },

        // Heading + diagram wrapped together to prevent orphaned heading
        React.createElement(
          View,
          { wrap: false },
          React.createElement(
            Text,
            { style: S.heading },
            "Where Roofs Actually Fail — 5 Zones",
          ),
          React.createElement(
            Text,
            { style: S.intro },
            "Most inspections only check field shingles — sometimes the ridge. There are 5 zones where roofs actually fail, and most of the serious ones are invisible from the ground.",
          ),
          React.createElement(Image, {
            src: DIAGRAM_PATHS.failureZones,
            style: S.diagram,
          }),
        ),

        // Zone cards — each with wrap={false}
        ...FAILURE_ZONES.map((z) => card(z.label, z.body, z.label)),
      ),
    ),

    // ── Page: El Paso Climate + Lifespan ─────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: S.contentPage },
      makePdfHeader(),
      React.createElement(
        View,
        { style: S.contentArea },
        React.createElement(
          Text,
          { style: S.heading },
          "El Paso Climate & Roof Lifespan",
        ),
        ...[
          [
            "Top 3 UV Index Nationally",
            "El Paso ranks among the top three cities in the country for UV index. Manufacturer lifespan ratings are based on national averages — El Paso is not average.",
          ],
          [
            "297 Sunny Days Per Year",
            "El Paso averages 297 sunny days per year versus the national average of 205. Every one of those days is UV exposure breaking down granule adhesion.",
          ],
          [
            "Roof Surface Temps Reach 150–172°F",
            "While air temps hit 104°F, roof surfaces reach 150–172°F in peak summer months. Daily heat cycling between extreme highs and cooler nights expands and contracts shingle material — breaking down adhesion and stressing every seam.",
          ],
          [
            "Standard Shingles Lose Up to 40% of Rated Lifespan",
            "A 3-tab shingle rated for 15–20 years realistically performs 10–15 years in El Paso. This is why Qntum installs 50-year warranted architectural shingles.",
          ],
        ].map(([label, body]) => card(label, body, label, true)),
      ),
    ),

    // ── Shingle pages ─────────────────────────────────────────────────────────
    ...(isShingle
      ? [
          // Shingle components
          React.createElement(
            Page,
            { size: "LETTER", style: S.contentPage, key: "shingle-components" },
            makePdfHeader(),
            React.createElement(
              View,
              { style: S.contentArea },
              React.createElement(
                View,
                { wrap: false },
                React.createElement(
                  Text,
                  { style: S.heading },
                  "Components of a Shingle Roof",
                ),
                React.createElement(
                  Text,
                  { style: S.intro },
                  "A shingle roof has 8 components. Most homeowners only know about the shingles.",
                ),
                React.createElement(Image, {
                  src: DIAGRAM_PATHS.shingleComponents,
                  style: S.diagram,
                }),
              ),
              ...SHINGLE_COMPONENTS.map((c) => card(c.label, c.body, c.label)),
            ),
          ),

          // Attic components
          React.createElement(
            Page,
            { size: "LETTER", style: S.contentPage, key: "shingle-attic" },
            makePdfHeader(),
            React.createElement(
              View,
              { style: S.contentArea },
              React.createElement(
                View,
                { wrap: false },
                React.createElement(
                  Text,
                  { style: S.heading },
                  "Components of an Attic",
                ),
                React.createElement(
                  Text,
                  { style: S.intro },
                  "Most roofing companies never go into the attic. The attic is where the real condition of the roof is visible — moisture staining, ventilation failure, insulation damage, and rafter condition are all only visible from inside.",
                ),
                React.createElement(Image, {
                  src: DIAGRAM_PATHS.atticComponents,
                  style: S.diagram,
                }),
              ),
              ...ATTIC_COMPONENTS.map((c) => card(c.label, c.body, c.label)),
            ),
          ),

          // Old vs new + DTTY
          React.createElement(
            Page,
            { size: "LETTER", style: S.contentPage, key: "shingle-comparison" },
            makePdfHeader(),
            React.createElement(
              View,
              { style: S.contentArea },
              React.createElement(
                Text,
                { style: S.heading },
                "Old Technology vs. Current Standards",
              ),
              comparisonTable(
                ["FEATURE", "OLD STANDARD (3-TAB)", "CURRENT (ARCHITECTURAL)"],
                SHINGLE_COMPARISON,
              ),
              React.createElement(
                Text,
                { style: [S.headingOrange, { marginTop: 8 }] },
                "What They Don’t Tell You",
              ),
              ...DTTY.map((text, i) =>
                React.createElement(
                  View,
                  { key: i, wrap: false, style: S.card },
                  React.createElement(Text, { style: S.cardBody }, text),
                ),
              ),
            ),
          ),
        ]
      : []),

    // ── Flat pages ───────────────────────────────────────────────────────────
    ...(isFlat
      ? [
          React.createElement(
            Page,
            { size: "LETTER", style: S.contentPage, key: "flat-components" },
            makePdfHeader(),
            React.createElement(
              View,
              { style: S.contentArea },
              React.createElement(
                Text,
                { style: S.heading },
                "Components of a Flat Roof",
              ),
              ...FLAT_COMPONENTS.map((c) => card(c.label, c.body, c.label)),
              React.createElement(
                Text,
                { style: [S.heading, { marginTop: 12 }] },
                "Old Technology vs. Current Standards",
              ),
              comparisonTable(
                ["FEATURE", "OLD STANDARD", "CURRENT"],
                FLAT_COMPARISON,
              ),
              React.createElement(
                Text,
                { style: [S.headingOrange, { marginTop: 8 }] },
                "What They Don’t Tell You",
              ),
              ...DTTY.map((text, i) =>
                React.createElement(
                  View,
                  { key: i, wrap: false, style: S.card },
                  React.createElement(Text, { style: S.cardBody }, text),
                ),
              ),
            ),
          ),
        ]
      : []),

    // ── Final page: Scope Reports differentiator ──────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: S.contentPage },
      makePdfHeader(),
      React.createElement(
        View,
        { style: S.contentArea },
        React.createElement(
          Text,
          { style: S.heading },
          "Every Inspection Includes a Full Digital Condition Report",
        ),
        React.createElement(
          Text,
          { style: [S.intro, { marginBottom: 16 }] },
          "We don’t do verbal summaries. Every Qntum inspection produces a written, documented report you keep — photos, findings, and attic results by zone.",
        ),
        ...DIFFERENTIATORS.map((item) =>
          React.createElement(
            View,
            { key: item, wrap: false, style: S.diffItem },
            React.createElement(Text, { style: S.diffCheck }, "✓"),
            React.createElement(Text, { style: S.diffText }, item),
          ),
        ),
        React.createElement(
          View,
          { wrap: false, style: [S.callout, { marginTop: 20 }] },
          React.createElement(
            Text,
            {
              style: [
                S.calloutText,
                { fontFamily: "Helvetica-Bold", marginBottom: 4 },
              ],
            },
            "Schedule your free inspection",
          ),
          React.createElement(
            Text,
            { style: S.calloutText },
            "scopereports.com",
          ),
        ),
      ),
    ),
  );

  const blob = await pdf(doc).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
