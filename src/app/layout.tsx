import type { Metadata } from "next";
import { Poppins, Raleway, Roboto } from "next/font/google";
import Script from "next/script";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "./providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  // Raleway is a variable font: one file covers every weight. Listing weights explicitly makes
  // Turbopack on Vercel fail ("next/font/google queries have exactly one entry").
});

export const metadata: Metadata = {
  title: "Interactive 3D World",
  description:
    "An interactive, walkable 3D portfolio built with Next.js and Babylon.js.",
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
      lang="uz"
      suppressHydrationWarning
      className={`${roboto.variable} ${poppins.variable} ${raleway.variable}`}
    >
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
