import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DNS Manager",
  robots: "noindex, nofollow",
};

export default function MtoolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no navbar entry from the main site.
  // The DNS Manager has its own internal navigation.
  return <>{children}</>;
}
