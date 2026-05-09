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
  title: "TekTrakker | Operating System for Trade Services",
  description: "Stop drowning in paperwork. TekTrakker is the all-in-one software platform for HVAC, Plumbing, and Electrical businesses.",
  openGraph: {
    title: "TekTrakker | Operating System for Trade Services",
    description: "Stop drowning in paperwork. TekTrakker is the all-in-one software platform for HVAC, Plumbing, and Electrical businesses.",
    url: "https://tektrakker.com",
    siteName: "TekTrakker",
    locale: "en_US",
    type: "website",
  },
};

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
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
