"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";

export default function MobileCTABanner() {
  const { t } = useLanguage();
  const pathname = usePathname();

  if (pathname.startsWith("/roof-guide")) return null;

  function handleClick() {
    const el = document.getElementById("check-area");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = "/#check-area";
    }
  }

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 p-3 bg-bg-base border-t border-border">
      <button
        onClick={handleClick}
        className="w-full bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-sm py-3.5 rounded-lg transition-colors"
      >
        {t("cta.mobileBanner")}
      </button>
    </div>
  );
}
