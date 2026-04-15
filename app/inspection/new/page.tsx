import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { leadId } = await searchParams;

  let prefill: {
    customerName?: string;
    address?: string;
    phone?: string | null;
    email?: string | null;
    leadId?: string;
  } = {};

  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead) {
      prefill = {
        leadId,
        customerName: lead.customerName,
        address: [lead.streetAddress, lead.city, `${lead.state} ${lead.zip}`]
          .filter(Boolean)
          .join(", "),
        phone: lead.phone,
        email: lead.email,
      };

      // Advance lead status if it's new/pending
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
      ...(prefill.leadId ? { leadId: prefill.leadId } : {}),
      ...(prefill.customerName ? { customerName: prefill.customerName } : {}),
      ...(prefill.address ? { address: prefill.address } : {}),
      ...(prefill.phone ? { phone: prefill.phone } : {}),
      ...(prefill.email ? { email: prefill.email } : {}),
    },
  });

  redirect(`/inspection/${inspection.id}`);
}
