import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { WARNING_SIGNS } from "@/src/lib/warning-signs";
import ReportSection from "@/src/components/report/ReportSection";
import SectionTracker from "@/src/components/report/SectionTracker";

// PRESERVED — not active in Qntum build
// import { DAMAGE_GROUPS } from "@/src/lib/findings";
// import { detectPackageId } from "@/src/lib/packages";
// import PhotoReveal from "@/src/components/inspection/PhotoReveal";
// import PackageCard from "@/src/components/report/PackageCard";
// function fmt(n: number) { ... }
// function fmtLinear(decimal: number | null | undefined): string { ... }

interface DiagnosisFinding {
  id: string;
  label: string;
  explanation: string;
  severity: "critical" | "high" | "medium";
  status: "confirmed" | "suspected";
  matchedRoofTags: string[];
  matchedAtticTags: string[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high:     "bg-amber-50 border-amber-200 text-amber-700",
  medium:   "bg-yellow-50 border-yellow-200 text-yellow-700",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-amber-100 text-amber-700",
  medium:   "bg-yellow-100 text-yellow-700",
};

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
    include: {
      photos: { orderBy: { photoNumber: "asc" } },
      reportVisits: true,
    },
  });

  if (!inspection) notFound();

  const customerName = inspection.customerName || "";
  const address = inspection.address || "";
  const repName = inspection.repName || "Qntum Roofing";
  const firstName = customerName.split(" ")[0] || "You";
  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const diagnosis = (Array.isArray(inspection.diagnosis) ? inspection.diagnosis : []) as unknown as DiagnosisFinding[];
  const warningSignsCovered = (inspection.warningSignsCovered as string[]) || [];
  const coveredSigns = WARNING_SIGNS.filter((s) => warningSignsCovered.includes(s.id));

  const roofPhotos = inspection.photos.filter((p) => p.photoSection === "roof");
  const atticPhotos = inspection.photos.filter((p) => p.photoSection === "attic");

  const pass2Complete = inspection.intakePass2Complete;

  const aiDiagnosisDescription = inspection.aiDiagnosisDescription ?? null;
  const intakePass2 = inspection.intakePass2 as Record<string, unknown> | null;
  const postDiagnosisAdmission =
    typeof intakePass2?.postDiagnosisAdmission === "string"
      ? intakePass2.postDiagnosisAdmission
      : null;

  return (
    <div className="min-h-screen bg-report-bg">
      <SectionTracker uuid={uuid}>
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

          {/* Header */}
          <ReportSection sectionKey="header">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/qntum-logo.svg"
                alt="Qntum Roofing"
                style={{ height: "28px", width: "auto", filter: "brightness(0) saturate(100%)" }}
              />
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

          {/* Photos */}
          {(roofPhotos.length > 0 || atticPhotos.length > 0) && (
            <ReportSection sectionKey="photos" title="Photo Documentation">
              {roofPhotos.length > 0 && (
                <div className="mb-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Roof ({roofPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {roofPhotos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={p.r2Url}
                        alt={`Roof photo ${p.photoNumber}`}
                        className="w-full aspect-square object-cover rounded-lg border border-report-border"
                      />
                    ))}
                  </div>
                </div>
              )}
              {atticPhotos.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Attic ({atticPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {atticPhotos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={p.r2Url}
                        alt={`Attic photo ${p.photoNumber}`}
                        className="w-full aspect-square object-cover rounded-lg border border-report-border"
                      />
                    ))}
                  </div>
                </div>
              )}
            </ReportSection>
          )}

          {/* Roof Diagnosis */}
          {(aiDiagnosisDescription || postDiagnosisAdmission) && (
            <ReportSection sectionKey="roof-diagnosis" title="Roof Diagnosis">
              <div className="flex flex-col gap-5">
                {aiDiagnosisDescription && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">What We Found</p>
                    <p className="text-report-text text-sm leading-relaxed">{aiDiagnosisDescription}</p>
                  </div>
                )}
                {postDiagnosisAdmission && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">In Your Own Words</p>
                    <p className="text-gray-600 text-sm mb-3">
                      After reviewing the inspection findings, here&apos;s how you described the condition of your roof:
                    </p>
                    <blockquote className="border-l-3 border-report-heading pl-4 text-report-text text-sm italic leading-relaxed bg-report-surface rounded-r-xl py-3 pr-3">
                      {postDiagnosisAdmission}
                    </blockquote>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Diagnosis */}
          {diagnosis.length > 0 && (
            <ReportSection sectionKey="diagnosis" title="Inspection Findings">
              <p className="text-gray-600 text-sm mb-4">
                {diagnosis.length} finding{diagnosis.length !== 1 ? "s" : ""} identified
              </p>
              <div className="flex flex-col gap-4">
                {diagnosis.map((f) => (
                  <div
                    key={f.id}
                    className={`border rounded-xl p-4 ${SEVERITY_STYLES[f.severity] || "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEVERITY_BADGE[f.severity]}`}>
                        {f.severity.toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-base">{f.label}</h3>
                      <span className="text-xs capitalize text-gray-500">({f.status})</span>
                    </div>
                    <p className="text-sm leading-relaxed">{f.explanation}</p>
                    {(f.matchedRoofTags.length > 0 || f.matchedAtticTags.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                        {f.matchedRoofTags.map((t) => (
                          <span key={t} className="bg-white/60 border border-current/20 px-2 py-0.5 rounded-md">{t}</span>
                        ))}
                        {f.matchedAtticTags.map((t) => (
                          <span key={t} className="bg-white/60 border border-current/20 px-2 py-0.5 rounded-md">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Property Background */}
          {(inspection.timeInHome || inspection.yearBuilt || inspection.ageOfRoof || inspection.lastReplacedBy || inspection.pastRepairs) && (
            <ReportSection sectionKey="property-background" title="Property Background">
              <div className="flex flex-col gap-2 text-sm">
                {inspection.timeInHome && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Time in home</span>
                    <span className="text-report-text">{inspection.timeInHome}</span>
                  </div>
                )}
                {inspection.yearBuilt && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Year built</span>
                    <span className="text-report-text">{inspection.yearBuilt}</span>
                  </div>
                )}
                {inspection.ageOfRoof && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Age of roof</span>
                    <span className="text-report-text">{inspection.ageOfRoof}</span>
                  </div>
                )}
                {inspection.lastReplacedBy && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Last replaced by</span>
                    <span className="text-report-text">{inspection.lastReplacedBy}</span>
                  </div>
                )}
                {inspection.pastRepairs && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Past repairs</span>
                    <span className="text-report-text">{inspection.pastRepairs}</span>
                  </div>
                )}
                {inspection.hoaPresent && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">HOA</span>
                    <span className="text-report-text">{inspection.hoaName || "Yes"}</span>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Issues & Concerns */}
          {(inspection.issuesConcerns || inspection.issueDuration || inspection.issueImpact) && (
            <ReportSection sectionKey="issues" title="Issues & Concerns">
              <div className="flex flex-col gap-2 text-sm">
                {inspection.issuesConcerns && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Concerns</p>
                    <p className="text-report-text">{inspection.issuesConcerns}</p>
                  </div>
                )}
                {inspection.issueDuration && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-36">Duration</span>
                    <span className="text-report-text">{inspection.issueDuration}</span>
                  </div>
                )}
                {inspection.issueImpact && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mt-2 mb-1">Impact</p>
                    <p className="text-report-text">{inspection.issueImpact}</p>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Problem Awareness */}
          {(inspection.problemAwarenessBefore || (pass2Complete && inspection.problemAwarenessAfter)) && (
            <ReportSection sectionKey="problem-awareness" title="Problem Awareness">
              {inspection.problemAwarenessBefore && (
                <div className="mb-4">
                  <p className="text-gray-600 text-sm mb-2">
                    At the start of our visit, {firstName} described their concerns as:
                  </p>
                  <blockquote className="border-l-3 border-report-heading pl-4 text-report-text text-sm italic leading-relaxed bg-report-surface rounded-r-xl py-3 pr-3">
                    {inspection.problemAwarenessBefore}
                  </blockquote>
                </div>
              )}
              {pass2Complete && inspection.problemAwarenessAfter && (
                <div>
                  <p className="text-gray-600 text-sm mb-2">
                    After reviewing the inspection findings, {firstName} shared:
                  </p>
                  <blockquote className="border-l-3 border-gray-400 pl-4 text-report-text text-sm italic leading-relaxed bg-report-surface rounded-r-xl py-3 pr-3">
                    {inspection.problemAwarenessAfter}
                  </blockquote>
                </div>
              )}
            </ReportSection>
          )}

          {/* Topics Reviewed */}
          {coveredSigns.length > 0 && (
            <ReportSection sectionKey="warning-signs-covered" title="Topics Reviewed">
              <ul className="flex flex-col gap-1.5">
                {coveredSigns.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-report-text text-sm">
                    <span className="text-green-600">✓</span>
                    {s.title}
                  </li>
                ))}
              </ul>
            </ReportSection>
          )}

          {/* PRESERVED — not active in Qntum build */}
          {/* structures section */}
          {/* packages section */}
          {/* package-details section */}
          {/* production-notes section */}

        </div>
      </SectionTracker>
    </div>
  );
}
