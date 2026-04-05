"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Logo from "@/src/components/ui/Logo";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const verify = searchParams.get("verify");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(verify === "true");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("resend", { email, redirect: false });
    setSentTo(email);
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo height={52} />
        </div>

        <div className="bg-bg-surface border border-border rounded-3xl p-8">
          <h1 className="text-text-primary text-2xl font-bold mb-1">Sign in</h1>
          <p className="text-text-secondary text-base mb-8">
            Roof Inspection Reports
          </p>

          {sent ? (
            <div className="bg-success/20 border border-success/40 rounded-2xl p-5 text-success-text text-base leading-relaxed">
              <p className="font-semibold mb-1">Check your email</p>
              <p className="text-success-text/80">
                A sign-in link was sent to{" "}
                <span className="font-semibold text-success-text">
                  {sentTo || "your address"}
                </span>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-text-secondary text-sm font-semibold">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-12 px-6 text-base transition-colors mt-2"
              >
                {loading ? "Sending…" : "Send Magic Link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
