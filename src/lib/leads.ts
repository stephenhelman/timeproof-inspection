import { prisma } from "./prisma";

const REVIVAL_TRIGGER_STATUSES = [
  "INSPECTION_COMPLETE",
  "QUOTED",
  "DEMO_NOT_SOLD",
  "DENIED",
];

export async function autoFlagRevival(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { status: true, inspections: { select: { status: true } } },
  });
  if (!lead) return;
  if (!REVIVAL_TRIGGER_STATUSES.includes(lead.status)) return;
  const hasSold = lead.inspections.some((i) => i.status === "sold");
  if (!hasSold) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "REVIVAL_PENDING" } });
  }
}
