import { prisma } from "./prisma";
import crypto from "crypto";

export function generateDeviceToken(): string {
  return crypto.randomUUID();
}

export async function isDeviceTrusted(
  userId: string,
  deviceToken: string | undefined
): Promise<boolean> {
  if (!deviceToken) return false;

  const device = await prisma.trustedDevice.findUnique({
    where: { deviceToken },
  });

  if (!device) return false;
  if (device.userId !== userId) return false;
  if (device.expiresAt < new Date()) {
    await prisma.trustedDevice.delete({ where: { deviceToken } });
    return false;
  }

  await prisma.trustedDevice.update({
    where: { deviceToken },
    data: { lastUsedAt: new Date() },
  });

  return true;
}

export async function trustDevice(userId: string): Promise<string> {
  const deviceToken = generateDeviceToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.trustedDevice.create({
    data: { userId, deviceToken, expiresAt },
  });

  return deviceToken;
}

export async function untrustDevice(deviceToken: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { deviceToken } });
}

export async function untrustAllDevices(userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { userId } });
}
