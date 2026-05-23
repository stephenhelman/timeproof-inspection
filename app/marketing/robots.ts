import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_MARKETING_URL || "https://scopereports.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/qualify"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
