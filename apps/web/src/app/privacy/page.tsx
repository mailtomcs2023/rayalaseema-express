import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Rayalaseema News collects, uses and protects reader data - cookies, analytics, advertising partners and your rights under Indian data-protection law.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24, color: "#111" }}>Privacy Policy</h1>
        <div className="article-body" style={{ fontSize: 15, lineHeight: 1.8, color: "#333" }}>
          <p><strong>Last Updated:</strong> August 2026</p>

          <h2>1. Information We Collect</h2>
          <p>Rayalaseema News ("we", "our") collects the following information when you visit our website:</p>
          <ul>
            <li><strong>Usage Data:</strong> Pages visited, time spent, browser type, device information, IP address</li>
            <li><strong>Cookies:</strong> We use cookies and similar tracking technologies for analytics and advertising</li>
            <li><strong>Newsletter Subscriptions:</strong> Email address or WhatsApp number when you subscribe</li>
            <li><strong>Comments:</strong> Name and content when you post comments</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide and improve our news service</li>
            <li>To analyze website traffic and user behavior (Google Analytics)</li>
            <li>To display relevant advertisements (Google AdSense)</li>
            <li>To send breaking news alerts and newsletters</li>
          </ul>

          <h2>3. Cookies</h2>
          <p>We use cookies for:</p>
          <ul>
            <li><strong>Essential Cookies:</strong> Required for website functionality</li>
            <li><strong>Analytics Cookies:</strong> Google Analytics to understand how visitors use our site</li>
            <li><strong>Advertising Cookies:</strong> Google AdSense to display relevant ads</li>
          </ul>
          <p>You can control cookies through your browser settings.</p>

          <h2>4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul>
            <li>Google Analytics - for website analytics</li>
            <li>Google AdSense - for advertising</li>
            <li>OneSignal - for push notifications</li>
          </ul>

          <h2>5. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your personal data.</p>

          <h2>6. Your Rights (Digital Personal Data Protection Act, 2023)</h2>
          <p>As a Data Principal under India's Digital Personal Data Protection Act, 2023, you have the right to:</p>
          <ul>
            <li>Access a summary of the personal data we hold about you and how it is processed</li>
            <li>Request correction or erasure of your personal data</li>
            <li>Withdraw consent for processing at any time</li>
            <li>Nominate a person to exercise these rights on your behalf</li>
            <li>Opt-out of marketing communications and disable cookies through your browser</li>
          </ul>
          <p>Data requests are acknowledged within 72 hours and fulfilled within 30 days.</p>

          <h2>7. Grievance Officer</h2>
          <p>
            In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics
            Code) Rules, 2021, the Grievance Officer for this website can be reached at:
          </p>
          <p>Email: <a href="mailto:grievance@rayalaseemanews.com">grievance@rayalaseemanews.com</a><br />
          Complaints are acknowledged within 36 hours and resolved within 15 days, as the Rules require.</p>

          <h2>8. Contact Us</h2>
          <p>For privacy-related queries, contact us at: <a href="mailto:privacy@rayalaseemanews.com">privacy@rayalaseemanews.com</a></p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
