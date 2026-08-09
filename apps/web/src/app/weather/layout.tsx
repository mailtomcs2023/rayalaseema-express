// Metadata carrier for /weather - the page itself is a client component
// ("use client") and cannot export metadata, so without this layout the route
// inherited the ROOT layout's default title verbatim and was the one exact
// homepage-title duplicate on the site (meta audit 2026-08-09).

import type { Metadata } from "next";

export const metadata: Metadata = {
  // Root template appends " | Rayalaseema News".
  title: "Rayalaseema Weather Today - రాయలసీమ వాతావరణం",
  description:
    "Live weather for all 8 Rayalaseema districts - Kurnool, Nandyal, Anantapur, Kadapa, Tirupati, Chittoor. వాతావరణ సమాచారం, వ్యవసాయ సూచనలు, హెచ్చరికలు.",
  alternates: { canonical: "/weather" },
};

export default function WeatherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
