import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { WARNING_SIGNS } from "@/src/lib/warning-signs";
import ReportSection from "@/src/components/report/ReportSection";
import SectionTracker from "@/src/components/report/SectionTracker";
import PhotoSlideshow from "@/src/components/report/PhotoSlideshow";
import { parseDiagnosisText } from "@/src/lib/diagnosis-parser";
import type { ParsedZone } from "@/src/lib/diagnosis-parser";
import type { WalkthroughStep } from "@/src/components/report/GuidedWalkthrough";

interface RawWalkthroughStep {
  findingRef?: string;
  observation?: string;
  question?: string;
  photoRef?: string | null;
}

interface DiagnosisWalkthrough {
  walkthroughSteps?: RawWalkthroughStep[];
  closingQuestion?: string;
}

interface HomeownerWalkthroughAnswers {
  steps?: Array<{ stepRef?: string; answer?: string }>;
  closingAnswer?: string | null;
}

interface DiagnosisFinding {
  id: string;
  label: string;
  explanation: string;
  severity: "critical" | "high" | "medium";
  status: "confirmed" | "suspected";
  matchedRoofTags: string[];
  matchedAtticTags: string[];
}

// Legacy diagnosis[] findings styling (old inspections only).
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

  // --- Section: AI Diagnosis (homeowner view) ---
  // The homeowner sees the GUIDED NEPQ WALKTHROUGH only. All clinical data
  // (severity, confidence, finding-types, the acknowledged list) is rep + Jordan
  // only and is intentionally NOT read here.
  const aiDiagnosisDescription = inspection.aiDiagnosisDescription ?? null;
  const walkthrough = (inspection.aiDiagnosisWalkthrough as DiagnosisWalkthrough | null) ?? null;
  const walkthroughAnswers =
    (inspection.homeownerWalkthroughAnswers as HomeownerWalkthroughAnswers | null) ?? null;

  // Resolve each step's photos by zone (never expose the full photo set blindly).
  function resolveStepPhotos(step: RawWalkthroughStep): string[] {
    const ref = (step.photoRef || step.findingRef || "").toLowerCase().trim();
    if (!ref) return [];
    return allPhotos
      .filter((p) => {
        const z = (p.zone ?? "").toLowerCase().trim();
        return z.length > 0 && (z.includes(ref) || ref.includes(z));
      })
      .slice(0, 3)
      .map((p) => p.r2Url);
  }

  const walkthroughSteps: WalkthroughStep[] = (walkthrough?.walkthroughSteps ?? [])
    .filter((s) => s && (s.observation || s.question))
    .slice(0, 2)
    .map((s) => ({
      findingRef: s.findingRef ?? "",
      observation: s.observation ?? "",
      question: s.question ?? "",
      photoRef: s.photoRef ?? null,
      photos: resolveStepPhotos(s),
    }));

  const closingQuestion =
    walkthrough?.closingQuestion?.trim() ||
    "Based on everything you've seen today, what do you think the root issue might be?";

  // Read-only record: the homeowner's captured answers, shown back to them.
  const stepAnswerAt = (i: number): string =>
    (walkthroughAnswers?.steps?.[i]?.answer ?? "").trim();
  const closingAnswer = (walkthroughAnswers?.closingAnswer ?? "").trim();
  const hasAnyAnswer =
    closingAnswer.length > 0 || walkthroughSteps.some((_, i) => stepAnswerAt(i).length > 0);

  // Backward-compat: legacy inspections have no walkthrough. Fall back to the
  // prose zones (questions stripped), still WITHOUT any clinical cards.
  const legacyZones: ParsedZone[] =
    walkthroughSteps.length === 0 && aiDiagnosisDescription
      ? parseDiagnosisText(aiDiagnosisDescription)
      : [];

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

          {/* Section 5 — What We Walked Through (READ-ONLY record).
              Photos + narrative + the homeowner's captured answers shown back.
              No interactive form, no clinical data. Graceful when no answers. */}
          {walkthroughSteps.length > 0 ? (
            <ReportSection sectionKey="walkthrough" title="What We Walked Through">
              <p className="text-gray-500 text-sm">
                {hasAnyAnswer
                  ? "Here's what stood out during your inspection, and what you said as we walked through it together."
                  : "Here's what stood out during your inspection as we walked through it together."}
              </p>

              <div className="flex flex-col gap-5">
                {walkthroughSteps.map((step, i) => {
                  const answer = stepAnswerAt(i);
                  return (
                    <div
                      key={i}
                      className="bg-report-surface border border-report-border rounded-2xl p-5 flex flex-col gap-4"
                    >
                      {step.observation && (
                        <p className="text-report-text text-[15px] leading-relaxed">
                          {step.observation}
                        </p>
                      )}

                      {step.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                          {step.photos.map((url, pi) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={pi}
                              src={url}
                              alt={`${step.findingRef} photo ${pi + 1}`}
                              className="h-44 w-auto rounded-xl border border-report-border object-cover shrink-0"
                            />
                          ))}
                        </div>
                      )}

                      {step.question && (
                        <p className="text-report-text text-base font-semibold leading-snug">
                          {step.question}
                        </p>
                      )}

                      {answer && (
                        <div className="border-l-4 border-[#2a6db5] bg-[#eef3fb] rounded-r-xl px-4 py-3">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">
                            You said
                          </p>
                          <p className="text-report-text text-sm italic leading-relaxed">
                            &ldquo;{answer}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Closing — only when they answered it */}
                {closingAnswer && (
                  <div className="bg-[#eef3fb] border border-[#c8d8f0] rounded-2xl p-5 flex flex-col gap-3">
                    <p className="text-report-text text-base font-semibold leading-snug">
                      {closingQuestion}
                    </p>
                    <div className="border-l-4 border-[#2a6db5] bg-white/70 rounded-r-xl px-4 py-3">
                      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">
                        You said
                      </p>
                      <p className="text-report-text text-sm italic leading-relaxed">
                        &ldquo;{closingAnswer}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ReportSection>
          ) : (
            legacyZones.length > 0 && (
              <ReportSection sectionKey="what-we-found" title="What We Found">
                <div className="flex flex-col gap-3">
                  {legacyZones.map((zone, i) => (
                    <ReportZoneCard key={i} zone={zone} />
                  ))}
                </div>
              </ReportSection>
            )
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
