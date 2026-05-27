"use client";

import { useState } from "react";
import { resolveSource } from "@/src/lib/source-tracking";

type RadioGroupProps = {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
};

function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
}: RadioGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-white mb-3 block">
        {label}
      </legend>
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3.5 transition-all ${
            value === opt
              ? "border-white bg-zinc-800 text-white"
              : "border-zinc-700 text-gray-400 hover:border-zinc-500"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="sr-only"
          />
          <span
            className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
              value === opt ? "border-white bg-white" : "border-zinc-600"
            }`}
          />
          <span className="text-sm leading-snug">{opt}</span>
        </label>
      ))}
    </fieldset>
  );
}

type CheckboxGroupProps = {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
};

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
}: CheckboxGroupProps) {
  function toggle(opt: string) {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-white mb-3 block">
        {label}
      </legend>
      {options.map((opt) => {
        const checked = values.includes(opt);
        return (
          <label
            key={opt}
            className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3.5 transition-all ${
              checked
                ? "border-white bg-zinc-800 text-white"
                : "border-zinc-700 text-gray-400 hover:border-zinc-500"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                checked ? "border-white bg-white" : "border-zinc-600"
              }`}
            >
              {checked && (
                <svg
                  className="w-2.5 h-2.5 text-black"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M10.28 2.28a1 1 0 0 0-1.42 0L4.5 6.64 3.14 5.28a1 1 0 0 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l5-5a1 1 0 0 0 0-1.42z" />
                </svg>
              )}
            </span>
            <span className="text-sm leading-snug">{opt}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

// ─── Confirmation Screen ──────────────────────────────────────────────────────

function Confirmation() {
  return (
    <div className="max-w-lg mx-auto px-5 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">
        You&apos;re on the schedule.
      </h1>
      <p className="text-gray-400 text-base leading-relaxed mb-10">
        We&apos;ll reach out within the hour to confirm your inspection time.
      </p>

      <div className="border border-zinc-800 bg-zinc-900 rounded-xl p-6 text-left space-y-3 mb-10">
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          What to expect
        </p>
        {[
          "A quick call or text from one of our inspectors",
          "A 45–60 minute inspection at no cost to you",
          "A full written report of our findings, shared with you the same day",
        ].map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="text-gray-500 mt-0.5">•</span>
            <p className="text-gray-300 text-sm leading-relaxed">{item}</p>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-sm">
        Questions? Text us at{" "}
        <span className="text-gray-400 font-medium">915-233-7073</span>
      </p>
    </div>
  );
}

// ─── Qualify Form ─────────────────────────────────────────────────────────────

export default function QualifyForm({
  token,
  zip,
  tier,
}: {
  token: string;
  zip: string;
  tier: string;
}) {
  const [roofAge, setRoofAge] = useState("");
  const [knownIssues, setKnownIssues] = useState<string[]>([]);
  const [lastInspected, setLastInspected] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [decisionMakerHome, setDecisionMakerHome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const allAnswered =
    roofAge &&
    knownIssues.length > 0 &&
    lastInspected &&
    bestTime &&
    decisionMakerHome;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/qualify/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          roofAge,
          knownIssues,
          lastInspected,
          bestTime,
          decisionMakerHome,
          source: resolveSource("inspection"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (
          res.status === 400 &&
          data.error?.toLowerCase().includes("expired")
        ) {
          window.location.href = "/?expired=true";
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <Confirmation />;

  // zip and tier are passed through but not displayed — they're used in the API call via token
  void zip;
  void tier;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <div className="max-w-lg mx-auto px-5 py-12">
        <p className="text-xs font-bold tracking-[0.25em] text-gray-600 uppercase mb-8">
          Qntum Roofing — Free Inspection
        </p>

        <h1 className="text-2xl font-bold text-white mb-2">
          A few quick questions about your roof
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          This helps us send the right inspector and make the most of your
          appointment.
        </p>

        <form onSubmit={handleSubmit} className="space-y-10">
          <RadioGroup
            label="How old is your roof?"
            name="roofAge"
            options={[
              "Under 5 years",
              "5–10 years",
              "10–15 years",
              "15–20 years",
              "20+ years",
              "Not sure",
            ]}
            value={roofAge}
            onChange={setRoofAge}
          />

          <CheckboxGroup
            label="Have you noticed any of the following?"
            options={[
              "Water stains on ceilings or walls",
              "Missing or damaged shingles",
              "Storm or hail damage",
              "Higher than usual energy bills",
              "I haven't noticed anything — that's why I'm getting an inspection",
            ]}
            values={knownIssues}
            onChange={setKnownIssues}
          />

          <RadioGroup
            label="When was your roof last professionally inspected?"
            name="lastInspected"
            options={[
              "Never, as far as I know",
              "Within the last year",
              "1–3 years ago",
              "More than 3 years ago",
              "Not sure",
            ]}
            value={lastInspected}
            onChange={setLastInspected}
          />

          <RadioGroup
            label="When's the best time to reach you?"
            name="bestTime"
            options={[
              "Morning (8am–12pm)",
              "Afternoon (12pm–5pm)",
              "Evening (5pm–8pm)",
            ]}
            value={bestTime}
            onChange={setBestTime}
          />

          <RadioGroup
            label="Will all decision makers be home for the inspection?"
            name="decisionMakerHome"
            options={["Yes", "No", "Not sure"]}
            value={decisionMakerHome}
            onChange={setDecisionMakerHome}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!allAnswered || loading}
            className="w-full py-4 rounded-lg text-base font-bold transition-all bg-white text-black hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting…" : "Schedule My Free Inspection"}
          </button>
        </form>
      </div>
    </div>
  );
}
