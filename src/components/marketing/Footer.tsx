"use client";

import { useLanguage } from "./LanguageProvider";

const QNTUM_URL = process.env.NEXT_PUBLIC_QNTUM_WEBSITE_URL || "https://qntumroofing.com";

const FOOTER_LINKS = [
  { key: "nav.howItWorks", href: "/how-it-works" },
  { key: "nav.whyQntum", href: "/why-qntum" },
  { key: "nav.serviceArea", href: "/service-area" },
  { key: "nav.gallery", href: "/gallery" },
  { key: "nav.reviews", href: "/reviews" },
  { key: "nav.faq", href: "/faq" },
  { key: "nav.about", href: "/about" },
  { key: "nav.contact", href: "/contact" },
];

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-bg-base border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <a href="/" className="flex items-center mb-3">
              <img src="/sr_logo_light_transparent.svg" alt="Scope Reports" className="h-8 w-auto" />
            </a>
            <p className="text-text-hint text-sm">
              {t("common.poweredBy")}{" "}
              <a
                href={QNTUM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary underline transition-colors"
              >
                {t("common.qntumRoofing")} ↗
              </a>
            </p>
          </div>

          {/* Nav links */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider font-semibold mb-3">
              Pages
            </p>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-text-secondary hover:text-text-primary text-sm transition-colors"
                >
                  {t(link.key)}
                </a>
              ))}
            </nav>
          </div>

          {/* Service area summary */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider font-semibold mb-3">
              Service Area
            </p>
            <p className="text-text-secondary text-sm leading-relaxed">
              El Paso, TX · Las Cruces, NM · Alamogordo, NM
            </p>
            <a
              href="/#check-area"
              className="inline-block mt-3 text-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
            >
              Check your ZIP →
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-hint">
          <p>{t("common.copyright")}</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-text-secondary transition-colors">
              {t("common.privacyPolicy")}
            </a>
            <a href="/contact" className="hover:text-text-secondary transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
