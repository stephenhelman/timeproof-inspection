"use client";

import { useState } from "react";
import { useLanguage } from "@/src/components/marketing/LanguageProvider";

// ─── ZIP lookup ───────────────────────────────────────────────────────────────

function ZipLookup() {
  const { t } = useLanguage();
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<"in" | "out" | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    if (zip.length !== 5 || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/qualify/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, isHomeowner: true }),
      });
      const data = await res.json();
      setResult(data.result === "pass" ? "in" : "out");
    } catch {
      setResult("out");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="flex gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, ""));
            setResult(null);
          }}
          placeholder={t("serviceArea.zipPlaceholder")}
          className="flex-1 bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 text-lg tracking-widest focus:outline-none focus:border-accent-blue transition-colors"
        />
        <button
          onClick={handleCheck}
          disabled={zip.length !== 5 || loading}
          className="bg-accent-blue hover:bg-accent-blue-hover text-white font-bold px-5 py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "…" : t("serviceArea.checkButton")}
        </button>
      </div>

      {result === "in" && (
        <div className="mt-4 p-4 rounded-lg bg-bg-elevated border border-success text-success-text text-sm text-center">
          ✓ {t("serviceArea.inArea")}
          <br />
          <a href="/#check-area" className="underline font-semibold mt-1 inline-block">
            Request your inspection →
          </a>
        </div>
      )}
      {result === "out" && (
        <div className="mt-4 p-4 rounded-lg bg-bg-elevated border border-border text-text-secondary text-sm text-center">
          {t("serviceArea.outOfArea")}
          <br />
          <a href="#waitlist" className="underline font-semibold mt-1 inline-block text-accent-blue">
            Join the waitlist →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

function WaitlistForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    try {
      await fetch("/api/qualify/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email, zip: "" }),
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <p className="text-success-text text-sm text-center">
        ✓ You&apos;re on the list. We&apos;ll reach out when we expand to your area.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("serviceArea.emailPlaceholder")}
        className="flex-1 bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 focus:outline-none focus:border-accent-blue transition-colors"
      />
      <button
        type="submit"
        disabled={!email.trim() || loading}
        className="bg-accent-blue hover:bg-accent-blue-hover text-white font-bold px-5 py-3 rounded-lg transition-colors disabled:opacity-40"
      >
        {loading ? "…" : t("serviceArea.notifyMe")}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EL_PASO_AREAS = [
  "East El Paso", "Northeast El Paso", "Central El Paso", "West El Paso",
  "Socorro", "Horizon City", "Anthony (TX)", "Clint / Fabens",
];

const LAS_CRUCES_AREAS = [
  "Las Cruces (all areas)", "Mesilla", "Doña Ana", "White Sands area",
];

const ALAMOGORDO_AREAS = [
  "Alamogordo", "Tularosa", "La Luz",
];

const COMING_SOON = [
  "Silver City, NM", "Carlsbad, NM", "Roswell, NM",
];

export default function ServiceAreaPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          Where We Work
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          We currently serve El Paso, Las Cruces, and Alamogordo. We&apos;re expanding — enter your
          ZIP to see if you&apos;re covered.
        </p>
      </section>

      {/* ZIP lookup */}
      <section className="px-5 py-12 bg-bg-surface">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-6">
          Check your ZIP
        </p>
        <ZipLookup />
      </section>

      {/* Coverage map placeholder */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          Coverage map
        </p>
        <div className="border border-border bg-bg-surface rounded-2xl h-64 sm:h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-hint text-sm mb-2">Interactive map coming soon</p>
            <p className="text-text-hint text-xs">El Paso · Las Cruces · Alamogordo</p>
          </div>
        </div>
      </section>

      {/* City lists */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
            Areas we serve
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* El Paso */}
            <div>
              <h3 className="text-text-primary font-semibold text-base mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue inline-block" />
                El Paso, TX
              </h3>
              <ul className="space-y-2">
                {EL_PASO_AREAS.map((area) => (
                  <li key={area} className="text-text-secondary text-sm flex items-center gap-2">
                    <span className="text-text-hint">→</span> {area}
                  </li>
                ))}
              </ul>
            </div>

            {/* Las Cruces */}
            <div>
              <h3 className="text-text-primary font-semibold text-base mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue inline-block" />
                Las Cruces, NM
              </h3>
              <ul className="space-y-2">
                {LAS_CRUCES_AREAS.map((area) => (
                  <li key={area} className="text-text-secondary text-sm flex items-center gap-2">
                    <span className="text-text-hint">→</span> {area}
                  </li>
                ))}
              </ul>
            </div>

            {/* Alamogordo */}
            <div>
              <h3 className="text-text-primary font-semibold text-base mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue inline-block" />
                Alamogordo, NM
              </h3>
              <ul className="space-y-2">
                {ALAMOGORDO_AREAS.map((area) => (
                  <li key={area} className="text-text-secondary text-sm flex items-center gap-2">
                    <span className="text-text-hint">→</span> {area}
                  </li>
                ))}
              </ul>

              {/* Coming soon */}
              <div className="mt-6">
                <p className="text-text-hint text-xs uppercase tracking-wider font-semibold mb-3">
                  Coming Soon
                </p>
                <ul className="space-y-2">
                  {COMING_SOON.map((area) => (
                    <li key={area} className="text-text-hint text-sm flex items-center gap-2">
                      <span>○</span> {area}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist / expand note */}
      <section id="waitlist" className="px-5 py-16 max-w-2xl mx-auto text-center">
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          Don&apos;t see your area? We&apos;re growing. Leave your email and we&apos;ll notify you
          when we reach your neighborhood.
        </p>
        <WaitlistForm />
      </section>
    </>
  );
}
