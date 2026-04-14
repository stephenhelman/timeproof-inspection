"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Logo from "@/src/components/ui/Logo";
import { isWorkEmail, ALLOWED_EMAIL_DOMAIN } from "@/src/lib/auth-constants";

// ── Step 1: Enter work email ──────────────────────────────
function EmailStep({
  onSuccess,
}: {
  onSuccess: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailError =
    email.length > 0 && !isWorkEmail(email)
      ? `Must be a @${ALLOWED_EMAIL_DOMAIN} email address`
      : "";

  const canSubmit = isWorkEmail(email) && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(data.error || "Please wait before requesting another code");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to send code. Please try again.");
        return;
      }
      onSuccess(email.toLowerCase().trim());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-text-primary text-2xl font-bold mb-1">Sign in</h1>
      <p className="text-text-secondary text-base mb-8">TIMEPROOF Inspection Reports</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-sm font-semibold">
            Work email address
          </label>
          <input
            type="email"
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
          />
          {emailError && <p className="text-brand-red text-sm">{emailError}</p>}
        </div>

        {error && <p className="text-brand-red text-sm font-medium">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors mt-2"
        >
          {loading ? "Sending code…" : "Send Sign-In Code"}
        </button>
      </form>
    </>
  );
}

// ── Step 2: Enter 6-digit code ────────────────────────────
function CodeStep({
  email,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail: () => void;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
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
      const result = await signIn("credentials", {
        email,
        code,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid or expired code. Please try again.");
        setDigits(["", "", "", "", "", ""]);
        inputRefs[0].current?.focus();
        setLoading(false);
        return;
      }

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
    try {
      await fetch("/api/auth/magic/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setResending(false);
    }
  }

  const codeComplete = digits.every((d) => d !== "");

  return (
    <>
      <h1 className="text-text-primary text-2xl font-bold mb-1">
        Check your email
      </h1>
      <p className="text-text-secondary text-base mb-2">
        We sent a 6-digit code to
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
          <p className="text-brand-red text-sm font-medium text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={!codeComplete || loading}
          className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors"
        >
          {loading ? "Signing in…" : "Verify & Sign In"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Change email
          </button>
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
    </>
  );
}

// ── Root ──────────────────────────────────────────────────
function LoginForm() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Logo height={52} />
        </div>

        <div className="bg-bg-surface border border-border rounded-3xl p-8">
          {message === "email-updated" && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-xl px-4 py-3 mb-6">
              Email updated successfully. Please sign in with your new email.
            </div>
          )}

          {step === "email" ? (
            <EmailStep
              onSuccess={(e) => {
                setEmail(e);
                setStep("code");
              }}
            />
          ) : (
            <CodeStep
              email={email}
              onChangeEmail={() => {
                setEmail("");
                setStep("email");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
