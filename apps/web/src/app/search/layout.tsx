import type { Metadata } from "next";

// Search results pages should not be indexed (no SEO value, infinite variants)
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
