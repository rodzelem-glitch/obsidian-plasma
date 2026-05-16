import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TekTrakker | #1 Operating System for Trade Services",
  description: "Stop drowning in paperwork. TekTrakker is the all-in-one software platform for HVAC, Plumbing, and Electrical businesses.",
  metadataBase: new URL('https://tektrakker.com'),
  alternates: {
    canonical: "/",
    languages: {
      'en-US': '/',
    },
  },
  openGraph: {
    title: "TekTrakker | Operating System for Trade Services",
    description: "Stop drowning in paperwork. TekTrakker is the all-in-one software platform for HVAC, Plumbing, and Electrical businesses.",
    url: "https://tektrakker.com",
    siteName: "TekTrakker",
    locale: "en_US",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "TekTrakker",
  "operatingSystem": "Web, iOS, Android",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Stop drowning in paperwork. TekTrakker is the all-in-one software platform for HVAC, Plumbing, and Electrical businesses.",
  "url": "https://tektrakker.com"
};

import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        {/* Google Analytics Placeholder */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          `}
        </Script>

        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
