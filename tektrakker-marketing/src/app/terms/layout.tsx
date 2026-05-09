import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | TekTrakker",
  description: "TekTrakker Terms of Service. Read the rules, guidelines, and agreements for using the TekTrakker platform.",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
