import { prisma } from "./prisma";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { isWorkEmail } from "./auth-constants";

const resend = new Resend(process.env.RESEND_API_KEY);

export type CodePurpose = "registration" | "forgot-password" | "2fa" | "email-change" | "magic-login";

const PURPOSE_SUBJECTS: Record<CodePurpose, string> = {
  registration: "Your TIMEPROOF verification code",
  "forgot-password": "Reset your TIMEPROOF password",
  "2fa": "Your TIMEPROOF login code",
  "email-change": "Confirm your new TIMEPROOF email",
  "magic-login": "Your TIMEPROOF sign-in code",
};

const PURPOSE_MESSAGES: Record<CodePurpose, string> = {
  registration: "Use this code to verify your email and create your account.",
  "forgot-password": "Use this code to reset your password.",
  "2fa": "Use this code to complete your sign in.",
  "email-change": "Use this code to confirm your new email address.",
  "magic-login": "Use this code to sign in to your TIMEPROOF account.",
};

export async function sendVerificationCode(
  email: string,
  purpose: CodePurpose
): Promise<{ success: boolean; error?: string }> {
  if (purpose !== "2fa" && !isWorkEmail(email)) {
    return {
      success: false,
      error: "Only @timeproofusa.com email addresses are allowed",
    };
  }

  // Rate limit — 60s between sends for same email + purpose
  const recentCode = await prisma.registrationCode.findFirst({
    where: {
      email,
      purpose,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recentCode) {
    return {
      success: false,
      error: "Please wait before requesting another code",
    };
  }

  // Delete old codes for this email + purpose
  await prisma.registrationCode.deleteMany({ where: { email, purpose } });

  // Generate and hash code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 30 * 60_000);

  await prisma.registrationCode.create({
    data: { email, codeHash, expiresAt, purpose },
  });

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: PURPOSE_SUBJECTS[purpose],
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1B3A7A;">TIMEPROOF Inspection</h2>
          <p>${PURPOSE_MESSAGES[purpose]}</p>
          <div style="font-size: 48px; font-weight: bold; letter-spacing: 12px;
                      color: #1B3A7A; padding: 24px 0; text-align: center;">
            ${code}
          </div>
          <p style="color: #666;">This code expires in 30 minutes.</p>
          <p style="color: #666;">If you did not request this, ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">TIMEPROOF Inspection · scopereports.com</p>
        </div>
      `,
    });
  } catch {
    return { success: false, error: "Failed to send verification email" };
  }

  return { success: true };
}

export async function verifyCode(
  email: string,
  code: string,
  purpose: CodePurpose
): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.registrationCode.findFirst({
    where: { email, purpose, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { success: false, error: "Invalid or expired code" };
  }

  if (record.expiresAt < new Date()) {
    return { success: false, error: "Code has expired. Request a new one." };
  }

  if (record.attempts >= 5) {
    return { success: false, error: "Too many attempts. Request a new code." };
  }

  const valid = await bcrypt.compare(code, record.codeHash);

  if (!valid) {
    const newAttempts = record.attempts + 1;
    await prisma.registrationCode.update({
      where: { id: record.id },
      data: {
        attempts: newAttempts,
        used: newAttempts >= 5,
      },
    });
    if (newAttempts >= 5) {
      return { success: false, error: "Too many attempts. Request a new code." };
    }
    return { success: false, error: "Incorrect code. Please try again." };
  }

  await prisma.registrationCode.update({
    where: { id: record.id },
    data: { used: true },
  });

  return { success: true };
}

// Returns true if this email+purpose was successfully verified within the last 10 minutes
export async function wasRecentlyVerified(
  email: string,
  purpose: CodePurpose
): Promise<boolean> {
  const record = await prisma.registrationCode.findFirst({
    where: {
      email,
      purpose,
      used: true,
      updatedAt: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  return !!record;
}
