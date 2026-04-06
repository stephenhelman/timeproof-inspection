"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/src/components/ui/Logo";
import { DEVICE_TOKEN_COOKIE, DEVICE_TOKEN_EXPIRY_DAYS } from "@/src/lib/auth-constants";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    inputRefs[0].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < 5) inputRefs[index + 1].current?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs[5].current?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) return;
    setError("");
    setLoading(true);

    try {
      // Verify the 2FA code
      const verifyRes = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error || "Invalid code");
        setDigits(["", "", "", "", "", ""]);
        inputRefs[0].current?.focus();
        setLoading(false);
        return;
      }

      // Register this device as trusted
      const trustRes = await fetch("/api/auth/2fa/trust-device", {
        method: "POST",
      });
      if (trustRes.ok) {
        const { deviceToken } = await trustRes.json();
        const maxAge = DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
        document.cookie = `${DEVICE_TOKEN_COOKIE}=${deviceToken}; max-age=${maxAge}; path=/; SameSite=Strict`;
      }

      // Clear the requires2FA flag in the session JWT
      await update({ requires2FA: false });

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setCanResend(false);
    setResendSeconds(60);
    setResending(true);
    setError("");
    // Re-send the 2FA code
    try {
      await fetch("/api/auth/2fa/send-code", { method: "POST" });
    } finally {
      setResending(false);
    }
  }

  const codeComplete = digits.every((d) => d !== "");

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Logo height={52} />
        </div>

        <div className="bg-bg-surface border border-border rounded-3xl p-8">
          <h1 className="text-text-primary text-2xl font-bold mb-1">
            Check your email
          </h1>
          <p className="text-text-secondary text-base mb-2">
            New device detected. We sent a 6-digit code to
          </p>
          <p className="text-text-primary font-medium mb-8">{email}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className="w-12 h-16 text-center text-2xl font-bold rounded-xl bg-bg-input border-2 border-border text-text-primary focus:border-brand-blue focus:outline-none transition-colors"
                />
              ))}
            </div>

            {error && (
              <p className="text-brand-red text-sm font-medium text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!codeComplete || loading}
              className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors"
            >
              {loading ? "Verifying…" : "Verify & Continue"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <a href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
                ← Back to sign in
              </a>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend || resending}
                className={`transition-colors ${
                  canResend && !resending
                    ? "text-brand-blue hover:underline cursor-pointer"
                    : "text-text-hint cursor-not-allowed"
                }`}
              >
                {resending ? "Sending…" : canResend ? "Resend code" : `Resend in ${resendSeconds}s`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginVerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
