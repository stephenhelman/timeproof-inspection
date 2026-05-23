import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import type { Lead } from "@prisma/client";
import { createHash } from "crypto";

export function validateWebhookSecret(request: NextRequest): NextResponse | null {
  const secret = request.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function parseInboundSms(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
): { ghlContactId: string; inboundMessage: string; idempotencyKey: string } | null {
  const ghlContactId =
    body?.contact_id ?? body?.contactId ?? body?.id ?? "";
  const inboundMessage =
    body?.message ?? body?.messageBody ?? body?.body ?? "";

  if (!ghlContactId || typeof ghlContactId !== "string") return null;
  if (typeof inboundMessage !== "string") return null;

  const timestamp = body?.timestamp ?? body?.dateAdded ?? Date.now().toString();
  const raw = `${ghlContactId}:${inboundMessage}:${timestamp}`;
  const idempotencyKey = createHash("sha256").update(raw).digest("hex");

  return { ghlContactId, inboundMessage, idempotencyKey };
}

export async function loadLead(ghlContactId: string): Promise<Lead | null> {
  return prisma.lead.findFirst({
    where: { ghlContactId },
    orderBy: { createdAt: "desc" },
  });
}

export async function isDuplicate(key: string): Promise<boolean> {
  const existing = await prisma.webhookLog.findUnique({
    where: { idempotencyKey: key },
  });
  return existing !== null;
}

export async function logWebhookHit(args: {
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  success: boolean;
  error?: string;
  leadId?: string;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    await prisma.webhookLog.create({
      data: {
        source: args.source,
        payload: args.payload ?? {},
        status: args.success ? "success" : "error",
        errorMessage: args.error ?? null,
        leadId: args.leadId ?? null,
        idempotencyKey: args.idempotencyKey ?? null,
      },
    });
  } catch (err) {
    console.error("[bot-webhook-utils] logWebhookHit failed:", err);
  }
}
