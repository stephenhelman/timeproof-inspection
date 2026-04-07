import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/src/components/Providers";

export const metadata: Metadata = {
  title: "TIMEPROOF Inspection Reports",
  description: "Roof inspection reporting for TIMEPROOFUSA sales reps.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
