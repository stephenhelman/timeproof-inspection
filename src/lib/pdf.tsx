import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import React from "react";
import { parseDiagnosisText } from "./diagnosis-parser";

// PRESERVED — not active in Qntum build
// import { getPackageById, getWarrantySummary, detectPackageId } from "./packages";

const NAVY = "#0a0e1a";
const ACCENT = "#2a6db5";
const GRAY_BG = "#f5f5f5";

const SEV_COLOR: Record<string, string> = {
  high:   "#c0392b",
  medium: "#d97706",
  low:    "#16a34a",
};

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", padding: 40, backgroundColor: "#ffffff" },
  headerBar: {
    backgroundColor: NAVY,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerWordmark: { color: "#ffffff", fontSize: 14, fontFamily: "Helvetica-Bold" },
  headerTitle: { color: "#ffffff", fontSize: 13 },
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
  row2col: { flexDirection: "row", gap: 20 },
  label: { fontSize: 9, color: "#6b7280" },
  value: { fontSize: 11, color: "#111827", marginTop: 2 },
  tableRow: { flexDirection: "row", padding: "6 8" },
  tableCell: { flex: 1, fontSize: 10, color: "#374151" },
  tableCellBold: { flex: 1, fontSize: 10, color: "#111827", fontFamily: "Helvetica-Bold" },
  findingCard: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  findingLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827" },
  findingBadge: { fontSize: 8, color: "#6b7280", marginBottom: 4 },
  findingExplanation: { fontSize: 9, color: "#374151", marginTop: 2, lineHeight: 1.4 },
  photoEntry: { marginBottom: 8 },
  photoNum: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#374151" },
  photoDesc: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  photoUrl: { fontSize: 8, color: ACCENT, marginTop: 1 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingLeft: 8,
    marginVertical: 4,
  },
  blockquoteText: { fontSize: 10, color: "#374151", fontStyle: "italic", lineHeight: 1.5 },
  warningSignItem: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#374151",
    borderRadius: 2,
  },
  checklistLabel: { fontSize: 10, color: "#374151" },
  admissionBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    padding: 8,
    marginTop: 4,
  },
  admissionText: { fontSize: 10, color: "#374151", fontStyle: "italic", lineHeight: 1.5 },
  pageNumber: { position: "absolute", bottom: 20, right: 40, fontSize: 9, color: "#9ca3af" },
  // Zone section styles
  zoneSection: {
    marginBottom: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  zoneHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 6,
  },
  zoneParagraph: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  zoneCallout: {
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    paddingLeft: 8,
    marginVertical: 4,
    paddingVertical: 4,
    paddingRight: 4,
    backgroundColor: "#eef3fb",
  },
  zoneCalloutLabel: {
    fontSize: 7,
    color: ACCENT,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  zoneCalloutText: {
    fontSize: 9,
    color: "#374151",
    fontStyle: "italic",
    lineHeight: 1.5,
  },
  // Structured section styles
  overallSeverityBox: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  overallSeverityLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  overallSeverityText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  zoneFindingCard: {
    marginBottom: 6,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  zoneFindingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  zoneFindingName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  zoneFindingType: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 3,
  },
  zoneFindingMeta: {
    fontSize: 8,
    color: "#6b7280",
  },
  admissionsSection: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    padding: 8,
    marginTop: 4,
  },
  admissionsSectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    marginBottom: 6,
  },
  admissionItem: {
    fontSize: 9,
    color: "#374151",
    fontStyle: "italic",
    lineHeight: 1.5,
    marginBottom: 4,
  },
});

interface DiagnosisFinding {
  id: string;
  label: string;
  explanation: string;
  severity: string;
  status: string;
  matchedRoofTags: string[];
  matchedAtticTags: string[];
  notes?: string;
}

interface StructuredZone {
  zone: string;
  findingType: string;
  severity: "high" | "medium" | "low";
  confidence: number;
  referencedWarningSign: string | null;
}

interface StructuredDiagnosis {
  zones?: StructuredZone[];
  overallSeverity?: "high" | "medium" | "low";
  primaryConcern?: string;
  homeownerAdmissions?: string[];
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateInspectionPDF(inspection: any): Promise<Buffer> {
  const customer = { name: inspection.customerName, address: inspection.address };
  const photos = inspection.photos || [];
  const roofPhotos = photos.filter((p: { photoSection: string }) => p.photoSection === "roof");
  const atticPhotos = photos.filter((p: { photoSection: string }) => p.photoSection === "attic");
  const diagnosis: DiagnosisFinding[] = Array.isArray(inspection.diagnosis) ? inspection.diagnosis : [];
  const warningSignsCovered: string[] = inspection.warningSignsCovered || [];

  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const aiDiagnosisDescription: string | null = inspection.aiDiagnosisDescription ?? null;
  const aiDiagnosisStructured = (inspection.aiDiagnosisStructured as StructuredDiagnosis | null) ?? null;

  // Homeowner's own-words answers from the guided walkthrough (rep copy fuel).
  const walkthroughAnswers = (inspection.homeownerWalkthroughAnswers as {
    steps?: Array<{ stepRef?: string; answer?: string }>;
    closingAnswer?: string | null;
  } | null) ?? null;
  const ownWordsSteps = (walkthroughAnswers?.steps ?? []).filter(
    (s) => typeof s?.answer === "string" && s.answer.trim(),
  );
  const ownWordsClosing =
    typeof walkthroughAnswers?.closingAnswer === "string" && walkthroughAnswers.closingAnswer.trim()
      ? walkthroughAnswers.closingAnswer.trim()
      : null;

  const intakePass2 = inspection.intakePass2 as Record<string, unknown> | null;
  const postDiagnosisAdmission: string | null =
    typeof intakePass2?.postDiagnosisAdmission === "string"
      ? intakePass2.postDiagnosisAdmission
      : null;

  const parsedZones = aiDiagnosisDescription ? parseDiagnosisText(aiDiagnosisDescription) : [];

  const overallSev = aiDiagnosisStructured?.overallSeverity;
  const overallColor = overallSev ? (SEV_COLOR[overallSev] ?? ACCENT) : ACCENT;

  const doc = (
    <Document>
      {/* Page 1 — Customer Facing */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerWordmark}>Qntum Roofing</Text>
          <Text style={styles.headerTitle}>Roof Inspection Report</Text>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.row2col}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{customer.name || "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{customer.address || "—"}</Text>
            </View>
          </View>
          <View style={[styles.row2col, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{date}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Rep</Text>
              <Text style={styles.value}>{inspection.repName || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Photo log — roof */}
        {roofPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Roof Photos ({roofPhotos.length})</Text>
            {roofPhotos.map((p: { photoNumber: number; description?: string | null; r2Url: string }) => (
              <View key={p.photoNumber} style={styles.photoEntry}>
                <Text style={styles.photoNum}>Photo {p.photoNumber}</Text>
                {p.description && <Text style={styles.photoDesc}>{p.description}</Text>}
                <Text style={styles.photoUrl}>{p.r2Url}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photo log — attic */}
        {atticPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attic Photos ({atticPhotos.length})</Text>
            {atticPhotos.map((p: { photoNumber: number; description?: string | null; r2Url: string }) => (
              <View key={p.photoNumber} style={styles.photoEntry}>
                <Text style={styles.photoNum}>Photo {p.photoNumber}</Text>
                {p.description && <Text style={styles.photoDesc}>{p.description}</Text>}
                <Text style={styles.photoUrl}>{p.r2Url}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Roof Diagnosis — customer-facing narrative only (no clinical data) */}
        {(parsedZones.length > 0 || postDiagnosisAdmission) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Roof Diagnosis</Text>

            {/* Zone sections — parsed prose with callout blocks */}
            {parsedZones.map((zone, zi) => (
              <View key={zi} style={styles.zoneSection}>
                {zone.name ? (
                  <Text style={styles.zoneHeader}>{zone.name}</Text>
                ) : null}
                {zone.blocks.map((block, bi) => {
                  // Omit question blocks from the PDF (rep-only content)
                  if (block.type === "question") return null;
                  if (block.type === "paragraph") {
                    return (
                      <Text key={bi} style={styles.zoneParagraph}>
                        {block.text}
                      </Text>
                    );
                  }
                  if (block.type === "callout") {
                    return (
                      <View key={bi} style={styles.zoneCallout}>
                        <Text style={styles.zoneCalloutLabel}>IN THEIR WORDS</Text>
                        <Text style={styles.zoneCalloutText}>
                          {"“"}{block.text}{"”"}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })}
              </View>
            ))}

            {/* NOTE: clinical structured findings (severity / confidence /
                finding-types / acknowledged list) are intentionally NOT on this
                customer-facing page. They live on the Internal — Rep Copy page. */}

            {/* Post-diagnosis admission */}
            {postDiagnosisAdmission && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.label, { marginBottom: 4 }]}>In Your Own Words</Text>
                <Text style={[styles.label, { marginBottom: 6, fontSize: 9 }]}>
                  {"After reviewing the inspection findings, here's how the homeowner described the condition of their roof:"}
                </Text>
                <View style={styles.admissionBox}>
                  <Text style={styles.admissionText}>{postDiagnosisAdmission}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Diagnosis findings */}
        {diagnosis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspection Findings ({diagnosis.length})</Text>
            {diagnosis.map((f) => (
              <View key={f.id} style={styles.findingCard}>
                <Text style={styles.findingBadge}>
                  {f.severity.toUpperCase()} · {f.status.toUpperCase()}
                </Text>
                <Text style={styles.findingLabel}>{f.label}</Text>
                <Text style={styles.findingExplanation}>{f.explanation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Problem Awareness */}
        {inspection.problemAwarenessBefore && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problem Awareness</Text>
            <Text style={[styles.label, { marginBottom: 4 }]}>Before inspection:</Text>
            <View style={styles.blockquote}>
              <Text style={styles.blockquoteText}>{inspection.problemAwarenessBefore}</Text>
            </View>
            {inspection.intakePass2Complete && inspection.problemAwarenessAfter && (
              <>
                <Text style={[styles.label, { marginTop: 8, marginBottom: 4 }]}>After findings review:</Text>
                <View style={[styles.blockquote, { borderLeftColor: "#9ca3af" }]}>
                  <Text style={styles.blockquoteText}>{inspection.problemAwarenessAfter}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Topics Reviewed */}
        {warningSignsCovered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Topics Reviewed</Text>
            {warningSignsCovered.map((id) => (
              <View key={id} style={styles.warningSignItem}>
                <Text style={{ fontSize: 10, color: "#16a34a" }}>{"✓"}</Text>
                <Text style={{ fontSize: 10, color: "#374151" }}>{id.replace(/-/g, " ")}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Page 2 — Internal */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerWordmark}>Qntum Roofing</Text>
          <Text style={styles.headerTitle}>Internal {"—"} Rep Copy</Text>
        </View>

        {/* Full intake form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intake Form</Text>
          {[
            ["North Star", inspection.northStar],
            ["Focus Drivers", inspection.focusDrivers],
            ["Time in Home", inspection.timeInHome],
            ["Year Built", inspection.yearBuilt],
            ["Age of Roof", inspection.ageOfRoof],
            ["Last Replaced By", inspection.lastReplacedBy],
            ["Past Repairs", inspection.pastRepairs],
            ["HOA", inspection.hoaName || (inspection.hoaPresent ? "Yes" : null)],
            ["Issues & Concerns", inspection.issuesConcerns],
            ["Duration", inspection.issueDuration],
            ["Impact", inspection.issueImpact],
            ["Root Cause Belief", inspection.rootCauseBeliefBefore],
            ["Trigger Moment", inspection.triggerMoment],
            ["Prior Meeting", inspection.priorMeetingHad ? `Yes — ${inspection.priorMeetingWho || ""}` : "No"],
            ["Win Definition", inspection.winDefinition],
            ["Color Preference", inspection.colorPreference],
            ["Family", inspection.personalFamily],
            ["Occupation", inspection.personalOccupation],
            ["Recreation", inspection.personalRecreation],
            ["Identity", inspection.personalIdentity],
          ].filter(([, v]) => v).map(([label, value], i) => (
            <View key={String(label)} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }]}>
              <Text style={styles.tableCell}>{String(label)}</Text>
              <Text style={styles.tableCellBold}>{String(value)}</Text>
            </View>
          ))}
        </View>

        {/* Rep Notes */}
        {inspection.repNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rep Notes (Internal)</Text>
            <Text style={{ fontSize: 10, color: "#374151", lineHeight: 1.5 }}>{inspection.repNotes}</Text>
          </View>
        )}

        {/* Diagnosis JSON */}
        {diagnosis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diagnosis Detail</Text>
            {diagnosis.map((f) => (
              <View key={f.id} style={[styles.findingCard, { marginBottom: 6 }]}>
                <Text style={styles.findingLabel}>{f.label} [{f.severity} / {f.status}]</Text>
                {f.notes && <Text style={[styles.findingExplanation, { marginTop: 4, fontStyle: "italic" }]}>Notes: {f.notes}</Text>}
                {f.matchedRoofTags.length > 0 && (
                  <Text style={[styles.label, { marginTop: 4 }]}>Roof: {f.matchedRoofTags.join(", ")}</Text>
                )}
                {f.matchedAtticTags.length > 0 && (
                  <Text style={[styles.label, { marginTop: 2 }]}>Attic: {f.matchedAtticTags.join(", ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* AI Clinical Diagnosis — REP ONLY (moved off the customer page) */}
        {aiDiagnosisStructured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Clinical Diagnosis (Internal)</Text>

            {overallSev && (
              <View
                style={[
                  styles.overallSeverityBox,
                  { borderColor: overallColor, backgroundColor: overallColor + "18" },
                ]}
              >
                <Text style={[styles.overallSeverityLabel, { color: overallColor }]}>
                  OVERALL SEVERITY
                </Text>
                <Text style={[styles.overallSeverityText, { color: overallColor }]}>
                  Overall: {overallSev.charAt(0).toUpperCase() + overallSev.slice(1)} Severity
                </Text>
                {aiDiagnosisStructured.primaryConcern && (
                  <Text style={[styles.label, { marginTop: 2, color: overallColor }]}>
                    Primary concern: {toTitleCase(aiDiagnosisStructured.primaryConcern)}
                  </Text>
                )}
              </View>
            )}

            {aiDiagnosisStructured.zones &&
              aiDiagnosisStructured.zones.length > 0 &&
              aiDiagnosisStructured.zones.map((z, i) => {
                const sevColor = SEV_COLOR[z.severity] ?? ACCENT;
                return (
                  <View key={i} style={styles.zoneFindingCard}>
                    <View style={styles.zoneFindingRow}>
                      <Text style={styles.zoneFindingName}>{z.zone}</Text>
                      <Text style={{ fontSize: 8, color: sevColor, fontFamily: "Helvetica-Bold" }}>
                        [{z.severity.toUpperCase()}]
                      </Text>
                    </View>
                    <Text style={styles.zoneFindingType}>{toTitleCase(z.findingType)}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {z.confidence > 0 && (
                        <Text style={styles.zoneFindingMeta}>
                          {Math.round(z.confidence * 100)}% confidence
                        </Text>
                      )}
                      {z.referencedWarningSign && (
                        <Text style={styles.zoneFindingMeta}>
                          {z.referencedWarningSign.replace(/_/g, " ")}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

            {aiDiagnosisStructured.homeownerAdmissions &&
              aiDiagnosisStructured.homeownerAdmissions.length > 0 && (
                <View style={styles.admissionsSection}>
                  <Text style={styles.admissionsSectionTitle}>
                    WHAT THE HOMEOWNER ACKNOWLEDGED
                  </Text>
                  {aiDiagnosisStructured.homeownerAdmissions.map((admission, i) => (
                    <Text key={i} style={styles.admissionItem}>
                      {"• “"}{admission}{"”"}
                    </Text>
                  ))}
                </View>
              )}
          </View>
        )}

        {/* Homeowner's own words from the guided walkthrough — REP ONLY */}
        {(ownWordsSteps.length > 0 || ownWordsClosing) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Homeowner&apos;s Words (Walkthrough)</Text>
            <Text style={[styles.label, { marginBottom: 6, fontSize: 9 }]}>
              {"What the homeowner typed at each step of the guided diagnosis — their own words."}
            </Text>
            {ownWordsSteps.map((s, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                {s.stepRef && <Text style={styles.label}>{s.stepRef}</Text>}
                <Text style={styles.admissionItem}>{"“"}{(s.answer ?? "").trim()}{"”"}</Text>
              </View>
            ))}
            {ownWordsClosing && (
              <View style={{ marginTop: 2 }}>
                <Text style={styles.label}>Root issue (their words)</Text>
                <Text style={styles.admissionItem}>{"“"}{ownWordsClosing}{"”"}</Text>
              </View>
            )}
          </View>
        )}

        {/* Follow-up checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up Checklist</Text>
          {[
            "Qntum Portal export sent",
            "Thank you text sent",
            "5-star review requested",
            "Referral asked",
          ].map((item) => (
            <View key={item} style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.checklistLabel}>{item}</Text>
            </View>
          ))}
          <View style={styles.checklistItem}>
            <View style={styles.checkbox} />
            <Text style={styles.checklistLabel}>Follow-up scheduled: ___________________________</Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
