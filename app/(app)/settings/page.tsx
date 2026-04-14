"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { isWorkEmail, ALLOWED_EMAIL_DOMAIN } from "@/src/lib/auth-constants";
import { validatePassword } from "@/src/lib/password";
import { CreditCard, ExternalLink, Pencil } from "lucide-react";

// ── Shared: section card ──────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
      <h2 className="text-text-primary text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  rightElement,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-text-secondary text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 pr-12 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors w-full"
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1}
      className="text-text-hint hover:text-text-secondary transition-colors">
      {show ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

// ── Section 1: Profile ────────────────────────────────────
function ProfileSection() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to update name"); return; }
      await update({ name: data.name });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Profile">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <InputField
          label="Full Name"
          value={name}
          onChange={setName}
          placeholder="Your full name"
          autoComplete="name"
        />
        {error && <p className="text-brand-red text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">Name updated ✓</p>}
        <button
          type="submit" disabled={loading || !name.trim()}
          className="self-start bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
        >
          {loading ? "Saving…" : "Save Name"}
        </button>
      </form>
    </Card>
  );
}

// ── Section 2: Change Email ───────────────────────────────
function EmailSection() {
  const { data: session } = useSession();
  const router = useRouter();
  const [subStep, setSubStep] = useState<"enter" | "verify">("enter");
  const [newEmail, setNewEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (subStep !== "verify") return;
    inputRefs[0].current?.focus();
  }, [subStep]); // eslint-disable-line

  useEffect(() => {
    if (resendSeconds <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const emailError = newEmail.length > 0 && !isWorkEmail(newEmail)
    ? `Must be a @${ALLOWED_EMAIL_DOMAIN} email address` : "";

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isWorkEmail(newEmail) || loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/user/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send code"); return; }
      setSubStep("verify");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nd = [...digits]; nd[index] = digit; setDigits(nd);
    if (digit && index < 5) inputRefs[index + 1].current?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputRefs[index - 1].current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (p.length === 6) { setDigits(p.split("")); inputRefs[5].current?.focus(); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/user/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid code"); setDigits(["","","","","",""]); inputRefs[0].current?.focus(); return; }
      // Sign out and redirect — session is now stale
      await signOut({ redirect: false });
      router.push("/login?message=email-updated");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setCanResend(false); setResendSeconds(60);
    await fetch("/api/user/email/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });
  }

  return (
    <Card title="Change Email">
      {subStep === "enter" ? (
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <p className="text-text-secondary text-sm">
            Current:{" "}
            <span className="text-text-primary font-medium">{session?.user?.email}</span>
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-text-secondary text-sm font-semibold">New Email</label>
            <input
              type="email"
              placeholder={`new@${ALLOWED_EMAIL_DOMAIN}`}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
            />
            {emailError && <p className="text-brand-red text-sm">{emailError}</p>}
          </div>
          {error && <p className="text-brand-red text-sm">{error}</p>}
          <button
            type="submit" disabled={!isWorkEmail(newEmail) || loading}
            className="self-start bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
          >
            {loading ? "Sending…" : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <p className="text-text-secondary text-sm">
            Enter the 6-digit code sent to{" "}
            <span className="text-text-primary font-medium">{newEmail}</span>
          </p>
          <div className="flex gap-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i} ref={inputRefs[i]} type="text" inputMode="numeric" maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="w-10 h-14 text-center text-xl font-bold rounded-xl bg-bg-input border-2 border-border text-text-primary focus:border-brand-blue focus:outline-none transition-colors"
              />
            ))}
          </div>
          {error && <p className="text-brand-red text-sm">{error}</p>}
          <div className="flex items-center gap-4">
            <button
              type="submit" disabled={!digits.every((d) => d !== "") || loading}
              className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
            >
              {loading ? "Updating…" : "Verify and Update Email"}
            </button>
            <button
              type="button" onClick={handleResend} disabled={!canResend}
              className={`text-sm ${canResend ? "text-brand-blue hover:underline" : "text-text-hint cursor-not-allowed"}`}
            >
              {canResend ? "Resend code" : `Resend in ${resendSeconds}s`}
            </button>
          </div>
          <button
            type="button" onClick={() => { setSubStep("enter"); setDigits(["","","","","",""]); setError(""); }}
            className="self-start text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            ← Change email
          </button>
        </form>
      )}
    </Card>
  );
}

// ── Section 3: Change Password ────────────────────────────
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const requirements = [
    { text: "At least 8 characters", met: newPw.length >= 8 },
    { text: "One uppercase letter", met: /[A-Z]/.test(newPw) },
    { text: "One number", met: /[0-9]/.test(newPw) },
    { text: "One special character", met: /[^A-Za-z0-9]/.test(newPw) },
  ];

  const { valid: passwordValid } = validatePassword(newPw);
  const passwordsMatch = newPw === confirm && confirm !== "";
  const canSubmit = current !== "" && passwordValid && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to update password"); return; }
      setCurrent(""); setNewPw(""); setConfirm("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Change Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InputField
          label="Current Password" type={showCurrent ? "text" : "password"}
          value={current} onChange={setCurrent}
          placeholder="••••••••" autoComplete="current-password"
          rightElement={<EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />}
        />

        <div className="flex flex-col gap-2">
          <InputField
            label="New Password" type={showNew ? "text" : "password"}
            value={newPw} onChange={setNewPw}
            placeholder="••••••••" autoComplete="new-password"
            rightElement={<EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />}
          />
          {newPw.length > 0 && (
            <div className="flex flex-col gap-1.5">
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
          <InputField
            label="Confirm New Password" type={showConfirm ? "text" : "password"}
            value={confirm} onChange={setConfirm}
            placeholder="••••••••" autoComplete="new-password"
            rightElement={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-brand-red text-sm">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-brand-red text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">Password updated ✓</p>}

        <button
          type="submit" disabled={!canSubmit}
          className="self-start bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </Card>
  );
}

// ── Section: Business Card ────────────────────────────────
function BusinessCardSection() {
  const { data: session } = useSession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const userId = (session?.user as { id?: string })?.id ?? "";
  const cardUrl = `${appUrl}/card/${userId}`;

  return (
    <Card title="Business Card">
      <p className="text-text-secondary text-sm">
        Your digital business card is shareable with homeowners. Customize what information appears and preview the live card.
      </p>
      <div className="flex gap-3 flex-wrap">
        <a
          href="/dashboard/profile"
          className="flex items-center gap-2 bg-brand-blue hover:bg-accent-blue-hover text-white font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
        >
          <Pencil size={13} strokeWidth={2} />
          Edit Card
        </a>
        {userId && (
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-border hover:border-border-hover text-text-secondary hover:text-text-primary font-semibold rounded-xl min-h-10 px-5 text-sm transition-colors"
          >
            <ExternalLink size={13} strokeWidth={2} />
            View Live Card
          </a>
        )}
      </div>
    </Card>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Account Settings</h1>
        <p className="text-text-secondary text-base mt-1">Manage your profile and security settings.</p>
      </div>
      <BusinessCardSection />
      <ProfileSection />
      <EmailSection />
      <PasswordSection />
    </div>
  );
}
