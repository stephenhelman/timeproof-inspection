"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Logo from "@/src/components/ui/Logo";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Read device token cookie if present
    const deviceToken =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("tp_device_token="))
        ?.split("=")[1] ?? "";

    const result = await signIn("credentials", {
      email,
      password,
      deviceToken,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    // Check if 2FA is required
    const session = await getSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((session as any)?.requires2FA) {
      router.push(`/login/verify?email=${encodeURIComponent(email)}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Logo height={52} />
        </div>

        <div className="bg-bg-surface border border-border rounded-3xl p-8">
          <h1 className="text-text-primary text-2xl font-bold mb-1">Sign in</h1>
          <p className="text-text-secondary text-base mb-8">Roof Inspection Reports</p>

          {message === "email-updated" && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-xl px-4 py-3 mb-6">
              Email updated successfully. Please sign in with your new email.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-text-secondary text-sm font-semibold">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@timeproofusa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-text-secondary text-sm font-semibold">
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-brand-blue text-sm hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-brand-red text-sm font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl min-h-14 px-6 text-base transition-colors mt-2"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-4">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-brand-blue hover:underline">
              Create account
            </a>
          </p>
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
