import { prisma } from "@/src/lib/prisma";

const GHL_BASE = "https://services.leadconnectorhq.com";

function ghlHeaders(): HeadersInit {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Version": "2021-04-15",
  };
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[ghl] ${label} failed — HTTP ${res.status}: ${body}`);
  }
}

export async function sendGhlSms(ghlContactId: string, message: string): Promise<void> {
  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({
      type: "SMS",
      contactId: ghlContactId,
      message,
    }),
  });
  await assertOk(res, `sendGhlSms(${ghlContactId})`);
}

export async function addGhlTag(ghlContactId: string, ...tags: string[]): Promise<void> {
  const res = await fetch(`${GHL_BASE}/contacts/${ghlContactId}/tags`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({ tags }),
  });
  await assertOk(res, `addGhlTag(${ghlContactId}, [${tags.join(", ")}])`);
}

export async function removeGhlTag(ghlContactId: string, tag: string): Promise<void> {
  const res = await fetch(`${GHL_BASE}/contacts/${ghlContactId}/tags`, {
    method: "DELETE",
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] }),
  });
  await assertOk(res, `removeGhlTag(${ghlContactId}, ${tag})`);
}

export async function notifyRep(repUserId: string, message: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: repUserId }, select: { ghlContactId: true } });
  if (!user?.ghlContactId) {
    console.warn(`[notifyRep] User ${repUserId} has no ghlContactId — SMS skipped`);
    return;
  }
  await sendGhlSms(user.ghlContactId, message);
}

export async function notifyManager(message: string): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "REGIONAL", "SALES_MANAGER"] }, isActive: true, ghlContactId: { not: null } },
    select: { ghlContactId: true },
  });
  await Promise.allSettled(managers.map((m) => sendGhlSms(m.ghlContactId!, message)));
}
