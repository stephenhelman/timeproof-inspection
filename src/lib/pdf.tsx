import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import React from "react";
import { getPackageById, getWarrantySummary, detectPackageId } from "./packages";

const BLUE = "#003087";
const GRAY_BG = "#f5f5f5";

function fmtLinearPdf(decimal: number): string {
  const ft = Math.floor(decimal);
  const ins = Math.round((decimal - ft) * 12);
  return ins > 0 ? `${ft}' ${ins}"` : `${ft}'`;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", padding: 40, backgroundColor: "#ffffff" },
  headerBar: {
    backgroundColor: BLUE,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLogo: { color: "#ffffff", fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  headerTitle: { color: "#ffffff", fontSize: 13 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
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
  findingsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  findingItem: {
    fontSize: 9,
    color: "#374151",
    backgroundColor: "#f3f4f6",
    padding: "3 6",
    borderRadius: 4,
  },
  photoEntry: { marginBottom: 8 },
  photoNum: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#374151" },
  photoDesc: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  photoUrl: { fontSize: 8, color: BLUE, marginTop: 1 },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", padding: "5 0" },
  quoteLabel: { fontSize: 10, color: "#374151" },
  quoteValue: { fontSize: 10, color: "#111827", fontFamily: "Helvetica-Bold" },
  quoteDiscount: { fontSize: 10, color: "#dc2626" },
  quoteTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "7 0",
    borderTopWidth: 1.5,
    borderTopColor: "#374151",
    marginTop: 4,
  },
  quoteTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
  quoteTotalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#374151",
    borderRadius: 2,
  },
  checklistLabel: { fontSize: 10, color: "#374151" },
  pageNumber: { position: "absolute", bottom: 20, right: 40, fontSize: 9, color: "#9ca3af" },
  packageTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1B3A7A",
    marginBottom: 2,
  },
  packageTagline: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  productRow: {
    flexDirection: "row" as const,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  productCategory: {
    fontSize: 9,
    color: "#6B7280",
    width: "45%",
  },
  productName: {
    fontSize: 9,
    color: "#111827",
    fontFamily: "Helvetica-Bold",
    width: "55%",
  },
  warrantyLine: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 3,
  },
});

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateInspectionPDF(inspection: any): Promise<Buffer> {
  const customer = inspection.customer || {};
  const quote = inspection.quote || {};
  const structures = (inspection.structures || []).filter((s: { inScope: boolean }) => s.inScope);
  const photos = inspection.photos || [];
  const findings = (inspection.findings as Record<string, boolean>) || {};
  const checkedFindings = Object.entries(findings).filter(([, v]) => v === true).map(([k]) => k);

  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bp = quote.basePrice || 0;
  const npDiscount = bp * (quote.nationalPromo ? 0.05 : 0);
  const lpDiscount = (bp - npDiscount) * (quote.localPromo ? 0.1 : 0);
  const fspDiscount = (bp - npDiscount - lpDiscount) * (quote.fsp ? 0.1 : 0);

  const packages = inspection.packages || [];
  const recommendedPkg = packages.find((p: { recommended: boolean }) => p.recommended);
  const configPackageId = recommendedPkg ? detectPackageId(recommendedPkg.name) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configPkg = configPackageId ? (getPackageById(configPackageId) as any) : null;
  const warrantyLines = configPackageId ? (getWarrantySummary(configPackageId) as string[] | null) : null;

  const doc = (
    <Document>
      {/* Page 1 — Customer Facing */}
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerLogo}>TIMEPROOF</Text>
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

        {/* Findings */}
        {checkedFindings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspection Findings ({checkedFindings.length})</Text>
            <View style={styles.findingsGrid}>
              {checkedFindings.map((key) => (
                <Text key={key} style={styles.findingItem}>{key.replace(/-/g, " ")}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Package summary */}
        {configPkg && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Package</Text>
            <Text style={styles.packageTitle}>{configPkg.label} Package</Text>
            <Text style={styles.packageTagline}>{configPkg.tagline}</Text>

            {configPkg.products.length > 0 && (
              <>
                <Text style={styles.subheading}>{"What's Included"}</Text>
                {configPkg.products.map((product: { category: string; name: string }) => (
                  <View key={product.category} style={styles.productRow}>
                    <Text style={styles.productCategory}>{product.category}</Text>
                    <Text style={styles.productName}>{product.name}</Text>
                  </View>
                ))}
              </>
            )}

            {warrantyLines && warrantyLines.length > 0 && (
              <>
                <Text style={styles.subheading}>Warranty Coverage</Text>
                {warrantyLines.map((line, i) => (
                  <Text key={i} style={styles.warrantyLine}>{line}</Text>
                ))}
              </>
            )}
          </View>
        )}

        {/* Photo log */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Documentation</Text>
            {photos.map((p: { photoNumber: number; description?: string | null; r2Url: string }) => (
              <View key={p.photoNumber} style={styles.photoEntry}>
                <Text style={styles.photoNum}>Photo {p.photoNumber}</Text>
                {p.description && <Text style={styles.photoDesc}>{p.description}</Text>}
                <Text style={styles.photoUrl}>{p.r2Url}</Text>
              </View>
            ))}
          </View>
        )}



        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Page 2 — Internal */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerLogo}>TIMEPROOF</Text>
          <Text style={styles.headerTitle}>Internal — Rep Copy</Text>
        </View>

        {/* Structures */}
        {structures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Structures</Text>
            {structures.map((s: Record<string, unknown>, si: number) => (
              <View key={String(s.id)} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#374151", marginBottom: 4 }}>{String(s.name)}</Text>
                {[
                  ["Sq Ft", s.sqft], ["Pitch", s.pitch],
                  ["Ridge", s.ridge ? fmtLinearPdf(s.ridge as number) : null],
                  ["Hip", s.hip ? fmtLinearPdf(s.hip as number) : null],
                  ["Valley", s.valley ? fmtLinearPdf(s.valley as number) : null],
                  ["Rake", s.rake ? fmtLinearPdf(s.rake as number) : null],
                  ["Eave", s.eave ? fmtLinearPdf(s.eave as number) : null],
                  ["Flashing", s.flashing ? fmtLinearPdf(s.flashing as number) : null],
                  ["Step Flashing", s.stepFlashing ? fmtLinearPdf(s.stepFlashing as number) : null],
                  ["Parapets", s.parapets ? fmtLinearPdf(s.parapets as number) : null],
                  ["Other", s.other ? fmtLinearPdf(s.other as number) : null],
                  ["Pipe Boots", s.pipeBoots],
                  ["Skylights", s.skylights],
                  ["Chimneys", s.chimneys],
                  ["Box Vents", s.boxVents],
                  ["Turbines", s.turbines],
                  ["Attic Fans", s.atticFans],
                ].filter(([, v]) => v != null && v !== 0).map(([label, value], i) => (
                  <View key={String(label)} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }]}>
                    <Text style={styles.tableCell}>{String(label)}</Text>
                    <Text style={styles.tableCellBold}>{String(value)}</Text>
                  </View>
                ))}
                {si < structures.length - 1 && <View style={{ height: 1, backgroundColor: "#e5e7eb", marginTop: 8 }} />}
              </View>
            ))}
          </View>
        )}

        {/* Quote */}
        {bp > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote</Text>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Base Price</Text>
              <Text style={styles.quoteValue}>{fmt(bp)}</Text>
            </View>
            {quote.nationalPromo && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>National Promotion (5%)</Text>
                <Text style={styles.quoteDiscount}>-{fmt(npDiscount)}</Text>
              </View>
            )}
            {quote.localPromo && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Local Promotion (10%)</Text>
                <Text style={styles.quoteDiscount}>-{fmt(lpDiscount)}</Text>
              </View>
            )}
            {quote.fsp && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>FSP (10%)</Text>
                <Text style={styles.quoteDiscount}>-{fmt(fspDiscount)}</Text>
              </View>
            )}
            <View style={styles.quoteTotalRow}>
              <Text style={styles.quoteTotalLabel}>NISI</Text>
              <Text style={styles.quoteTotalValue}>{fmt(quote.nisi || 0)}</Text>
            </View>
            {quote.commissionRate > 0 && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Commission ({((quote.commissionRate || 0) * 100).toFixed(0)}%)</Text>
                <Text style={styles.quoteValue}>{fmt(quote.commission || 0)}</Text>
              </View>
            )}
            {quote.estMonthly && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Est. Monthly Payment</Text>
                <Text style={styles.quoteValue}>{fmt(quote.estMonthly)}/mo</Text>
              </View>
            )}
          </View>
        )}

        {/* Production notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Notes</Text>
          {[
            ["Gate Code", inspection.gateCode],
            ["Pets", inspection.hasPets ? "Yes" : inspection.hasPets === false ? "No" : null],
            ["Access Issues", inspection.accessIssues],
            ["HOA", inspection.hoaDetails || (inspection.hoaRestrictions ? "Yes" : null)],
            ["Color Selected", inspection.colorSelected],
            ["Special Requests", inspection.specialRequests],
            ["Follow-up Notes", inspection.followUpNotes],
          ].filter(([, v]) => v).map(([label, value], i) => (
            <View key={String(label)} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? GRAY_BG : "#ffffff" }]}>
              <Text style={styles.tableCell}>{String(label)}</Text>
              <Text style={styles.tableCellBold}>{String(value)}</Text>
            </View>
          ))}
        </View>

        {/* Follow-up checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up Checklist</Text>
          {[
            "ServiceTitan updated",
            "Thank you text sent",
            "Contract sent",
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
