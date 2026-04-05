"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        {/* Logo placeholder */}
        <div className="w-full h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-8">
          <span className="text-white font-bold text-xl tracking-widest">TIMEPROOF</span>
        </div>

        <h1 className="text-white text-2xl font-semibold mb-1">Roof Inspection</h1>
        <p className="text-gray-400 text-base mb-8">Sign In</p>

        {sent ? (
          <div className="bg-green-900/40 border border-green-700 rounded-xl p-4 text-green-300 text-base">
            Check your email. A sign-in link has been sent to{" "}
            <span className="font-semibold">{sentTo || "your address"}</span>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl min-h-12 px-6 text-base transition-colors"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
