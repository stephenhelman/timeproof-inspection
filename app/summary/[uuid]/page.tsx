import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { DAMAGE_GROUPS } from "@/src/lib/findings";
import ReportSection from "@/src/components/report/ReportSection";
import SectionTracker from "@/src/components/report/SectionTracker";
import PhotoReveal from "@/src/components/inspection/PhotoReveal";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
    include: {
      customer: true,
      structures: {
        where: { inScope: true },
        orderBy: { order: "asc" },
      },
      photos: { orderBy: { photoNumber: "asc" } },
      quote: true,
      reportVisits: true,
    },
  });

  if (!inspection) notFound();

  // Strip sensitive fields
  const safeInspection = {
    ...inspection,
    // Remove internal fields
  };

  const findings = (safeInspection.findings as Record<string, boolean>) || {};
  const customerName = inspection.customer?.name || "";
  const address = inspection.customer?.address || "";
  const repName = inspection.repName || "TIMEPROOF";
  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function fmt(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  const checkedFindings = Object.entries(findings).filter(([, v]) => v === true);

  return (
    <div className="min-h-screen bg-white">
      <SectionTracker uuid={uuid}>
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

          {/* Header */}
          <ReportSection sectionKey="header">
            <div className="flex items-center gap-4">
              <div className="w-32 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#003087" }}>
                <span className="text-white font-bold tracking-widest text-sm">TIMEPROOF</span>
              </div>
              <div>
                <h1 className="text-gray-900 font-semibold text-xl">Roof Inspection Report</h1>
                <p className="text-gray-500 text-sm">{date} · {repName}</p>
              </div>
            </div>
          </ReportSection>

          {/* Customer Info */}
          <ReportSection sectionKey="customer-info" title="Customer Information">
            <div className="flex flex-col gap-1">
              <p className="text-gray-900 font-semibold text-lg">{customerName}</p>
              <p className="text-gray-600">{address}</p>
            </div>
          </ReportSection>

          {/* Findings */}
          {checkedFindings.length > 0 && (
            <ReportSection sectionKey="findings" title="Inspection Findings">
              <p className="text-gray-600 text-sm">{checkedFindings.length} area{checkedFindings.length !== 1 ? "s" : ""} of concern identified</p>
              <div className="flex flex-col gap-4">
                {DAMAGE_GROUPS.map((group) => {
                  const groupItems = group.items.filter((item) => findings[item.key] === true);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group.group}>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{group.group}</p>
                      <ul className="flex flex-col gap-1">
                        {groupItems.map((item) => (
                          <li key={item.key} className="flex items-center gap-2 text-gray-700">
                            <span className="text-[#003087]">•</span>
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </ReportSection>
          )}

          {/* Photo Reveal */}
          {inspection.photos.length > 0 && (
            <ReportSection sectionKey="photo-reveal" title="Photo Documentation">
              <PhotoReveal
                mode="report"
                photos={inspection.photos}
                findings={findings}
                address={address}
                repName={repName}
                customerName={customerName}
              />
            </ReportSection>
          )}

          {/* Drive folder */}
          {inspection.driveFolderUrl && (
            <ReportSection sectionKey="drive-folder">
              <a
                href={inspection.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#003087] hover:underline flex items-center gap-2 font-medium"
              >
                📁 View All Photos
              </a>
            </ReportSection>
          )}

          {/* Structures */}
          {inspection.structures.length > 0 && (
            <ReportSection sectionKey="structures" title="Roof Structures">
              <div className="flex flex-col gap-6">
                {inspection.structures.map((s) => (
                  <div key={s.id}>
                    <h3 className="text-gray-800 font-semibold mb-2">{s.name}</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {[
                          ["Sq Ft", s.sqft],
                          ["Squares", s.squares],
                          ["Pitch", s.pitch],
                          ["Stories", s.stories],
                          ["Ridge", s.ridge ? `${s.ridge} ft` : null],
                          ["Hip", s.hip ? `${s.hip} ft` : null],
                          ["Valley", s.valley ? `${s.valley} ft` : null],
                          ["Package", s.recommendedPackage],
                        ]
                          .filter(([, v]) => v != null)
                          .map(([label, value], i) => (
                            <tr key={String(label)} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                              <td className="py-1.5 px-3 text-gray-500">{label}</td>
                              <td className="py-1.5 px-3 text-gray-800 font-medium">{String(value)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Quote */}
          {inspection.quote && (
            <ReportSection sectionKey="quote" title="Investment Summary">
              <div className="flex flex-col divide-y divide-gray-200">
                {inspection.quote.basePrice && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Base Price</span>
                    <span className="text-gray-800 font-medium">{fmt(inspection.quote.basePrice)}</span>
                  </div>
                )}
                {inspection.quote.nationalPromo && inspection.quote.basePrice && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">National Promotion (5%)</span>
                    <span className="text-red-500">-{fmt(inspection.quote.basePrice * 0.05)}</span>
                  </div>
                )}
                {inspection.quote.localPromo && inspection.quote.basePrice && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Local Promotion (10%)</span>
                    <span className="text-red-500">-{fmt(inspection.quote.basePrice * 0.1)}</span>
                  </div>
                )}
                {inspection.quote.fsp && inspection.quote.basePrice && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">FSP (10%)</span>
                    <span className="text-red-500">-{fmt(inspection.quote.basePrice * 0.1)}</span>
                  </div>
                )}
                {inspection.quote.nisi && (
                  <div className="flex justify-between py-3 font-semibold border-t-2 border-gray-300">
                    <span className="text-gray-900">Total Investment</span>
                    <span className="text-gray-900 text-lg">{fmt(inspection.quote.nisi)}</span>
                  </div>
                )}
                {inspection.quote.estMonthly && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Est. Monthly Payment</span>
                    <span className="text-gray-800 font-medium">{fmt(inspection.quote.estMonthly)}/mo</span>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Production notes (visible items only) */}
          {(inspection.gateCode || inspection.hasPets || inspection.accessIssues || inspection.colorSelected || inspection.specialRequests) && (
            <ReportSection sectionKey="production-notes" title="Project Details">
              <div className="flex flex-col gap-2 text-sm">
                {inspection.gateCode && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Gate Code</span>
                    <span className="text-gray-800">{inspection.gateCode}</span>
                  </div>
                )}
                {inspection.hasPets != null && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Pets on property</span>
                    <span className="text-gray-800">{inspection.hasPets ? "Yes" : "No"}</span>
                  </div>
                )}
                {inspection.accessIssues && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Access Issues</span>
                    <span className="text-gray-800">{inspection.accessIssues}</span>
                  </div>
                )}
                {inspection.colorSelected && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Color Selected</span>
                    <span className="text-gray-800">{inspection.colorSelected}</span>
                  </div>
                )}
                {inspection.specialRequests && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Special Requests</span>
                    <span className="text-gray-800">{inspection.specialRequests}</span>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

        </div>
      </SectionTracker>
    </div>
  );
}
