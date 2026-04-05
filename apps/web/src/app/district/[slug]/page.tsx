import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const districtNames: Record<string, string> = {
  kurnool: "కర్నూలు",
  nandyal: "నంద్యాల",
  anantapur: "అనంతపురం",
  "sri-sathya-sai": "శ్రీ సత్యసాయి",
  ysr: "వై.యస్.ఆర్",
  tirupati: "తిరుపతి",
  annamayya: "అన్నమయ్య",
  chittoor: "చిత్తూరు",
};

export default function DistrictPage({ params }: { params: { slug: string } }) {
  const name = districtNames[params.slug] || params.slug;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 12px" }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: 32, textAlign: "center", border: "1px solid #eee" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--color-brand)", marginBottom: 12 }}>
            {name} వార్తలు
          </h1>
          <p style={{ fontSize: 16, color: "#666", marginBottom: 24 }}>
            {name} జిల్లా తాజా వార్తలు, రాజకీయాలు, నేరాలు, క్రీడలు మరియు మరిన్ని.
          </p>
          <p style={{ fontSize: 14, color: "#999" }}>
            త్వరలో అందుబాటులోకి వస్తుంది...
          </p>
          <Link href="/" style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", background: "var(--color-brand)", color: "#fff", borderRadius: 6, fontWeight: 700, textDecoration: "none" }}>
            హోమ్ పేజీకి వెళ్ళండి
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
