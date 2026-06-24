import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canViewLead } from "@/src/lib/permissions";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewLead(user.id, user.role, lead)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { content, phase } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId: id,
      content: content.trim(),
      phase: phase || null,
      authorId: user.id,
      authorName: user.email || null,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
