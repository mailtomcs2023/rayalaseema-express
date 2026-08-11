// About page - E-E-A-T trust surface. Facts come from SiteConfig where they
// exist (publisher name, contact address); everything else states only what
// the site's own published policies already say, with links into them. This
// is the page Google News reviewers and readers use to answer "who runs this
// site" - it must name the publisher, the coverage area, the standards, and
// where the money comes from (via /ownership).

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSiteConfig } from "@/lib/db-queries";
import Link from "next/link";

export const metadata = {
  title: "మా గురించి - About Us",
  description:
    "Rayalaseema News (రాయలసీమ న్యూస్) - hyper-local Telugu news for all 8 Rayalaseema districts. Our newsroom, editorial mission, standards and how to reach us.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const config = await getSiteConfig();
  const brand = config.publisher_brand_name || "Rayalaseema News";
  const legal = config.publisher_legal_name || "Medha Publications Private Limited";

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#111" }}>మా గురించి</h1>
        <p style={{ fontSize: 16, color: "#888", marginBottom: 32 }}>About {brand}</p>
        <div className="article-body" style={{ fontSize: 16, lineHeight: 2, color: "#333" }}>
          <p>
            <strong>రాయలసీమ న్యూస్</strong> రాయలసీమ ప్రాంతానికి అంకితమైన డిజిటల్ తెలుగు వార్తా సంస్థ.
            నమ్మకమైన, నిష్పక్షపాతమైన వార్తలు అందించడమే మా పని. పెద్ద మీడియా సంస్థల దృష్టి తక్కువగా పడే ఈ
            ప్రాంతపు వార్తలను — గ్రామం నుంచి జిల్లా కేంద్రం దాకా — ప్రతిరోజూ తెలుగులో అందిస్తున్నాము.
          </p>

          <h2>మేము కవర్ చేసే ప్రాంతం</h2>
          <p>
            కర్నూలు, నంద్యాల, అనంతపురం, శ్రీ సత్యసాయి, వైఎస్సార్ కడప, అన్నమయ్య, తిరుపతి, చిత్తూరు —
            రాయలసీమలోని ఈ ఎనిమిది జిల్లాల రాజకీయాలు, వ్యవసాయం, విద్య, క్రీడలు, సినిమా, వ్యాపార వార్తలను
            మండల స్థాయి వరకు అందిస్తాము. జిల్లా వారీ వార్తల కోసం హోమ్ పేజీలోని జిల్లాల విభాగం చూడవచ్చు.
          </p>

          <h2>మా ప్రమాణాలు</h2>
          <p>
            ప్రతి వార్తా కథనం మా <Link href="/editorial-standards">ఎడిటోరియల్ ప్రమాణాల</Link> ప్రకారం
            రాయబడుతుంది; తప్పు జరిగితే <Link href="/corrections-policy">సవరణల విధానం</Link> ప్రకారం
            బహిరంగంగా సరిదిద్దుతాము. మా <Link href="/ethics-policy">నైతిక నియమావళి</Link>,{" "}
            <Link href="/diversity-policy">వైవిధ్య విధానం</Link>, <Link href="/feedback-policy">అభిప్రాయాల విధానం</Link>{" "}
            కూడా బహిరంగంగా ప్రచురించి ఉన్నాయి. సంపాదకీయ నిర్ణయాలు తీసుకునే బృందం వివరాలు{" "}
            <Link href="/masthead">మాస్ట్‌హెడ్</Link> పేజీలో చూడవచ్చు.
          </p>

          <h2>Who we are</h2>
          <p>
            {brand} is a digital Telugu news publication covering the Rayalaseema region of Andhra
            Pradesh — Kurnool, Nandyal, Anantapur, Sri Sathya Sai, YSR Kadapa, Annamayya, Tirupati and
            Chittoor districts — with hyper-local reporting down to the mandal level. The publication
            is operated by {legal}. Details of ownership and funding are published on our{" "}
            <Link href="/ownership">ownership page</Link>, and the editorial team on the{" "}
            <Link href="/masthead">masthead</Link>.
          </p>

          <h2>Editorial independence</h2>
          <p>
            News coverage and editorial opinion are decided by the editorial team alone, under the
            published <Link href="/editorial-standards">editorial standards</Link>. Advertising is
            clearly labelled and has no influence on coverage. Errors are corrected openly under the{" "}
            <Link href="/corrections-policy">corrections policy</Link>.
          </p>

          <h2>సంప్రదించండి</h2>
          <p>
            వార్తా సూచనలు, సవరణలు, ఇతర సంప్రదింపుల కోసం{" "}
            <Link href="/contact">సంప్రదింపు పేజీ</Link> చూడండి. ఎడిటోరియల్ డెస్క్:{" "}
            <a href={`mailto:${config.editorial_email || "editor@rayalaseemanews.com"}`}>
              {config.editorial_email || "editor@rayalaseemanews.com"}
            </a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
