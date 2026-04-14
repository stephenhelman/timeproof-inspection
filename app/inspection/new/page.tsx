import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: { leadId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leadId = searchParams?.leadId ?? null;

  // If a leadId is provided, pre-populate from the lead
  let customerId: string | undefined;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead) {
      // Create a customer record from the lead's data so the wizard is pre-filled
      const customer = await prisma.customer.create({
        data: {
          name: lead.customerName,
          address: lead.address,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
        },
      });
      customerId = customer.id;

      // Advance the lead status if it's NEW or REVIVAL_PENDING
      if (lead.status === "NEW" || lead.status === "REVIVAL_PENDING") {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "INSPECTION_SCHEDULED" },
        });
      }
    }
  }

  const inspection = await prisma.inspection.create({
    data: {
      userId: session.user.id,
      ...(leadId ? { leadId } : {}),
      ...(customerId ? { customerId } : {}),
    },
  });

  redirect(`/inspection/${inspection.id}`);
}
