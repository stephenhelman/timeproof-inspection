import type { Metadata } from "next";
import { LanguageProvider } from "@/src/components/marketing/LanguageProvider";
import Header from "@/src/components/marketing/Header";
import Footer from "@/src/components/marketing/Footer";
import MobileCTABanner from "@/src/components/marketing/MobileCTABanner";

export const metadata: Metadata = {
  title: {
    template: "%s | Scope Reports — Qntum Roofing",
    default: "Scope Reports — Free Roof Inspection | Qntum Roofing El Paso",
  },
  description:
    "Qntum Roofing offers free roof and attic inspections with a same-day written Scope Report. Serving El Paso, Las Cruces, and Alamogordo. No cost, no obligation.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MARKETING_URL || "https://scopereports.com"
  ),
  openGraph: {
    type: "website",
    siteName: "Scope Reports",
    locale: "en_US",
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col bg-[#0a0e1a] text-white">
        <Header />
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <Footer />
        <MobileCTABanner />
      </div>
    </LanguageProvider>
  );
}
