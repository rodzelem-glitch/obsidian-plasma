import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TekTrakker",
  description: "TekTrakker Privacy Policy. Learn how we handle your personal data across our web and mobile applications.",
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
