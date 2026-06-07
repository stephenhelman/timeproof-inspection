import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { WARNING_SIGNS } from "@/src/lib/warning-signs";
import ReportSection from "@/src/components/report/ReportSection";
import SectionTracker from "@/src/components/report/SectionTracker";
import PhotoSlideshow from "@/src/components/report/PhotoSlideshow";
import { parseDiagnosisText } from "@/src/lib/diagnosis-parser";
import type { ParsedZone } from "@/src/lib/diagnosis-parser";

interface DiagnosisFinding {
  id: string;
  label: string;
  explanation: string;
  severity: "critical" | "high" | "medium";
  status: "confirmed" | "suspected";
  matchedRoofTags: string[];
  matchedAtticTags: string[];
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

const OLD_SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high:     "bg-amber-50 border-amber-200 text-amber-700",
  medium:   "bg-yellow-50 border-yellow-200 text-yellow-700",
};

const OLD_SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-amber-100 text-amber-700",
  medium:   "bg-yellow-100 text-yellow-700",
};

const STRUCTURED_SEVERITY_BADGE: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-green-100 text-green-700",
};

const OVERALL_SEVERITY_STYLES: Record<string, string> = {
  high:   "bg-red-50 border-red-200 text-red-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low:    "bg-green-50 border-green-200 text-green-700",
};

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Renders zone cards from parsed diagnosis text — no "Ask them:" labels
function ReportZoneCard({ zone }: { zone: ParsedZone }) {
  const visibleBlocks = zone.blocks.filter((b) => b.type !== "question");
  return (
    <div className="bg-report-surface border border-report-border rounded-xl p-4 flex flex-col gap-3">
      {zone.name && (
        <p className="text-report-text font-bold text-sm">{zone.name}</p>
      )}
      {visibleBlocks.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i} className="text-report-text text-sm leading-relaxed">
              {block.text}
            </p>
          );
        }
        if (block.type === "callout") {
          return (
            <div
              key={i}
              className="border-l-4 border-[#2a6db5] bg-[#eef3fb] rounded-r-xl px-4 py-3"
            >
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">
                In their words
              </p>
              <p className="text-report-text text-sm italic leading-relaxed">
                &ldquo;{block.text}&rdquo;
              </p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
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
      photos: { orderBy: { photoNumber: "asc" } },
      reportVisits: true,
    },
  });

  if (!inspection) notFound();

  const customerName = inspection.customerName || "";
  const address = inspection.address || "";
  const repName = inspection.repName || "Qntum Roofing";
  const date = new Date(inspection.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --- Section: What You Came In Believing ---
  // Read from flat fields first; fall back to intakePass1 JSON snapshot
  const intakePass1 = inspection.intakePass1 as Record<string, unknown> | null;
  function getIntakeField(flatVal: string | null | undefined, key: string): string | null {
    if (flatVal && typeof flatVal === "string" && flatVal.trim()) return flatVal.trim();
    const v = intakePass1?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  }
  const issuesConcerns       = getIntakeField(inspection.issuesConcerns, "issuesConcerns");
  const issueDuration        = getIntakeField(inspection.issueDuration, "issueDuration");
  const rootCauseBeliefBefore = getIntakeField(inspection.rootCauseBeliefBefore, "rootCauseBeliefBefore");
  const triggerMoment        = getIntakeField(inspection.triggerMoment, "triggerMoment");
  const problemAwarenessBefore = getIntakeField(inspection.problemAwarenessBefore, "problemAwarenessBefore");
  const hasBeliefContent = !!(issuesConcerns || issueDuration || rootCauseBeliefBefore || triggerMoment || problemAwarenessBefore);

  // --- Section: Warning Signs ---
  const warningSignsCovered = (inspection.warningSignsCovered as string[]) || [];
  const acknowledgedSigns = WARNING_SIGNS.filter((s) => warningSignsCovered.includes(s.id));

  // --- Section: Photos ---
  const allPhotos = inspection.photos.map((p) => ({
    id: p.id,
    r2Url: p.r2Url,
    zone: p.zone,
    damageTags: p.damageTags,
    photoNumber: p.photoNumber,
    photoSection: p.photoSection,
  }));

  // --- Section: AI Diagnosis ---
  const aiDiagnosisDescription = inspection.aiDiagnosisDescription ?? null;
  const aiDiagnosisStructured = (inspection.aiDiagnosisStructured as StructuredDiagnosis | null) ?? null;
  const parsedZones = aiDiagnosisDescription ? parseDiagnosisText(aiDiagnosisDescription) : [];

  const overallSev = aiDiagnosisStructured?.overallSeverity;

  // --- Section: Post-diagnosis admission ---
  const intakePass2 = inspection.intakePass2 as Record<string, unknown> | null;
  const postDiagnosisAdmission =
    typeof intakePass2?.postDiagnosisAdmission === "string" && intakePass2.postDiagnosisAdmission.trim()
      ? intakePass2.postDiagnosisAdmission.trim()
      : null;

  // --- Old diagnosis findings (kept as-is) ---
  const diagnosis = (Array.isArray(inspection.diagnosis) ? inspection.diagnosis : []) as unknown as DiagnosisFinding[];

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

          {/* Section 1 — Property Background */}
          {(inspection.timeInHome || inspection.yearBuilt || inspection.ageOfRoof || inspection.lastReplacedBy || inspection.pastRepairs || inspection.hoaPresent) && (
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

          {/* Section 2 — What You Came In Believing */}
          {hasBeliefContent && (
            <ReportSection sectionKey="pre-inspection-beliefs" title="What You Came In Believing">
              <p className="text-gray-500 text-sm">
                Before the inspection, here&apos;s what you shared with us.
              </p>

              <div className="flex flex-col gap-4 mt-1">
                {issuesConcerns && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                      What you mentioned
                    </p>
                    <p className="text-report-text text-sm leading-relaxed">{issuesConcerns}</p>
                  </div>
                )}

                {issueDuration && (
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500 shrink-0">How long</span>
                    <span className="text-report-text">{issueDuration}</span>
                  </div>
                )}

                {rootCauseBeliefBefore && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                      What you thought the cause was
                    </p>
                    <p className="text-report-text text-sm leading-relaxed">{rootCauseBeliefBefore}</p>
                  </div>
                )}

                {triggerMoment && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                      What prompted this inspection
                    </p>
                    <p className="text-report-text text-sm leading-relaxed">{triggerMoment}</p>
                  </div>
                )}

                {problemAwarenessBefore && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
                      In your own words
                    </p>
                    <blockquote className="border-l-4 border-[#2a6db5] bg-[#eef3fb] pl-4 pr-3 py-3 rounded-r-xl text-report-text text-sm italic leading-relaxed">
                      {problemAwarenessBefore}
                    </blockquote>
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Section 3 — Warning Signs You Recognized */}
          {acknowledgedSigns.length > 0 && (
            <ReportSection sectionKey="warning-signs-recognized" title="Warning Signs You Recognized">
              <p className="text-gray-500 text-sm">
                During the inspection, you identified these as concerns.
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {acknowledgedSigns.map((s) => (
                  <span
                    key={s.id}
                    className="bg-report-surface border border-report-border text-report-text text-sm font-medium px-3 py-1.5 rounded-full"
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Section 4 — Photo Documentation (slideshow) */}
          {allPhotos.length > 0 && (
            <ReportSection sectionKey="photos" title="Photo Documentation">
              <PhotoSlideshow photos={allPhotos} reportUuid={uuid} />
            </ReportSection>
          )}

          {/* Section 5 — What We Found */}
          {(parsedZones.length > 0 || aiDiagnosisStructured) && (
            <ReportSection sectionKey="what-we-found" title="What We Found">
              <div className="flex flex-col gap-4">

                {/* Parsed zone cards */}
                {parsedZones.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {parsedZones.map((zone, i) => (
                      <ReportZoneCard key={i} zone={zone} />
                    ))}
                  </div>
                )}

                {/* Structured findings */}
                {aiDiagnosisStructured && (
                  <div className="flex flex-col gap-3">

                    {/* Overall severity */}
                    {overallSev && (
                      <div
                        className={`border rounded-xl px-4 py-3 ${OVERALL_SEVERITY_STYLES[overallSev] ?? OVERALL_SEVERITY_STYLES.medium}`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-70">
                          Overall Severity
                        </p>
                        <p className="text-base font-bold">
                          Overall:{" "}
                          {overallSev.charAt(0).toUpperCase() + overallSev.slice(1)} Severity
                        </p>
                        {aiDiagnosisStructured.primaryConcern && (
                          <p className="text-xs mt-0.5 opacity-80">
                            Primary concern: {toTitleCase(aiDiagnosisStructured.primaryConcern)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Zone finding cards */}
                    {aiDiagnosisStructured.zones && aiDiagnosisStructured.zones.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {aiDiagnosisStructured.zones.map((z, i) => (
                          <div
                            key={i}
                            className="bg-report-surface border border-report-border rounded-xl p-4 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-report-text font-semibold text-sm">{z.zone}</p>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STRUCTURED_SEVERITY_BADGE[z.severity] ?? STRUCTURED_SEVERITY_BADGE.medium}`}
                              >
                                {z.severity}
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm">{toTitleCase(z.findingType)}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {z.confidence > 0 && (
                                <span className="text-gray-400 text-xs">
                                  {Math.round(z.confidence * 100)}% confidence
                                </span>
                              )}
                              {z.referencedWarningSign && (
                                <span className="bg-white border border-report-border rounded-full px-2 py-0.5 text-gray-500 text-xs">
                                  {z.referencedWarningSign.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Homeowner admissions */}
                    {aiDiagnosisStructured.homeownerAdmissions &&
                      aiDiagnosisStructured.homeownerAdmissions.length > 0 && (
                        <div className="bg-report-surface border border-report-border rounded-xl p-4 flex flex-col gap-3">
                          <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
                            What you acknowledged
                          </p>
                          <ul className="flex flex-col gap-2">
                            {aiDiagnosisStructured.homeownerAdmissions.map((admission, i) => (
                              <li key={i} className="flex items-start gap-2 text-report-text text-sm">
                                <span className="text-[#2a6db5] shrink-0 mt-0.5">&ldquo;</span>
                                <span className="italic leading-relaxed">{admission}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </ReportSection>
          )}

          {/* Section 6 — After Reviewing the Findings */}
          {postDiagnosisAdmission && (
            <ReportSection sectionKey="after-reviewing" title="After Reviewing the Findings">
              <p className="text-gray-500 text-sm">
                After seeing the inspection photos and diagnosis, here&apos;s how you described the condition of your roof:
              </p>
              <div className="relative mt-2">
                {/* Large decorative quote mark */}
                <span
                  className="absolute -top-2 -left-1 text-7xl leading-none text-[#2a6db5]/20 font-serif select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <div className="bg-[#eef3fb] border border-[#c8d8f0] rounded-2xl px-6 py-5 ml-4">
                  <p className="text-report-text text-base italic leading-relaxed">
                    {postDiagnosisAdmission}
                  </p>
                </div>
              </div>
            </ReportSection>
          )}

          {/* Inspection Findings (old diagnosis[] — preserved, unchanged) */}
          {diagnosis.length > 0 && (
            <ReportSection sectionKey="diagnosis" title="Inspection Findings">
              <p className="text-gray-600 text-sm mb-4">
                {diagnosis.length} finding{diagnosis.length !== 1 ? "s" : ""} identified
              </p>
              <div className="flex flex-col gap-4">
                {diagnosis.map((f) => (
                  <div
                    key={f.id}
                    className={`border rounded-xl p-4 ${OLD_SEVERITY_STYLES[f.severity] || "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${OLD_SEVERITY_BADGE[f.severity]}`}>
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

        </div>
      </SectionTracker>
    </div>
  );
}
