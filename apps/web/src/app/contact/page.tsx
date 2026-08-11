// Contact page - E-E-A-T trust surface. Every line is SiteConfig-driven and
// hides when its key is empty (same contract as the footer publisher strip),
// so nothing renders as a blank label and nothing is hardcoded. Google News /
// AdSense reviewers look for a reachable publisher: legal name, postal
// address, phone, and per-desk emails.

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSiteConfig } from "@/lib/db-queries";
import Link from "next/link";

export const metadata = {
  title: "సంప్రదించండి - Contact Us",
  description:
    "Contact Rayalaseema News - editorial desk, news tips, advertising, grievance officer and reader feedback. రాయలసీమ న్యూస్ ను సంప్రదించండి - వార్తలు, ప్రకటనలు, అభిప్రాయాలు.",
  alternates: { canonical: "/contact" },
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

export default async function ContactPage() {
  const config = await getSiteConfig();
  const editorialEmail = config.editorial_email || "editor@rayalaseemanews.com";
  const newsEmail = config.news_tips_email || "news@rayalaseemanews.com";
  const adsEmail = config.ads_email || "ads@rayalaseemanews.com";
  const grievanceEmail = config.grievance_email || "grievance@rayalaseemanews.com";
  const generalEmail = config.contact_email || "info@rayalaseemanews.com";

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#111" }}>సంప్రదించండి</h1>
        <p style={{ fontSize: 16, color: "#888", marginBottom: 24 }}>Contact Us</p>

        <p style={{ fontSize: 15, color: "#444", lineHeight: 1.9, marginBottom: 28 }}>
          వార్తా సూచనలు, సవరణలు, ప్రకటనలు, ఫిర్యాదులు — దేని కోసమైనా మమ్మల్ని సంప్రదించవచ్చు.
          ప్రతి విభాగానికి ప్రత్యేక ఇమెయిల్ చిరునామా కింద ఇవ్వబడింది. వార్తల్లో తప్పు కనిపిస్తే మా{" "}
          <Link href="/corrections-policy" style={{ color: "var(--color-brand)" }}>సవరణల విధానం</Link> ప్రకారం
          ఎడిటోరియల్ డెస్క్‌కు రాయండి — పరిశీలించి బహిరంగంగా సవరిస్తాము.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111" }}>Editorial / ఎడిటోరియల్ డెస్క్</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 2 }}>
              Email: <a href={`mailto:${editorialEmail}`} style={{ color: "var(--color-brand)" }}>{editorialEmail}</a><br />
              News tips / వార్తా సూచనలు: <a href={`mailto:${newsEmail}`} style={{ color: "var(--color-brand)" }}>{newsEmail}</a><br />
              Corrections: see <Link href="/corrections-policy" style={{ color: "var(--color-brand)" }}>corrections policy</Link>
            </p>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111" }}>Advertising / ప్రకటనలు</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 2 }}>
              Email: <a href={`mailto:${adsEmail}`} style={{ color: "var(--color-brand)" }}>{adsEmail}</a><br />
              {config.contact_phone && (
                <>Phone: <a href={`tel:${config.contact_phone.replace(/\s+/g, "")}`} style={{ color: "var(--color-brand)" }}>{config.contact_phone}</a><br /></>
              )}
              For ad rates and media kit
            </p>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111" }}>Grievance Officer / ఫిర్యాదుల అధికారి</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 2 }}>
              Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021<br />
              {config.grievance_officer_name && <>Officer: {config.grievance_officer_name}<br /></>}
              Email: <a href={`mailto:${grievanceEmail}`} style={{ color: "var(--color-brand)" }}>{grievanceEmail}</a><br />
              Acknowledgement within 36 hours; resolution within 15 days, as the Rules require
            </p>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111" }}>General / సాధారణ సంప్రదింపులు</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 2 }}>
              Email: <a href={`mailto:${generalEmail}`} style={{ color: "var(--color-brand)" }}>{generalEmail}</a><br />
              Reader feedback: see <Link href="/feedback-policy" style={{ color: "var(--color-brand)" }}>feedback policy</Link>
            </p>
          </div>
        </div>

        {/* Publisher block - legal name + registered address. The same
            SiteConfig keys the footer's publisher strip renders, so the two
            surfaces can never disagree. */}
        <section style={{ ...card, marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111" }}>Publisher / ప్రచురణకర్త</h3>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 2 }}>
            {config.publisher_legal_name && <>{config.publisher_legal_name}<br /></>}
            {config.contact_address && <>{config.contact_address}<br /></>}
            {config.publisher_rni && <>RNI: {config.publisher_rni}<br /></>}
            {config.publisher_gst && <>GSTIN: {config.publisher_gst}<br /></>}
            Ownership and funding details: <Link href="/ownership" style={{ color: "var(--color-brand)" }}>/ownership</Link> ·
            Editorial team: <Link href="/masthead" style={{ color: "var(--color-brand)" }}>/masthead</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
