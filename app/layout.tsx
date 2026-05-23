import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/src/components/Providers";

export const metadata: Metadata = {
  title: "Scope Reports",
  description: "Scope Reports — inspection and documentation tool.",
  icons: {
    icon: [
      { url: "/sr_monicle_light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/sr_monicle_dark.svg", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/sr_monicle_light.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest-dark.json" id="app-manifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Scope Reports" />
        <link rel="apple-touch-icon" href="/sr_monicle_light.png" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" href="/sr_monicle_dark.png" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0e1a" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var dark = window.matchMedia('(prefers-color-scheme: dark)');
                var el = document.getElementById('app-manifest');
                if (el) el.href = dark.matches ? '/manifest-dark.json' : '/manifest-light.json';
                dark.addEventListener('change', function(e) {
                  var m = document.getElementById('app-manifest');
                  if (m) m.href = e.matches ? '/manifest-dark.json' : '/manifest-light.json';
                });
              })();
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
