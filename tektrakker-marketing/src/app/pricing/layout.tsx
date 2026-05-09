import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TekTrakker Pricing | Pro Business Tier",
  description: "Scale your service business with our Pro Business Tier. Start your 14-day free trial and unlock automated reminders, GPS fleet tracking, AI timesheet auditing, and more.",
  openGraph: {
    title: "TekTrakker Pricing | Pro Business Tier",
    description: "Scale your service business with our Pro Business Tier. Start your 14-day free trial and unlock automated reminders, GPS fleet tracking, AI timesheet auditing, and more.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
