import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Noto_Sans, Noto_Sans_Display, Geist } from "next/font/google";
import "./globals.css";
import "./home.css";
import "./scan.css";
import { Analytics } from "@vercel/analytics/next";
import Offline from "@/components/Offline";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const noto = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
  display: "swap",
});

const display = Noto_Sans_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const description = "Design your space with halal-certified 3D assets and elegant simplicity.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Makan 3D | Premium Space Planning",
  description,
  applicationName: "Makan3D",
  appleWebApp: { capable: true, title: "Makan3D", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Makan3D", title: "Makan 3D | Premium Space Planning", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Makan 3D | Premium Space Planning", description },
};

export const viewport: Viewport = {
  themeColor: "#f5f4f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(noto.variable, display.variable, "font-sans", geist.variable)}>
      <body className="animate-fade-in">
        {children}
        <Analytics />
        {/* Plausible, served through our own domain (see the rewrites in next.config.ts) so the CSP stays self-only */}
        <Script src="/pl/script.js" data-domain="usebygga.com" data-api="/pl/event" strategy="afterInteractive" />
        {/* it reads the path, which the prerendered shell doesn't know yet */}
        <Suspense fallback={null}>
          <Offline />
        </Suspense>
      </body>
    </html>
  );
}
