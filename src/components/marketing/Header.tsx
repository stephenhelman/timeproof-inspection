"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

const NAV_LINKS = [
  { key: "nav.home", href: "/" },
  { key: "nav.howItWorks", href: "/how-it-works" },
  { key: "nav.whyQntum", href: "/why-qntum" },
  { key: "nav.serviceArea", href: "/service-area" },
  { key: "nav.gallery", href: "/gallery" },
  { key: "nav.reviews", href: "/reviews" },
  { key: "nav.faq", href: "/faq" },
  { key: "nav.about", href: "/about" },
  { key: "nav.contact", href: "/contact" },
];

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-bg-base border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14">
        {/* Logo — flex-1 on mobile/tablet so it fills the bar */}
        <a href="/" className="flex items-center flex-1 lg:flex-none shrink-0">
          <img
            src="/sr_logo_light_transparent.svg"
            alt="Scope Reports"
            className="h-6 w-auto"
          />
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-secondary hover:text-text-primary text-xs px-2 py-1.5 rounded transition-colors whitespace-nowrap"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>

        {/* Right: lang toggle (desktop only) + hamburger (mobile/tablet) */}
        <div className="flex items-center gap-2">
          {/* Language toggle — desktop only */}
          <div className="hidden lg:flex items-center gap-0.5 text-xs font-semibold">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 rounded transition-colors ${
                lang === "en"
                  ? "text-text-primary bg-bg-elevated"
                  : "text-text-hint hover:text-text-secondary"
              }`}
            >
              EN
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setLang("es")}
              className={`px-2 py-1 rounded transition-colors ${
                lang === "es"
                  ? "text-text-primary bg-bg-elevated"
                  : "text-text-hint hover:text-text-secondary"
              }`}
            >
              ES
            </button>
          </div>

          {/* Hamburger (mobile + tablet) */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden flex flex-col gap-1.5 p-2 text-text-secondary hover:text-text-primary"
            aria-label="Toggle menu"
          >
            <span
              className={`block h-0.5 w-5 bg-current transition-transform origin-center ${
                menuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform origin-center ${
                menuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile/tablet nav drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-bg-base border-t border-border px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-text-secondary hover:text-text-primary text-sm px-3 py-2.5 rounded transition-colors"
              >
                {t(link.key)}
              </a>
            ))}
          </nav>

          {/* Lang toggle in drawer */}
          <div className="flex items-center gap-0.5 text-xs font-semibold border-t border-border mt-3 pt-3">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1.5 rounded transition-colors ${
                lang === "en"
                  ? "text-text-primary bg-bg-elevated"
                  : "text-text-hint hover:text-text-secondary"
              }`}
            >
              EN
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setLang("es")}
              className={`px-3 py-1.5 rounded transition-colors ${
                lang === "es"
                  ? "text-text-primary bg-bg-elevated"
                  : "text-text-hint hover:text-text-secondary"
              }`}
            >
              ES
            </button>
          </div>

          <a
            href="/#check-area"
            onClick={() => setMenuOpen(false)}
            className="mt-3 flex items-center justify-center bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-bold px-4 py-3 rounded-lg transition-colors"
          >
            {t("nav.checkArea")}
          </a>
        </div>
      )}

      <span className="sr-only">Scope Reports</span>
    </header>
  );
}
