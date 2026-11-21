import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "./providers";

// Self-hosted (latin subset): next/font/google breaks under Turbopack with multi-weight queries and
// needs network access at dev/build time.
const roboto = localFont({
  variable: "--font-roboto",
  src: "./fonts/Roboto.woff2",
  weight: "100 900",
  display: "swap",
});

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "./fonts/Poppins-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Poppins-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const raleway = localFont({
  variable: "--font-raleway",
  src: "./fonts/Raleway.woff2",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Interactive 3D World",
  description:
    "An interactive 3D portfolio you explore by car, built with Next.js and Babylon.js.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "google-site-verification": "dDLRGEWAOnSN1Oueefrmcckxt2osYwh32Ql_qbk7WgA",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${roboto.variable} ${poppins.variable} ${raleway.variable}`}
    >
      <head>
        {/* start downloading the car (the start screen waits for it) while the 3D engine is still loading */}
        {["race"].map((m) => (
          <link key={m} rel="preload" as="fetch" href={`/models/${m}.glb`} crossOrigin="anonymous" />
        ))}
      </head>
      <body suppressHydrationWarning>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-FFMK11Z2BV"
          strategy="afterInteractive"
        />
        <Script id="ga-setup" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-FFMK11Z2BV', { page_path: window.location.pathname });
          `}
        </Script>
      </body>
    </html>
  );
}
