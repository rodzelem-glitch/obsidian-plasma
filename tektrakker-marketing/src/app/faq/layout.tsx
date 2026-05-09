import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TekTrakker FAQ | Frequently Asked Questions",
  description: "Find answers to your questions about TekTrakker's all-in-one software platform for trade services, mobile app, Kiosk mode, B2B Contractor Marketplace, and more.",
  openGraph: {
    title: "TekTrakker FAQ | Frequently Asked Questions",
    description: "Find answers to your questions about TekTrakker's all-in-one software platform for trade services, mobile app, Kiosk mode, B2B Contractor Marketplace, and more.",
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
