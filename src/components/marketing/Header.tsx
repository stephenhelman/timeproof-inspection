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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <img src="/qntum-logo.svg" alt="Scope Reports" className="h-7 w-auto" />
          <span className="text-text-primary font-bold text-base tracking-tight hidden sm:block">
            Scope Reports
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-secondary hover:text-text-primary text-sm px-2.5 py-1.5 rounded transition-colors"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>

        {/* Right side: lang toggle + CTA + hamburger */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex items-center gap-0.5 text-xs font-semibold">
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

          {/* CTA button */}
          <a
            href="/#check-area"
            className="hidden sm:inline-flex items-center bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {t("nav.checkArea")}
          </a>

          {/* Hamburger (mobile/tablet) */}
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

      {/* Mobile nav drawer */}
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
          <a
            href="/#check-area"
            className="mt-3 flex items-center justify-center bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-bold px-4 py-3 rounded-lg transition-colors"
          >
            {t("nav.checkArea")}
          </a>
        </div>
      )}
    </header>
  );
}
