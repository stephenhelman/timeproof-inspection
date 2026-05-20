"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { isWorkEmail, ALLOWED_EMAIL_DOMAIN } from "@/src/lib/auth-constants";
import { validatePassword } from "@/src/lib/password";

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map((n) => (
        <React.Fragment key={n}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              n < step
                ? "bg-brand-blue text-white"
                : n === step
                ? "bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2 ring-offset-bg-base"
                : "bg-bg-elevated text-text-hint"
            }`}
          >
            {n < step ? "✓" : n}
          </div>
          {n < 3 && (
            <div className={`flex-1 h-0.5 transition-all ${n < step ? "bg-brand-blue" : "bg-border"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Step 1 — Email ────────────────────────────────────────
function Step1Email({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError =
    email.length > 0 && !isWorkEmail(email)
      ? `Must be a @${ALLOWED_EMAIL_DOMAIN} email address`
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isWorkEmail(email) || loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reset code");
      } else {
        onSuccess(email.toLowerCase().trim());
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-text-primary text-2xl font-bold mb-1">Forgot your password?</h1>
      <p className="text-text-secondary text-base mb-8">
        Enter your Qntum Roofing work email and we&apos;ll send a reset code.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-sm font-semibold">Work email</label>
          <input
            type="email"
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
          />
          {emailError && <p className="text-brand-red text-sm">{emailError}</p>}
        </div>

        {error && <p className="text-brand-red text-sm font-medium">{error}</p>}

        <button
          type="submit"
          disabled={!isWorkEmail(email) || loading}
          className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors mt-2"
        >
          {loading ? "Sending…" : "Send Reset Code"}
        </button>

        <p className="text-center text-sm text-text-secondary">
          <a href="/login" className="text-brand-blue hover:underline">← Back to sign in</a>
        </p>
      </form>
    </>
  );
}

// ── Step 2 — Code ─────────────────────────────────────────
function Step2Code({
  email,
  onSuccess,
  onChangeEmail,
}: {
  email: string;
  onSuccess: () => void;
  onChangeEmail: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);

  const inputRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { inputRefs[0].current?.focus(); }, []); // eslint-disable-line

  useEffect(() => {
    if (resendSeconds <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nd = [...digits]; nd[index] = digit; setDigits(nd);
    if (digit && index < 5) inputRefs[index + 1].current?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setDigits(pasted.split("")); inputRefs[5].current?.focus(); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        setDigits(["", "", "", "", "", ""]); inputRefs[0].current?.focus();
      } else {
        onSuccess();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setCanResend(false); setResendSeconds(60); setResending(true); setError("");
    try {
      await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <h1 className="text-text-primary text-2xl font-bold mb-1">Check your email</h1>
      <p className="text-text-secondary text-base mb-8">
        We sent a 6-digit code to{" "}
        <span className="text-text-primary font-medium">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i} ref={inputRefs[i]} type="text" inputMode="numeric" maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className="w-12 h-16 text-center text-2xl font-bold rounded-xl bg-bg-input border-2 border-border text-text-primary focus:border-brand-blue focus:outline-none transition-colors"
            />
          ))}
        </div>

        {error && <p className="text-brand-red text-sm font-medium text-center">{error}</p>}

        <button
          type="submit"
          disabled={!digits.every((d) => d !== "") || loading}
          className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors"
        >
          {loading ? "Verifying…" : "Verify Code"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onChangeEmail} className="text-text-secondary hover:text-text-primary transition-colors">
            ← Change email
          </button>
          <button
            type="button" onClick={handleResend} disabled={!canResend || resending}
            className={`transition-colors ${canResend && !resending ? "text-brand-blue hover:underline cursor-pointer" : "text-text-hint cursor-not-allowed"}`}
          >
            {resending ? "Sending…" : canResend ? "Resend code" : `Resend in ${resendSeconds}s`}
          </button>
        </div>
      </form>
    </>
  );
}

// ── Step 3 — New Password ─────────────────────────────────
function Step3Password({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requirements = [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "One uppercase letter", met: /[A-Z]/.test(password) },
    { text: "One number", met: /[0-9]/.test(password) },
    { text: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const { valid: passwordValid } = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword !== "";
  const canSubmit = passwordValid && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to reset password"); setLoading(false); return; }

      // Auto sign in
      const deviceToken =
        document.cookie.split("; ").find((r) => r.startsWith("tp_device_token="))?.split("=")[1] ?? "";
      const result = await signIn("credentials", { email, password, deviceToken, redirect: false });
      if (result?.error) {
        setError("Password reset. Please sign in.");
        setLoading(false);
        router.push("/login");
        return;
      }

      const session = await getSession();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((session as any)?.requires2FA) {
        router.push(`/login/verify?email=${encodeURIComponent(email)}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const EyeIcon = ({ visible }: { visible: boolean }) => visible ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  return (
    <>
      <h1 className="text-text-primary text-2xl font-bold mb-1">Reset your password</h1>
      <p className="text-text-secondary text-base mb-8">
        Set a new password for <span className="text-text-primary font-medium">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-sm font-semibold">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 pr-12 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors w-full"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-hint hover:text-text-secondary">
              <EyeIcon visible={showPassword} />
            </button>
          </div>
          {password.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {requirements.map((req) => (
                <div key={req.text} className="flex items-center gap-2 text-sm">
                  <span className={req.met ? "text-green-400" : "text-text-hint"}>{req.met ? "●" : "○"}</span>
                  <span className={req.met ? "text-green-400" : "text-text-hint"}>{req.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-sm font-semibold">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 pr-12 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors w-full"
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-hint hover:text-text-secondary">
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-brand-red text-sm">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-brand-red text-sm font-medium">{error}</p>}

        <button
          type="submit" disabled={!canSubmit}
          className="bg-success hover:bg-success/80 disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors mt-2"
        >
          {loading ? "Resetting…" : "Reset Password"}
        </button>
      </form>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qntum-logo.svg" alt="Qntum Roofing" style={{ height: "40px", width: "auto" }} />
        </div>
        <div className="bg-bg-surface border border-border rounded-3xl p-8">
          <StepIndicator step={step} />
          {step === 1 && <Step1Email onSuccess={(e) => { setEmail(e); setStep(2); }} />}
          {step === 2 && (
            <Step2Code
              email={email}
              onSuccess={() => setStep(3)}
              onChangeEmail={() => { setEmail(""); setStep(1); }}
            />
          )}
          {step === 3 && <Step3Password email={email} />}
        </div>
      </div>
    </div>
  );
}
