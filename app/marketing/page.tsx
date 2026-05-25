"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/src/components/marketing/LanguageProvider";

type FunnelState = "gate" | "capture" | "out_of_area";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Gate Form ────────────────────────────────────────────────────────────────

function GateForm({
  onPass,
  onFail,
}: {
  onPass: (token: string, tier: string, zip: string) => void;
  onFail: (zip: string) => void;
}) {
  const { t } = useLanguage();
  const [isHomeowner, setIsHomeowner] = useState<boolean | null>(null);
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [notHomeownerMsg, setNotHomeownerMsg] = useState(false);

  const canSubmit = isHomeowner === true && zip.length === 5 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setNotHomeownerMsg(false);
    try {
      const res = await fetch("/api/qualify/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, isHomeowner }),
      });
      const data = await res.json();
      if (data.result === "not-homeowner") {
        setNotHomeownerMsg(true);
      } else if (data.result === "pass") {
        onPass(data.token, data.tier, zip);
      } else {
        onFail(zip);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          {t("gate.homeownerQuestion")}
        </p>
        <div className="flex gap-3">
          {[
            { label: t("gate.yes"), value: true },
            { label: t("gate.no"), value: false },
          ].map(({ label, value }) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => {
                setIsHomeowner(value);
                setNotHomeownerMsg(false);
              }}
              className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-all ${
                isHomeowner === value
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-text-secondary border-border hover:border-border-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {notHomeownerMsg && (
          <p className="mt-3 text-sm text-amber-400 leading-relaxed">
            {t("gate.notHomeownerMsg")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          {t("gate.zipLabel")}
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
          placeholder={t("gate.zipPlaceholder")}
          className="w-full bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 text-lg tracking-widest focus:outline-none focus:border-accent-blue transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-4 rounded-lg text-base font-bold transition-all bg-white text-black hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? t("gate.submitting") : t("gate.submit")}
      </button>
    </form>
  );
}

// ─── Capture Form ─────────────────────────────────────────────────────────────

function CaptureForm({
  token,
  tier,
  zip,
  onSuccess,
}: {
  token: string;
  tier: string;
  zip: string;
  onSuccess: (newToken: string) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() && phone.trim() && email.trim() && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/qualify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, zip, tier, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("common.genericError"));
        return;
      }
      onSuccess(data.token);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 focus:outline-none focus:border-accent-blue transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("gate.namePlaceholder")}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Phone Number</label>
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("gate.phonePlaceholder")}
          className={inputCls}
        />
        <p className="mt-2 text-xs text-text-hint leading-relaxed">{t("gate.smsConsent")}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("gate.emailPlaceholder")}
          className={inputCls}
        />
      </div>

      {error && <p className="text-sm text-error-text">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-4 rounded-lg text-base font-bold transition-all bg-white text-black hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed mt-2"
      >
        {loading ? t("gate.continuing") : t("gate.continue")}
      </button>

      <p className="text-xs text-text-hint text-center leading-relaxed">
        By clicking &quot;Continue&quot; you agree to our{" "}
        <a href="/privacy" className="underline text-text-secondary hover:text-text-primary">
          Privacy Policy
        </a>{" "}
        and consent to be contacted via SMS.
      </p>
    </form>
  );
}

// ─── Out-of-Area Form ─────────────────────────────────────────────────────────

function OutOfAreaForm({ zip }: { zip: string }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || loading) return;
    setLoading(true);
    try {
      await fetch("/api/qualify/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, zip }),
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 focus:outline-none focus:border-accent-blue transition-colors";

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-4">✓</div>
        <p className="text-text-primary font-semibold text-lg mb-2">{t("gate.waitlistSuccess")}</p>
        <p className="text-text-secondary text-sm">{t("gate.waitlistSuccessSub")}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-text-primary mb-1 font-semibold">{t("gate.outOfArea")}</p>
      <p className="text-text-secondary text-sm mb-5">{t("gate.outOfAreaSub")}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("gate.namePlaceholder")}
          className={inputCls}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("gate.emailPlaceholder")}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!name.trim() || !email.trim() || loading}
          className="w-full py-4 rounded-lg text-base font-bold transition-all bg-white text-black hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? t("gate.notifying") : t("gate.notify")}
        </button>
      </form>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const REVIEWS = [
  { stars: 5, quote: "Didn't know I had a problem until they showed me photos from the attic. Fixed before the next rainstorm.", name: "Michael R.", city: "El Paso, TX" },
  { stars: 5, quote: "Fast, professional, no pressure. They found damage my regular roofer missed for years.", name: "Sandra L.", city: "El Paso, TX" },
  { stars: 5, quote: "Free inspection turned into a claim I didn't know I could make. Couldn't be happier.", name: "James T.", city: "Las Cruces, NM" },
  { stars: 5, quote: "The rep was thorough, explained everything, and the report was ready the same day.", name: "Patricia M.", city: "El Paso, TX" },
];

const FAQ_TEASER = [
  { q: "Is it really free?", a: "Yes — no cost, no obligation, ever. You get a full roof and attic inspection with a written report. We don't charge for inspections." },
  { q: "Do I have to buy anything?", a: "No. The inspection and report are yours regardless of what you decide. We will walk you through what we found and let you make an informed decision." },
  { q: "How long does the inspection take?", a: "Most inspections take 45–60 minutes. We inspect the roof surface and go into the attic, then sit down with you and walk through every finding." },
];

const GALLERY_PREVIEW = [
  { label: "Amber Deposits", area: "Northeast El Paso", desc: "Heat-stressed attic rafters showing sap bleed — a sign of sustained high temperatures from ventilation failure." },
  { label: "Granule Loss", area: "East El Paso", desc: "Heavy granule erosion exposing the fiberglass mat. Roof approaching end of functional life." },
  { label: "Cat Eyes (Nail Rot)", area: "Las Cruces, NM", desc: "Condensation-driven nail rot on attic decking — common when soffit ventilation is blocked." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useLanguage();
  const [funnelState, setFunnelState] = useState<FunnelState>("gate");
  const [gateToken, setGateToken] = useState("");
  const [gateTier, setGateTier] = useState("");
  const [gateZip, setGateZip] = useState("");
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "true") {
      setShowExpiredBanner(true);
      const timer = setTimeout(() => setShowExpiredBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  function scrollToGate() {
    gateRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleGatePass(token: string, tier: string, zip: string) {
    setGateToken(token);
    setGateTier(tier);
    setGateZip(zip);
    setFunnelState("capture");
    setTimeout(() => gateRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function handleGateFail(zip: string) {
    setGateZip(zip);
    setFunnelState("out_of_area");
    setTimeout(() => gateRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <>
      {showExpiredBanner && (
        <div className="fixed top-16 inset-x-0 z-50 bg-amber-500 text-black text-sm font-medium text-center py-3 px-4">
          Your session expired — please start again.
        </div>
      )}

      {/* ── 1a. Hero ─────────────────────────────────────────────── */}
      <section className="px-5 pt-20 pb-20 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-bg-elevated border border-border rounded-full px-4 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-8">
          Owens Corning Preferred Contractor
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          {t("hero.home.headline")}
        </h1>

        <p className="text-text-secondary text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
          {t("hero.home.sub")}
        </p>

        <button
          onClick={scrollToGate}
          className="inline-block bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-base px-8 py-4 rounded-lg transition-colors"
        >
          {t("cta.checkArea")}
        </button>

        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
          {(["trustStrip.item1", "trustStrip.item2", "trustStrip.item3", "trustStrip.item4"] as const).map(
            (key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="text-success-text">✓</span>
                {t(key)}
              </span>
            )
          )}
        </div>
      </section>

      {/* ── Guide link ───────────────────────────────────────────── */}
      <div className="text-center pb-10 -mt-8">
        <a
          href="/roof-guide"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Get My Free Roof Health Guide →
        </a>
      </div>

      {/* ── 1b. The Problem ───────────────────────────────────────── */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
            Why this matters
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { num: "01", text: "By the time you see a water stain on your ceiling, there are gallons of water inside your home's structure. The damage started long before the stain appeared." },
              { num: "02", text: "Most roof failures start in the attic — not on the surface. Ventilation failure, moisture buildup, and rotting wood are invisible unless someone actually goes up there." },
              { num: "03", text: "Ignoring small damage doesn't save money. It multiplies it. A minor repair today becomes structural work, insulation, and drywall if left alone." },
            ].map(({ num, text }) => (
              <div key={num} className="border border-border bg-bg-base rounded-xl p-6">
                <p className="text-accent-blue text-xs font-bold uppercase tracking-widest mb-4">{num}</p>
                <p className="text-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 1c. How It Works (summary) ────────────────────────────── */}
      <section className="px-5 py-16 max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase text-center mb-10">
          How It Works
        </p>
        <div className="space-y-7">
          {[
            "Tell us your ZIP — we confirm we service your area",
            "Answer a few quick questions about your home",
            "We schedule your inspection — roof, attic, written report, same day",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-5">
              <span className="shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-sm font-bold text-text-secondary">
                {i + 1}
              </span>
              <p className="text-text-secondary text-base leading-relaxed pt-1.5">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a href="/how-it-works" className="text-accent-blue hover:text-accent-blue-hover text-sm font-medium transition-colors">
            {t("cta.seeFullProcess")}
          </a>
        </div>
      </section>

      {/* ── 1d. Social Proof Strip ────────────────────────────────── */}
      <section className="py-16 bg-bg-surface">
        <div className="max-w-5xl mx-auto px-5">
          <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase text-center mb-10">
            What homeowners are saying
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {REVIEWS.map((r, i) => (
              <div key={i} className="border border-border bg-bg-base rounded-xl p-5">
                <Stars count={r.stars} />
                <p className="text-text-secondary text-sm leading-relaxed mb-4">
                  &ldquo;{r.quote}&rdquo;
                </p>
                <p className="text-text-hint text-xs">
                  {r.name} &middot; {r.city}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/reviews" className="text-accent-blue hover:text-accent-blue-hover text-sm font-medium transition-colors">
              {t("cta.seeAllReviews")}
            </a>
          </div>
        </div>
      </section>

      {/* ── 1e. Gallery Preview ───────────────────────────────────── */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase text-center mb-10">
          Real inspection findings
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {GALLERY_PREVIEW.map(({ label, area, desc }) => (
            <div key={label} className="border border-border bg-bg-surface rounded-xl overflow-hidden">
              <div className="h-40 bg-bg-elevated flex items-center justify-center">
                <span className="text-4xl">📷</span>
              </div>
              <div className="p-4">
                <p className="text-text-primary text-sm font-semibold mb-0.5">{label}</p>
                <p className="text-text-hint text-xs mb-2">{area}</p>
                <p className="text-text-secondary text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a href="/gallery" className="text-accent-blue hover:text-accent-blue-hover text-sm font-medium transition-colors">
            {t("cta.viewGallery")}
          </a>
        </div>
      </section>

      {/* ── 1f. ZIP Gate ──────────────────────────────────────────── */}
      <section id="check-area" ref={gateRef} className="px-5 py-20 bg-bg-surface">
        <div className="max-w-md mx-auto">
          <div className="border border-border bg-bg-base rounded-2xl p-7 sm:p-8">
            {funnelState === "gate" && (
              <>
                <h2 className="text-xl font-bold text-text-primary mb-2">{t("gate.title")}</h2>
                <p className="text-text-secondary text-sm mb-6">
                  Our inspections are free, same-day, and cover the roof surface and attic.
                </p>
                <GateForm onPass={handleGatePass} onFail={handleGateFail} />
              </>
            )}

            {funnelState === "capture" && (
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-2">{t("gate.inArea")}</h2>
                <p className="text-text-secondary text-sm mb-6">{t("gate.inAreaSub")}</p>
                <CaptureForm
                  token={gateToken}
                  tier={gateTier}
                  zip={gateZip}
                  onSuccess={(token) => { window.location.href = `/qualify?token=${encodeURIComponent(token)}`; }}
                />
              </div>
            )}

            {funnelState === "out_of_area" && (
              <OutOfAreaForm zip={gateZip} />
            )}
          </div>
        </div>
      </section>

      {/* ── 1g. FAQ Teaser ────────────────────────────────────────── */}
      <section className="px-5 py-16 max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-text-hint uppercase text-center mb-10">
          Common questions
        </p>
        <div className="space-y-5">
          {FAQ_TEASER.map(({ q, a }) => (
            <div key={q} className="border border-border bg-bg-surface rounded-xl p-5">
              <p className="text-text-primary font-semibold text-sm mb-2">{q}</p>
              <p className="text-text-secondary text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a href="/faq" className="text-accent-blue hover:text-accent-blue-hover text-sm font-medium transition-colors">
            {t("cta.seeAllQuestions")}
          </a>
        </div>
      </section>
    </>
  );
}
