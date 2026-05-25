"use client";

import { useState, useEffect } from "react";
import { resolveSource } from "@/src/lib/source-tracking";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoofType = "Shingle" | "Flat" | "Both" | null;
type RoofAge = string | null;

const ROOF_AGE_OPTIONS = [
  "Under 5 yrs",
  "5–10 yrs",
  "10–15 yrs",
  "15–20 yrs",
  "20+ yrs",
  "Not sure",
];

const INSPECTED_OPTIONS = [
  "Never",
  "Within last year",
  "1–3 years ago",
  "3–5 years ago",
  "5+ years ago",
  "Not sure",
];

const ISSUES_BASE = [
  "Granules in gutters",
  "Missing or cracked shingles",
  "Dark staining or streaking",
  "Water stains on ceiling",
  "Gutters pulling from house",
  "Sagging areas on roof",
];

const ISSUES_FLAT_ONLY = [
  "Ponding water on flat sections",
  "Blistering or bubbling",
];

const TIMELINE = [
  { years: "Year 1–2",   visible: "Looks brand new",      hidden: "Granule bonding weakens from UV" },
  { years: "Year 3–5",   visible: "Still looks fine",      hidden: "Granule loss accelerates, underlayment stress" },
  { years: "Year 7–10",  visible: "Minor surface wear",    hidden: "Decking moisture begins, ventilation failing" },
  { years: "Year 12–15", visible: "Noticeable aging",      hidden: "Active attic moisture, structural decking at risk" },
  { years: "Year 15+",   visible: "Ceiling stains appear", hidden: "Damage has been building for years" },
];

// ─── Intake form ──────────────────────────────────────────────────────────────

function IntakeForm({
  source,
  rep,
}: {
  source: string;
  rep: string;
}) {
  const [roofType, setRoofType] = useState<RoofType>(null);
  const [roofAge, setRoofAge] = useState<RoofAge>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [lastInspected, setLastInspected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showFlatOptions = roofType === "Flat" || roofType === "Both";

  const allIssueOptions = showFlatOptions
    ? [...ISSUES_BASE, ...ISSUES_FLAT_ONLY, "None of the above"]
    : [...ISSUES_BASE, "None of the above"];

  function toggleIssue(issue: string) {
    if (issue === "None of the above") {
      setIssues(["None of the above"]);
      return;
    }
    setIssues((prev) => {
      const without = prev.filter((i) => i !== "None of the above");
      if (without.includes(issue)) return without.filter((i) => i !== issue);
      return [...without, issue];
    });
  }

  // Remove flat-only issues if roof type changes away from flat
  useEffect(() => {
    if (roofType !== "Flat" && roofType !== "Both") {
      setIssues((prev) => prev.filter((i) => !ISSUES_FLAT_ONLY.includes(i)));
    }
  }, [roofType]);

  const canSubmit =
    roofType !== null &&
    roofAge !== null &&
    name.trim().length > 0 &&
    phone.trim().length >= 10 &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/guide/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roofType,
          roofAge,
          issuesNoticed: issues,
          lastInspected: lastInspected ?? "",
          name: name.trim(),
          phone: phone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: state.trim() || "TX",
          zip: zip.trim(),
          source: resolveSource("guide"),
          rep,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = `/roof-guide/${data.slug}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const toggleBtnCls = (active: boolean) =>
    `flex-1 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all ${
      active
        ? "bg-white text-black border-white"
        : "bg-transparent text-text-secondary border-border hover:border-border-hover"
    }`;

  const inputCls =
    "w-full bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 focus:outline-none focus:border-accent-blue transition-colors text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* 1. Roof type */}
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          What type of roof do you have?
        </p>
        <div className="flex gap-2">
          {(["Shingle", "Flat", "Both"] as RoofType[]).map((t) => (
            <button
              key={t!}
              type="button"
              onClick={() => setRoofType(t)}
              className={toggleBtnCls(roofType === t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Roof age */}
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          How old is your roof?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ROOF_AGE_OPTIONS.map((age) => (
            <button
              key={age}
              type="button"
              onClick={() => setRoofAge(age)}
              className={toggleBtnCls(roofAge === age)}
            >
              {age}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Issues noticed */}
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          Have you noticed any of the following?
        </p>
        <div className="space-y-2">
          {allIssueOptions.map((issue) => {
            const checked = issues.includes(issue);
            return (
              <label
                key={issue}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIssue(issue)}
                  className="sr-only"
                />
                <span
                  className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center transition-all ${
                    checked
                      ? "bg-[#F06B30] border-[#F06B30]"
                      : "border-border group-hover:border-border-hover"
                  }`}
                >
                  {checked && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                  {issue}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Last inspected */}
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          Last professionally inspected?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {INSPECTED_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLastInspected(opt)}
              className={toggleBtnCls(lastInspected === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* 5–7. Contact info */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-1">
          Where should we send your guide?
        </p>
        <div>
          <label className="block text-xs font-medium text-text-hint mb-1.5">Full Name *</label>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Reyes"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-hint mb-1.5">Phone Number *</label>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(915) 555-0100"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-hint mb-1.5">Street Address</label>
          <input
            type="text"
            autoComplete="address-line1"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="1234 Mesa Hills Dr"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-hint mb-1.5">City</label>
            <input
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="El Paso"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-hint mb-1.5">ZIP</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="79925"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error-text">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-4 rounded-lg text-base font-bold transition-all bg-[#F06B30] hover:bg-[#e05520] text-white disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? "Generating your guide…" : "Get My Personalized Roof Health Guide"}
      </button>

      <p className="text-xs text-text-hint leading-relaxed text-center">
        By submitting this form you agree to receive text messages from Qntum Roofing regarding
        your roof health. Message and data rates may apply. Reply STOP at any time to opt out.
      </p>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoofGuidePage() {
  const [source, setSource] = useState("");
  const [rep, setRep] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSource(params.get("source") ?? "");
    setRep(params.get("rep") ?? "");
    setExpired(params.get("expired") === "true");
  }, []);

  return (
    <>
      {expired && (
        <div className="fixed top-16 inset-x-0 z-50 bg-amber-500 text-black text-sm font-medium text-center py-3 px-4">
          That guide link has expired or is invalid. Please fill out the form below to get a new one.
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-20 pb-16 max-w-2xl mx-auto text-center">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-6">
          Scope Reports / Powered by Qntum Roofing
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-5 text-text-primary">
          Do You Know What Your Roof Is Hiding?
        </h1>
        <p className="text-text-secondary text-lg sm:text-xl leading-relaxed mb-8 max-w-xl mx-auto">
          Most El Paso homeowners don&apos;t — and by the time they find out, it&apos;s already cost them.
        </p>
        <a
          href="#get-guide"
          className="inline-block text-sm text-text-hint hover:text-text-secondary transition-colors"
        >
          See what&apos;s hiding ↓
        </a>
      </section>

      {/* ── Hidden Damage Timeline ────────────────────────────────────────── */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-4">
            The Hidden Damage Timeline
          </p>
          <p className="text-text-secondary text-center text-sm leading-relaxed mb-2 max-w-xl mx-auto">
            By the time you see it inside, it&apos;s already been years in the making.
          </p>
          <p className="text-text-hint text-center text-sm leading-relaxed mb-10 max-w-xl mx-auto">
            El Paso&apos;s UV index ranks among the highest in the nation. Heat cycling, monsoon
            stress, and 297+ sunny days per year accelerate roof degradation significantly faster
            than national ratings account for.
          </p>

          {/* Timeline table */}
          <div className="rounded-xl overflow-hidden border border-border">
            {/* Header */}
            <div className="grid grid-cols-3 bg-bg-elevated border-b border-border">
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-text-hint uppercase">Year</div>
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-success-text uppercase">Looks Like</div>
              <div className="px-4 py-3 text-xs font-bold tracking-wider text-error-text uppercase">Happening Inside</div>
            </div>
            {TIMELINE.map((row, i) => (
              <div
                key={row.years}
                className={`grid grid-cols-3 border-b border-border last:border-0 ${
                  i % 2 === 0 ? "bg-bg-base" : "bg-bg-surface"
                }`}
              >
                <div className="px-4 py-3 text-sm font-semibold text-[#F06B30]">{row.years}</div>
                <div className="px-4 py-3 text-sm text-success-text">{row.visible}</div>
                <div className="px-4 py-3 text-sm text-error-text">{row.hidden}</div>
              </div>
            ))}
          </div>

          {/* Warning callout */}
          <div className="mt-6 border-l-2 border-[#F06B30] pl-4 py-1">
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-[#F06B30]">⚠ El Paso Climate Reality:</span>{" "}
              A standard shingle installed here realistically performs 10–15 years — not the
              25 years on the box. That&apos;s why we install 50-year warranted architectural
              shingles rated for this climate.
            </p>
          </div>
        </div>
      </section>

      {/* ── Form section ─────────────────────────────────────────────────── */}
      <section id="get-guide" className="px-5 py-20">
        <div className="max-w-md mx-auto">
          <div className="border border-border bg-bg-surface rounded-2xl p-7 sm:p-8">
            <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase mb-3">
              Your Personalized Roof Health Guide
            </p>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Answer a few questions about your roof
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-7">
              We&apos;ll generate a condition profile specific to your home — including what the
              symptoms you&apos;ve noticed actually mean.
            </p>
            <IntakeForm source={source} rep={rep} />
          </div>
        </div>
      </section>
    </>
  );
}
