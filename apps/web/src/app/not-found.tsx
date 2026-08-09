import "@/styles/route-not-found.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - పేజీ కనిపించలేదు | రాయలసీమ న్యూస్",
  description: "మీరు వెతుకుతున్న పేజీ కనిపించలేదు. రాయలసీమ న్యూస్ హోమ్‌కి తిరిగి వెళ్ళండి.",
  robots: { index: false, follow: true },
};

// On-brand 404. Concept: the "0" of 404 is a location pin holding a heart -
// you've lost your way, but home (మన గళం, మన కథలు) is where the heart is.
// Districts use the same bare-slug routes as the header nav.
const QUICK_LINKS = [
  { label: "కర్నూలు", href: "/kurnool" },
  { label: "నంద్యాల", href: "/nandyal" },
  { label: "అనంతపురం", href: "/ananthapuramu" },
  { label: "వై.యస్.ఆర్", href: "/ysr-kadapa" },
  { label: "తిరుపతి", href: "/tirupati" },
  { label: "చిత్తూరు", href: "/chittoor" },
  { label: "క్రీడలు", href: "/sports" },
  { label: "సినిమా", href: "/entertainment" },
];

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 20px",
        background:
          "radial-gradient(1200px 600px at 50% -10%, var(--brand-soft, #FFF1F1) 0%, #ffffff 55%)",
      }}
    >
      {/* Logo - links home */}
      <Link href="/" aria-label="రాయలసీమ న్యూస్ హోమ్" className="rsn-logo" style={{ display: "inline-block", marginBottom: 28 }}>
        {/* Optimizer URL, not the raw 36 KB PNG. The global not-found
            boundary's tree is serialised into EVERY page's flight payload,
            and Next emitted an HL preload hint for this img's src - so the
            raw logo was preloaded at high priority on every page of the
            site, on phones, ahead of the LCP hero. The optimizer URL keeps
            the same logo as a ~10 KB AVIF if the hint ever returns. */}
        <img
          src="/_next/image?url=%2Flogo.png&w=384&q=75"
          alt="రాయలసీమ న్యూస్"
          width={272}
          height={56}
          style={{ height: 56, width: "auto" }}
        />
      </Link>

      {/* 4 0 4 with the 0 as a heart-pin */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(6px, 2vw, 18px)",
          lineHeight: 1,
        }}
      >
        <span className="rsn-404-digit">4</span>

        <span className="rsn-pin-wrap" aria-hidden="true">
          {/* location pin with a heart inside */}
          <svg className="rsn-pin" width="118" height="118" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 4C20.4 4 11 13.4 11 25c0 14.7 17.6 31.2 19.5 33a2.2 2.2 0 0 0 3 0C35.4 56.2 53 39.7 53 25 53 13.4 43.6 4 32 4Z"
              fill="var(--brand, #E01B1B)"
            />
            <path
              d="M32 4C20.4 4 11 13.4 11 25c0 14.7 17.6 31.2 19.5 33a2.2 2.2 0 0 0 3 0C35.4 56.2 53 39.7 53 25 53 13.4 43.6 4 32 4Z"
              fill="url(#rsnPinShade)"
              opacity="0.18"
            />
            <path
              className="rsn-heart"
              d="M32 34.6c-.5 0-1-.18-1.36-.52l-6.1-5.84c-2.2-2.12-2.2-5.56 0-7.67a5.46 5.46 0 0 1 7.46 0c2.06-1.96 5.4-1.96 7.46 0 2.2 2.11 2.2 5.55 0 7.67l-6.1 5.84c-.36.34-.86.52-1.36.52Z"
              fill="#fff"
            />
            <defs>
              <linearGradient id="rsnPinShade" x1="11" y1="4" x2="53" y2="60" gradientUnits="userSpaceOnUse">
                <stop stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" />
              </linearGradient>
            </defs>
          </svg>
          <span className="rsn-pin-shadow" />
        </span>

        <span className="rsn-404-digit">4</span>
      </div>

      {/* Copy */}
      <h1
        style={{
          fontFamily: "var(--font-telugu-heading)",
          fontSize: "clamp(24px, 4.5vw, 38px)",
          fontWeight: 800,
          color: "#111827",
          margin: "22px 0 0",
        }}
      >
        దారి తప్పారా? పర్వాలేదు.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-telugu-body)",
          fontSize: "clamp(14px, 2.2vw, 16px)",
          color: "#4b5563",
          lineHeight: 1.7,
          maxWidth: 560,
          margin: "12px auto 0",
        }}
      >
        మీరు వెతుకుతున్న పేజీ తొలగించబడి ఉండవచ్చు, లేదా చిరునామా మారి ఉండవచ్చు.
        కానీ చింతించకండి - రాయలసీమ నేల ఎప్పుడూ తన వాళ్ళకు ఇంటి దారి చూపిస్తుంది.
      </p>

      {/* Actions - styled via scoped classes (with !important) so global link
          styles can't bleed in and wreck the colors. */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 26 }}>
        <Link href="/" className="rsn-btn rsn-btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
          హోమ్‌కి తిరిగి వెళ్ళండి
        </Link>
        <Link href="/search" className="rsn-btn rsn-btn-secondary">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          వార్తలు వెతకండి
        </Link>
      </div>

      {/* Popular destinations */}
      <div style={{ marginTop: 34, maxWidth: 620 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
          ఇవి చూడండి
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rsn-chip"
              style={{
                fontFamily: "var(--font-telugu-body)",
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 999,
                padding: "7px 15px",
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Emotional sign-off - echoes the masthead tagline */}
      <p style={{ marginTop: 38, fontFamily: "var(--font-telugu-heading)", fontSize: 13, color: "var(--brand, #E01B1B)", fontWeight: 700, letterSpacing: 0.5 }}>
        మన గళం&nbsp;&nbsp;•&nbsp;&nbsp;మన కలం
      </p>

    </main>
  );
}
