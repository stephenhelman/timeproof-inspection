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

const NAVY = "#0a0e1a";
const ORANGE = "#F06B30";
const ACCENT = "#2a6db5";
const GRAY_BG = "#f5f5f5";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", padding: 40, backgroundColor: "#ffffff" },
  coverPage: {
    fontFamily: "Helvetica",
    padding: 0,
    backgroundColor: NAVY,
  },
  headerBar: {
    backgroundColor: NAVY,
    padding: "20 40",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverBody: {
    padding: "40 40",
    flex: 1,
  },
  wordmark: { color: "#ffffff", fontSize: 11, opacity: 0.7 },
  coverHeadline: {
    color: "#ffffff",
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    lineHeight: 1.3,
  },
  coverSubline: {
    color: "#8fa8bf",
    fontSize: 13,
    marginBottom: 32,
  },
  profileCard: {
    backgroundColor: "#0f1626",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  profileLabel: { color: "#4d6490", fontSize: 9, marginBottom: 2 },
  profileValue: { color: "#E4EEF4", fontSize: 11, marginBottom: 8 },
  orangeAccent: { color: ORANGE, fontSize: 10, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  sectionOrangeTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  body: { fontSize: 10, color: "#374151", lineHeight: 1.6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    padding: "6 8",
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: { flexDirection: "row", padding: "6 8" },
  tableCell: { flex: 1, fontSize: 9, color: "#374151" },
  tableCellBold: { flex: 1, fontSize: 9, color: "#111827", fontFamily: "Helvetica-Bold" },
  timelineRow: { flexDirection: "row", padding: "5 8", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  timelineYear: { width: 56, fontSize: 9, color: ORANGE, fontFamily: "Helvetica-Bold" },
  timelineVisible: { flex: 1, fontSize: 9, color: "#16a34a" },
  timelineHidden: { flex: 1, fontSize: 9, color: "#dc2626" },
  zoneCard: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  zoneLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827" },
  zoneBody: { fontSize: 9, color: "#374151", marginTop: 2, lineHeight: 1.4 },
  warningBox: {
    backgroundColor: "#fff7ed",
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    padding: 10,
    marginVertical: 8,
  },
  warningText: { fontSize: 9, color: "#92400e", lineHeight: 1.5 },
  differentiatorItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
    alignItems: "flex-start",
  },
  checkmark: { fontSize: 10, color: "#16a34a", fontFamily: "Helvetica-Bold" },
  differentiatorText: { flex: 1, fontSize: 10, color: "#374151", lineHeight: 1.4 },
  pageNumber: { position: "absolute", bottom: 20, right: 40, fontSize: 9, color: "#9ca3af" },
  pageNumberDark: { position: "absolute", bottom: 20, right: 40, fontSize: 9, color: "#4d6490" },
});

export interface GuideJWTPayload {
  leadId: string;
  roofType: string;
  roofAge: string;
  issuesNoticed: string[];
  firstName: string;
}

const TIMELINE = [
  { years: "Year 1–2",   visible: "Looks brand new",      hidden: "Granule bonding weakens from UV" },
  { years: "Year 3–5",   visible: "Still looks fine",      hidden: "Granule loss accelerates, underlayment stress" },
  { years: "Year 7–10",  visible: "Minor surface wear",    hidden: "Decking moisture begins, ventilation failing" },
  { years: "Year 12–15", visible: "Noticeable aging",      hidden: "Active attic moisture, structural decking at risk" },
  { years: "Year 15+",   visible: "Ceiling stains appear", hidden: "Damage has been building for years" },
];

const FAILURE_ZONES = [
  { label: "1. Field Shingles",      body: "Granule loss and UV damage start here — but rarely end here. Visible from the street but the least predictive of overall roof health." },
  { label: "2. Ridge Cap",           body: "The peak of the roof concentrates the highest heat on the entire structure. First zone to fail. Last zone most inspectors check." },
  { label: "3. Flashing & Seams",    body: "Where the roof surface meets walls, vents, chimneys, and valleys. The single most common point of water intrusion on any roof." },
  { label: "4. Roof Decking",        body: "The structural wood layer beneath everything else. Moisture here means the problem is already serious — and getting worse daily." },
  { label: "5. Attic Ventilation",   body: "The most overlooked failure zone. Poor attic ventilation traps heat and moisture — directly accelerating failure in every other zone simultaneously. Almost never included in a standard inspection." },
];

const SHINGLE_COMPONENTS = [
  { label: "Roof Decking",     body: "Structural wood layer. Foundation of everything above. Moisture here is critical." },
  { label: "Underlayment",     body: "Waterproof barrier between decking and shingles. Your secondary defense if shingles fail." },
  { label: "Ice & Water Shield", body: "Waterproof membrane at eaves and valleys. Prevents wind-driven moisture from working under the shingles." },
  { label: "Shingles",         body: "Primary weather surface. Where most homeowners focus — but not where most failures start." },
  { label: "Ridge Cap",        body: "Seals the peak. Highest heat exposure on the entire roof surface." },
  { label: "Flashing",         body: "Metal seals at walls, vents, chimneys. Single most common active leak point on any roof." },
  { label: "Drip Edge",        body: "Directs water off the roof edge into the gutter. Frequently skipped on lower-cost installations." },
  { label: "Gutters",          body: "Final drainage. Failure causes fascia rot, soffit damage, and foundation issues over time." },
];

const ATTIC_COMPONENTS = [
  { label: "Decking Underside", body: "Moisture staining here signals active water intrusion invisible from the exterior. The first thing we look for when we go up." },
  { label: "Rafters",          body: "Structural framing members supporting the entire roof load. Compromised rafters are a safety issue — not just a roofing issue." },
  { label: "Insulation",       body: "Wet or compressed insulation signals long-term moisture damage — plus a utility bill problem you are already paying for." },
  { label: "Soffit Vents",     body: "Intake vents that allow outside air into the attic. Blocked soffits trap heat and directly accelerate shingle failure above." },
  { label: "Ridge Vent",       body: "Exhaust point for hot attic air. A failed ridge vent turns your attic into an oven and voids most manufacturer warranties." },
  { label: "Vapor Barrier",    body: "Prevents condensation from forming inside the attic. Missing in many older El Paso homes." },
];

const SHINGLE_COMPARISON = [
  { feature: "Type",       old: "3-tab (single layer)",    current: "Architectural dimensional" },
  { feature: "Lifespan",   old: "10–15 yrs in El Paso",    current: "50-year warranted" },
  { feature: "Wind rating",old: "60–70 mph",               current: "130+ mph" },
  { feature: "Granules",   old: "Standard (degrades fast)", current: "UV-reflective, algae-resistant" },
  { feature: "Warranty",   old: "Frequently voided",        current: "Spec-compliant installation" },
];

const FLAT_COMPONENTS = [
  { label: "EPDM / TPO Membrane", body: "The primary waterproof layer on a flat roof. Susceptible to UV degradation, punctures, and seam failure over time." },
  { label: "Insulation Layer",    body: "Provides thermal separation and supports the membrane. Wet insulation compresses and loses R-value." },
  { label: "Roof Decking",        body: "Structural substrate beneath the insulation. Moisture from above or below leads to rot and structural risk." },
  { label: "Drains & Scuppers",   body: "Drainage points that prevent ponding water. Blocked drains are the number one cause of flat roof failure." },
  { label: "Flashing & Edges",    body: "Seals at perimeters, penetrations, and walls. Most active leak points on a flat roof originate here." },
  { label: "Pitch Pockets",       body: "Sealed openings around pipes and equipment. Require periodic maintenance — frequently neglected." },
];

const FLAT_COMPARISON = [
  { feature: "Technology",     old: "BUR (built-up) / modified bitumen", current: "EPDM / TPO single-ply" },
  { feature: "Lifespan",       old: "10–15 years",                        current: "20–25 years with maintenance" },
  { feature: "Heat resistance",old: "Poor — absorbs UV",                  current: "Reflective membranes reduce heat" },
  { feature: "Seam strength",  old: "Mop-applied, prone to cracking",     current: "Heat-welded seams" },
  { feature: "Drainage",       old: "Often relies on slope alone",        current: "Engineered drain placement" },
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
  "50-year warranted architectural shingles if installation is warranted",
  "El Paso climate expertise — we know how this market ages roofs differently",
];

const DIAGRAM_PATHS = {
  failureZones: path.join(process.cwd(), "public/diagrams/failure-zones.png"),
  shingleComponents: path.join(process.cwd(), "public/diagrams/shingle-components.png"),
  atticComponents: path.join(process.cwd(), "public/diagrams/attic-components.png"),
};

export async function generateGuidePdf(payload: GuideJWTPayload): Promise<Buffer> {
  const { firstName, roofType, roofAge, issuesNoticed } = payload;
  const issuesList = issuesNoticed.filter((i) => i !== "None of the above");
  const isShingle = roofType === "Shingle" || roofType === "Both";
  const isFlat = roofType === "Flat" || roofType === "Both";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const doc = React.createElement(
    Document,
    null,

    // ── Cover page ──────────────────────────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: styles.coverPage },
      React.createElement(
        View,
        { style: styles.headerBar },
        React.createElement(Text, { style: styles.wordmark }, "SCOPE REPORTS / QNTUM ROOFING"),
        React.createElement(Text, { style: styles.wordmark }, date)
      ),
      React.createElement(
        View,
        { style: styles.coverBody },
        React.createElement(Text, { style: styles.coverHeadline }, "El Paso's Personalized\nRoof Health Guide"),
        React.createElement(Text, { style: styles.coverSubline }, `Prepared for ${firstName}`),
        React.createElement(
          View,
          { style: styles.profileCard },
          React.createElement(Text, { style: styles.profileLabel }, "ROOF TYPE"),
          React.createElement(Text, { style: styles.profileValue }, roofType),
          React.createElement(Text, { style: styles.profileLabel }, "ESTIMATED AGE"),
          React.createElement(Text, { style: styles.profileValue }, roofAge || "Not specified"),
          React.createElement(Text, { style: styles.profileLabel }, "ISSUES REPORTED"),
          React.createElement(
            Text,
            { style: styles.profileValue },
            issuesList.length > 0 ? issuesList.join(", ") : "None reported"
          )
        ),
        React.createElement(
          Text,
          { style: [styles.body, { color: "#4d6490" }] },
          "This guide was generated based on what you told us about your roof. The sections below explain what El Paso's climate does to roofs — and what the symptoms you reported may mean."
        )
      ),
      React.createElement(Text, { style: styles.pageNumberDark, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
    ),

    // ── Page: Hidden Damage Timeline ────────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "The Hidden Damage Timeline"),
        React.createElement(Text, { style: [styles.body, { marginBottom: 12 }] }, "By the time you see it inside, it's already been years in the making. El Paso's UV index ranks among the highest in the nation. Heat cycling, monsoon stress, and 297+ sunny days per year accelerate roof degradation significantly faster than national ratings account for."),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 56 }] }, "YEARS"),
          React.createElement(Text, { style: styles.tableHeaderCell }, "LOOKS LIKE"),
          React.createElement(Text, { style: styles.tableHeaderCell }, "HAPPENING INSIDE")
        ),
        ...TIMELINE.map((row, i) =>
          React.createElement(
            View,
            { key: row.years, style: [styles.timelineRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }] },
            React.createElement(Text, { style: styles.timelineYear }, row.years),
            React.createElement(Text, { style: styles.timelineVisible }, row.visible),
            React.createElement(Text, { style: styles.timelineHidden }, row.hidden)
          )
        ),
        React.createElement(
          View,
          { style: [styles.warningBox, { marginTop: 12 }] },
          React.createElement(Text, { style: styles.warningText }, "⚠ El Paso Climate Reality: A standard shingle installed here realistically performs 10–15 years — not the 25 years on the box. That's why we install 50-year warranted architectural shingles rated for this climate.")
        )
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
    ),

    // ── Page: Where Roofs Actually Fail ─────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Where Roofs Actually Fail — 5 Zones"),
        React.createElement(Text, { style: [styles.body, { marginBottom: 12 }] }, "Most inspections only check field shingles — sometimes the ridge. There are 5 zones where roofs actually fail, and most of the serious ones are invisible from the ground."),
        React.createElement(Image, { src: DIAGRAM_PATHS.failureZones, style: { width: "100%", marginBottom: 12 } }),
        ...FAILURE_ZONES.map((z) =>
          React.createElement(
            View,
            { key: z.label, style: styles.zoneCard },
            React.createElement(Text, { style: styles.zoneLabel }, z.label),
            React.createElement(Text, { style: styles.zoneBody }, z.body)
          )
        )
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
    ),

    // ── Page: El Paso Climate + Lifespan ────────────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "El Paso Climate & Roof Lifespan"),
        ...[
          ["Top 3 UV Index Nationally", "El Paso ranks among the top three cities in the country for UV index. Manufacturer lifespan ratings are based on national averages — El Paso is not average."],
          ["297 Sunny Days Per Year", "El Paso averages 297 sunny days per year versus the national average of 205. Every one of those days is UV exposure breaking down granule adhesion."],
          ["Roof Surface Temps Reach 150–172°F", "While air temps hit 104°F, roof surfaces reach 150–172°F in peak summer months. Daily heat cycling between extreme highs and cooler nights expands and contracts shingle material — breaking down adhesion and stressing every seam."],
          ["Standard Shingles Lose Up to 40% of Rated Lifespan", "A 3-tab shingle rated for 15–20 years realistically performs 10–15 years in El Paso. This is why Qntum installs 50-year warranted architectural shingles."],
        ].map(([title, body]) =>
          React.createElement(
            View,
            { key: title, style: [styles.zoneCard, { marginBottom: 10 }] },
            React.createElement(Text, { style: [styles.zoneLabel, { color: ORANGE }] }, title),
            React.createElement(Text, { style: styles.zoneBody }, body)
          )
        )
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
    ),

    // ── Shingle pages (if applicable) ───────────────────────────────────────
    ...(isShingle
      ? [
          React.createElement(
            Page,
            { size: "LETTER", style: styles.page, key: "shingle-components" },
            React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, "Components of a Shingle Roof"),
              React.createElement(Image, { src: DIAGRAM_PATHS.shingleComponents, style: { width: "100%", marginBottom: 12 } }),
              ...SHINGLE_COMPONENTS.map((c) =>
                React.createElement(
                  View,
                  { key: c.label, style: styles.zoneCard },
                  React.createElement(Text, { style: styles.zoneLabel }, c.label),
                  React.createElement(Text, { style: styles.zoneBody }, c.body)
                )
              )
            ),
            React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
          ),
          React.createElement(
            Page,
            { size: "LETTER", style: styles.page, key: "shingle-attic" },
            React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, "Components of an Attic"),
              React.createElement(Image, { src: DIAGRAM_PATHS.atticComponents, style: { width: "100%", marginBottom: 12 } }),
              React.createElement(Text, { style: [styles.body, { marginBottom: 10 }] }, "Most roofing companies never go into the attic. The attic is where the real condition of the roof is visible — moisture staining, ventilation failure, insulation damage, and rafter condition are all only visible from inside."),
              ...ATTIC_COMPONENTS.map((c) =>
                React.createElement(
                  View,
                  { key: c.label, style: styles.zoneCard },
                  React.createElement(Text, { style: styles.zoneLabel }, c.label),
                  React.createElement(Text, { style: styles.zoneBody }, c.body)
                )
              )
            ),
            React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
          ),
          React.createElement(
            Page,
            { size: "LETTER", style: styles.page, key: "shingle-comparison" },
            React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, "Old Technology vs. Current Standards"),
              React.createElement(
                View,
                { style: styles.tableHeader },
                React.createElement(Text, { style: styles.tableHeaderCell }, "FEATURE"),
                React.createElement(Text, { style: styles.tableHeaderCell }, "OLD STANDARD (3-TAB)"),
                React.createElement(Text, { style: styles.tableHeaderCell }, "CURRENT (ARCHITECTURAL)")
              ),
              ...SHINGLE_COMPARISON.map((r, i) =>
                React.createElement(
                  View,
                  { key: r.feature, style: [styles.tableRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }] },
                  React.createElement(Text, { style: styles.tableCellBold }, r.feature),
                  React.createElement(Text, { style: [styles.tableCell, { color: "#dc2626" }] }, r.old),
                  React.createElement(Text, { style: [styles.tableCell, { color: "#16a34a" }] }, r.current)
                )
              )
            ),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionOrangeTitle }, "What They Don't Tell You"),
              ...DTTY.map((text, i) =>
                React.createElement(
                  View,
                  { key: i, style: [styles.zoneCard, { marginBottom: 8 }] },
                  React.createElement(Text, { style: styles.zoneBody }, text)
                )
              )
            ),
            React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
          ),
        ]
      : []),

    // ── Flat pages (if applicable) ──────────────────────────────────────────
    ...(isFlat
      ? [
          React.createElement(
            Page,
            { size: "LETTER", style: styles.page, key: "flat-components" },
            React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, "Components of a Flat Roof"),
              ...FLAT_COMPONENTS.map((c) =>
                React.createElement(
                  View,
                  { key: c.label, style: styles.zoneCard },
                  React.createElement(Text, { style: styles.zoneLabel }, c.label),
                  React.createElement(Text, { style: styles.zoneBody }, c.body)
                )
              )
            ),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionTitle }, "Old Technology vs. Current Standards"),
              React.createElement(
                View,
                { style: styles.tableHeader },
                React.createElement(Text, { style: styles.tableHeaderCell }, "FEATURE"),
                React.createElement(Text, { style: styles.tableHeaderCell }, "OLD STANDARD"),
                React.createElement(Text, { style: styles.tableHeaderCell }, "CURRENT")
              ),
              ...FLAT_COMPARISON.map((r, i) =>
                React.createElement(
                  View,
                  { key: r.feature, style: [styles.tableRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }] },
                  React.createElement(Text, { style: styles.tableCellBold }, r.feature),
                  React.createElement(Text, { style: [styles.tableCell, { color: "#dc2626" }] }, r.old),
                  React.createElement(Text, { style: [styles.tableCell, { color: "#16a34a" }] }, r.current)
                )
              )
            ),
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Text, { style: styles.sectionOrangeTitle }, "What They Don't Tell You"),
              ...DTTY.map((text, i) =>
                React.createElement(
                  View,
                  { key: i, style: [styles.zoneCard, { marginBottom: 8 }] },
                  React.createElement(Text, { style: styles.zoneBody }, text)
                )
              )
            ),
            React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
          ),
        ]
      : []),

    // ── Final page: Scope Reports differentiator ─────────────────────────────
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.headerBar }, React.createElement(Text, { style: [styles.wordmark, { color: "#4d6490" }] }, "SCOPE REPORTS / QNTUM ROOFING")),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Every Inspection Includes a Full Digital Condition Report"),
        React.createElement(Text, { style: [styles.body, { marginBottom: 12 }] }, "We don't do verbal summaries. Every Qntum inspection produces a written, documented report you keep — photos, findings, and attic results by zone."),
        ...DIFFERENTIATORS.map((item) =>
          React.createElement(
            View,
            { key: item, style: styles.differentiatorItem },
            React.createElement(Text, { style: styles.checkmark }, "✓"),
            React.createElement(Text, { style: styles.differentiatorText }, item)
          )
        ),
        React.createElement(
          View,
          { style: [styles.warningBox, { marginTop: 20 }] },
          React.createElement(Text, { style: [styles.warningText, { fontFamily: "Helvetica-Bold", marginBottom: 4 }] }, "Schedule your free inspection"),
          React.createElement(Text, { style: styles.warningText }, "scopereports.com")
        )
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`, fixed: true })
    )
  );

  const blob = await pdf(doc).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
