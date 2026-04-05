import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "రాయలసీమ ఎక్స్‌ప్రెస్ | Rayalaseema Express",
  description:
    "రాయలసీమ ప్రాంతం నుండి తాజా వార్తలు, రాజకీయాలు, క్రీడలు, వ్యాపారం మరియు మరిన్ని. Latest news from Rayalaseema region.",
  keywords: [
    "Rayalaseema Express",
    "రాయలసీమ ఎక్స్‌ప్రెస్",
    "Telugu news",
    "Kurnool news",
    "Anantapur news",
    "Kadapa news",
    "Rayalaseema news",
  ],
  openGraph: {
    title: "రాయలసీమ ఎక్స్‌ప్రెస్ | Rayalaseema Express",
    description: "రాయలసీమ ప్రాంతం నుండి తాజా వార్తలు",
    type: "website",
    locale: "te_IN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="te">
      <body className="font-telugu antialiased">{children}</body>
    </html>
  );
}
