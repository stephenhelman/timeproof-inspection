import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { DAMAGE_GROUPS } from "@/src/lib/findings";
import { detectPackageId } from "@/src/lib/packages";
import ReportSection from "@/src/components/report/ReportSection";
import SectionTracker from "@/src/components/report/SectionTracker";
import PhotoReveal from "@/src/components/inspection/PhotoReveal";
import PackageCard from "@/src/components/report/PackageCard";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtLinear(decimal: number | null | undefined): string {
  if (decimal == null) return "—";
  const ft = Math.floor(decimal);
  const ins = Math.round((decimal - ft) * 12);
  return ins > 0 ? `${ft}' ${ins}"` : `${ft}'`;
}

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
      packages: { orderBy: { order: "asc" } },
      quote: true,
      reportVisits: true,
    },
  });

  if (!inspection) notFound();

  const findings = (inspection.findings as Record<string, boolean>) || {};
  const customerName = inspection.customer?.name || "";
  const address = inspection.customer?.address || "";
  const repName = inspection.repName || "TIMEPROOF";
  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const checkedFindings = Object.entries(findings).filter(([, v]) => v === true);

  return (
    <div className="min-h-screen bg-report-bg">
      <SectionTracker uuid={uuid}>
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

          {/* Header */}
          <ReportSection sectionKey="header">
            <div className="flex items-center gap-4">
              <div className="w-32 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white">
                <img src="/logo.png" alt="TIMEPROOF" className="h-8 w-auto px-2" />
              </div>
              <div>
                <h1 className="text-report-text font-semibold text-xl">Roof Inspection Report</h1>
                <p className="text-gray-500 text-sm">{date} · {repName}</p>
              </div>
            </div>
          </ReportSection>

          {/* Customer Info */}
          <ReportSection sectionKey="customer-info" title="Customer Information">
            <div className="flex flex-col gap-1">
              <p className="text-report-text font-semibold text-lg">{customerName}</p>
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
                            <span className="text-report-heading">•</span>
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

          {/* Structures */}
          {inspection.structures.length > 0 && (
            <ReportSection sectionKey="structures" title="Roof Structures">
              <div className="flex flex-col gap-6">
                {inspection.structures.map((s) => (
                  <div key={s.id}>
                    <h3 className="text-report-text font-semibold mb-2">{s.name}</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {[
                          ["Sq Ft", s.sqft != null ? s.sqft.toLocaleString() : null],
                          ["Pitch", s.pitch],
                          ["Ridge", fmtLinear(s.ridge)],
                          ["Hip", fmtLinear(s.hip)],
                          ["Valley", fmtLinear(s.valley)],
                          ["Rake", fmtLinear(s.rake)],
                          ["Eave", fmtLinear(s.eave)],
                          ["Flashing", fmtLinear(s.flashing)],
                          ["Step Flashing", fmtLinear(s.stepFlashing)],
                          ["Parapets", fmtLinear(s.parapets)],
                          ["Other", fmtLinear(s.other)],
                        ]
                          .filter(([, v]) => v != null && v !== "—")
                          .map(([label, value], i) => (
                            <tr key={String(label)} className={i % 2 === 0 ? "bg-report-surface" : "bg-report-bg"}>
                              <td className="py-1.5 px-3 text-gray-500">{label}</td>
                              <td className="py-1.5 px-3 text-report-text font-medium">{String(value)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {/* Penetrations */}
                    {(s.pipeBoots || s.skylights || s.chimneys || s.boxVents || s.turbines || s.atticFans) && (
                      <div className="mt-3">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5">Penetrations</p>
                        <table className="w-full text-sm">
                          <tbody>
                            {[
                              ["Pipe Boots", s.pipeBoots],
                              ["Skylights", s.skylights],
                              ["Chimneys", s.chimneys],
                              ["Box Vents", s.boxVents],
                              ["Turbines", s.turbines],
                              ["Attic Fans", s.atticFans],
                            ]
                              .filter(([, v]) => v != null && Number(v) > 0)
                              .map(([label, value], i) => (
                                <tr key={String(label)} className={i % 2 === 0 ? "bg-report-surface" : "bg-report-bg"}>
                                  <td className="py-1.5 px-3 text-gray-500">{label}</td>
                                  <td className="py-1.5 px-3 text-report-text font-medium">{String(value)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Packages */}
          {inspection.packages.length > 0 && (
            <ReportSection sectionKey="packages" title="Investment Options">
              <div className="flex flex-col gap-5">
                {[...inspection.packages]
                  .sort((a, b) => (a.recommended === b.recommended ? 0 : a.recommended ? -1 : 1))
                  .map((p) => {
                    const npDiscount = p.basePrice * (p.nationalPromo ? 0.05 : 0);
                    const lpDiscount = (p.basePrice - npDiscount) * (p.localPromo ? 0.1 : 0);
                    const fspDiscount = (p.basePrice - npDiscount - lpDiscount) * (p.fsp ? 0.1 : 0);
                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl overflow-hidden border ${
                          p.recommended
                            ? "border-amber-400 shadow-md shadow-amber-100"
                            : "border-report-border"
                        }`}
                      >
                        {/* Card header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${
                          p.recommended ? "bg-amber-400" : "bg-report-heading"
                        }`}>
                          <h3 className={`font-bold text-base ${p.recommended ? "text-amber-900" : "text-white"}`}>
                            {p.name}
                          </h3>
                          {p.recommended && (
                            <span className="text-amber-900 text-xs font-bold uppercase tracking-wider bg-amber-300 px-2.5 py-1 rounded-full">
                              ⭐ Recommended
                            </span>
                          )}
                        </div>
                        {/* Line items */}
                        <div className="divide-y divide-report-border">
                          {p.basePrice > 0 && (
                            <div className="flex justify-between px-4 py-2 bg-report-bg">
                              <span className="text-gray-600 text-sm">Base Price</span>
                              <span className="text-report-text text-sm font-medium">{fmt(p.basePrice)}</span>
                            </div>
                          )}
                          {p.nationalPromo && (
                            <div className="flex justify-between px-4 py-2 bg-report-bg">
                              <span className="text-gray-600 text-sm">National Promotion (5%)</span>
                              <span className="text-red-500 text-sm">−{fmt(npDiscount)}</span>
                            </div>
                          )}
                          {p.localPromo && (
                            <div className="flex justify-between px-4 py-2 bg-report-bg">
                              <span className="text-gray-600 text-sm">Local Promotion (10%)</span>
                              <span className="text-red-500 text-sm">−{fmt(lpDiscount)}</span>
                            </div>
                          )}
                          {p.fsp && (
                            <div className="flex justify-between px-4 py-2 bg-report-bg">
                              <span className="text-gray-600 text-sm">FSP (10%)</span>
                              <span className="text-red-500 text-sm">−{fmt(fspDiscount)}</span>
                            </div>
                          )}
                          {p.nisi != null && (
                            <div className={`flex justify-between px-4 py-3 ${p.recommended ? "bg-amber-50" : "bg-report-surface"}`}>
                              <span className="text-report-text font-bold">Total Investment</span>
                              <span className={`font-bold text-lg ${p.recommended ? "text-amber-700" : "text-report-heading"}`}>
                                {fmt(p.nisi)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ReportSection>
          )}

          {/* Package details */}
          {(() => {
            const recommended = inspection.packages.find((p) => p.recommended);
            const configId = recommended ? detectPackageId(recommended.name) : null;
            if (!configId) return null;
            return (
              <ReportSection sectionKey="package-details" title="Your Package">
                <PackageCard packageId={configId} isRecommended={true} />
              </ReportSection>
            );
          })()}

          {/* Production notes (visible items only) */}
          {(inspection.gateCode || inspection.hasPets || inspection.accessIssues || inspection.colorSelected || inspection.specialRequests) && (
            <ReportSection sectionKey="production-notes" title="Project Details">
              <div className="flex flex-col gap-2 text-sm">
                {inspection.gateCode && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Gate Code</span>
                    <span className="text-report-text">{inspection.gateCode}</span>
                  </div>
                )}
                {inspection.hasPets != null && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Pets on property</span>
                    <span className="text-report-text">{inspection.hasPets ? "Yes" : "No"}</span>
                  </div>
                )}
                {inspection.accessIssues && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Access Issues</span>
                    <span className="text-report-text">{inspection.accessIssues}</span>
                  </div>
                )}
                {inspection.colorSelected && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Color Selected</span>
                    <span className="text-report-text">{inspection.colorSelected}</span>
                  </div>
                )}
                {inspection.specialRequests && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-28">Special Requests</span>
                    <span className="text-report-text">{inspection.specialRequests}</span>
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
