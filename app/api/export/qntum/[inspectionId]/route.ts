import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// ============================================================
// QNTUM EXPORT PAYLOAD MAP — UPDATE THIS WHEN YOU HAVE THE
// REAL QNTUM API OR GHL WEBHOOK FORMAT.
// All field mappings live here.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildQntumPayload(inspection: any) {
  return {
    // Customer
    customer_name:    inspection.customerName,
    address:          inspection.address,
    phone:            inspection.phone,
    email:            inspection.email,
    appointment_at:   inspection.appointmentAt,

    // Diagnosis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findings: inspection.diagnosis?.map((d: any) => ({
      issue:       d.label,
      severity:    d.severity,
      status:      d.status,
      description: d.explanation,
    })),

    // Photos
    roof_photos: inspection.photos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((p: any) => p.photoSection === "roof")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ url: p.r2Url, tags: p.damageTags })),
    attic_photos: inspection.photos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((p: any) => p.photoSection === "attic")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ url: p.r2Url, tags: p.damageTags })),

    // Intake (no NEPQ labels, no rep notes)
    property_background: {
      time_in_home:     inspection.timeInHome,
      year_built:       inspection.yearBuilt,
      age_of_roof:      inspection.ageOfRoof,
      last_replaced_by: inspection.lastReplacedBy,
      past_repairs:     inspection.pastRepairs,
      hoa:              inspection.hoaPresent,
      hoa_name:         inspection.hoaName,
    },
    issues: {
      concerns:      inspection.issuesConcerns,
      duration:      inspection.issueDuration,
      impact:        inspection.issueImpact,
      trigger:       inspection.triggerMoment,
    },
    problem_awareness: {
      before: inspection.problemAwarenessBefore,
      after:  inspection.problemAwarenessAfter,
    },
    warning_signs_covered: inspection.warningSignsCovered,

    // Source
    scope_report_url: `${process.env.NEXT_PUBLIC_APP_URL}/summary/${inspection.reportUuid}`,
  }
}
// ============================================================

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inspectionId } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { photos: { orderBy: { photoNumber: "asc" } } },
  });

  if (!inspection || inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (inspection.status !== "complete") {
    return NextResponse.json(
      { error: "Inspection must be complete before exporting" },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.QNTUM_EXPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "QNTUM_EXPORT_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const payload = buildQntumPayload(inspection);

  const exportRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.QNTUM_EXPORT_SECRET || ""}`,
    },
    body: JSON.stringify(payload),
  });

  if (!exportRes.ok) {
    const detail = await exportRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Qntum export failed", detail },
      { status: 502 }
    );
  }

  const exportedAt = new Date();
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { qntumExportedAt: exportedAt },
  });

  return NextResponse.json({ success: true, exportedAt: exportedAt.toISOString() });
}
