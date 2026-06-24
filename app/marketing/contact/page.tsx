"use client";

import { useState } from "react";
import { useLanguage } from "@/src/components/marketing/LanguageProvider";

export const dynamic = "force-static";

const HEAR_ABOUT_OPTIONS = [
  "Google Search",
  "Facebook Ad",
  "Referral from a friend",
  "Door-to-door",
  "Other",
];

const inputCls =
  "w-full bg-bg-elevated border border-border text-text-primary placeholder-text-hint rounded-lg px-4 py-3 focus:outline-none focus:border-accent-blue transition-colors text-sm";

export default function ContactPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    cityZip: "",
    message: "",
    hearAbout: "",
    website: "", // honeypot: hidden from real users, only bots fill it
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const canSubmit =
    form.name.trim() && (form.phone.trim() || form.email.trim()) && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("common.genericError"));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 text-text-primary">
          Get In Touch
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed">
          Prefer to reach out directly? We&apos;re here.
        </p>
      </section>

      <section className="px-5 py-12 bg-bg-surface">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Contact form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="border border-border bg-bg-base rounded-2xl p-10 text-center">
                <div className="text-4xl mb-4">✓</div>
                <p className="text-text-primary font-semibold text-lg mb-2">
                  {t("contact.successTitle")}
                </p>
                <p className="text-text-secondary text-sm">
                  We don&apos;t use bots for this — a real person will follow up.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="border border-border bg-bg-base rounded-2xl p-6 sm:p-8 space-y-4"
              >
                {/* Honeypot: off-screen and hidden from assistive tech. A filled
                    value means the submitter is a bot, and the server rejects it. */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Name <span className="text-accent-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={t("contact.namePlaceholder")}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder={t("contact.phonePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder={t("contact.emailPlaceholder")}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    City / ZIP
                  </label>
                  <input
                    type="text"
                    value={form.cityZip}
                    onChange={(e) => set("cityZip", e.target.value)}
                    placeholder={t("contact.cityZipPlaceholder")}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder={t("contact.messagePlaceholder")}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    {t("contact.hearAbout")}
                  </label>
                  <select
                    value={form.hearAbout}
                    onChange={(e) => set("hearAbout", e.target.value)}
                    className={`${inputCls} appearance-none`}
                  >
                    <option value="">Select one…</option>
                    {HEAR_ABOUT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {error && <p className="text-sm text-error-text">{error}</p>}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 rounded-lg text-base font-bold transition-all bg-accent-blue hover:bg-accent-blue-hover text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? t("contact.submitting") : t("contact.submit")}
                </button>
              </form>
            )}
          </div>

          {/* Direct contact */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="text-text-hint text-xs uppercase tracking-wider font-semibold mb-4">
                Direct contact
              </p>
              <div className="space-y-4">
                <a
                  href="tel:+19155550100"
                  className="flex items-center gap-3 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    📞
                  </span>
                  <div>
                    <p className="text-xs text-text-hint mb-0.5">Phone</p>
                    <p className="text-sm font-medium">(915) 555-0100</p>
                  </div>
                </a>
                <a
                  href="mailto:hello@scopereports.com"
                  className="flex items-center gap-3 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    ✉️
                  </span>
                  <div>
                    <p className="text-xs text-text-hint mb-0.5">Email</p>
                    <p className="text-sm font-medium">hello@scopereports.com</p>
                  </div>
                </a>
              </div>
            </div>

            <div>
              <p className="text-text-hint text-xs uppercase tracking-wider font-semibold mb-3">
                Business hours
              </p>
              <div className="space-y-1.5 text-sm text-text-secondary">
                <div className="flex justify-between">
                  <span>Monday – Friday</span>
                  <span className="text-text-primary">8am – 6pm</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday</span>
                  <span className="text-text-primary">9am – 3pm</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday</span>
                  <span className="text-text-hint">Closed</span>
                </div>
              </div>
            </div>

            <div className="border border-border bg-bg-base rounded-xl p-4">
              <p className="text-text-secondary text-xs leading-relaxed">
                Have a specific question?{" "}
                <a href="/faq" className="text-accent-blue hover:text-accent-blue-hover">
                  {t("contact.faqLink")}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
