"use client";

import { useState } from "react";
import Link from "next/link";

// Rayalaseema districts ARE the main nav - this is a Rayalaseema newspaper
const mainNavItems = [
  { name: "హోమ్", slug: "/", isHome: true },
  { name: "కర్నూలు", slug: "/district/kurnool" },
  { name: "నంద్యాల", slug: "/district/nandyal" },
  { name: "అనంతపురం", slug: "/district/ananthapuramu" },
  { name: "శ్రీ సత్యసాయి", slug: "/district/sri-sathya-sai" },
  { name: "వై.యస్.ఆర్", slug: "/district/ysr-kadapa" },
  { name: "తిరుపతి", slug: "/district/tirupati" },
  { name: "అన్నమయ్య", slug: "/district/annamayya" },
  { name: "చిత్తూరు", slug: "/district/chittoor" },
  { name: "క్రీడలు", slug: "/category/sports" },
  { name: "సినిమా", slug: "/category/entertainment" },
  { name: "రాశి ఫలాలు", slug: "/category/rasi-phalalu" },
  { name: "మరిన్ని ❯", slug: "#", isDropdown: true },
];

// These go in the "మరిన్ని" dropdown
const dropdownItems = [
  { name: "ఆంధ్రప్రదేశ్", slug: "/category/andhra-pradesh" },
  { name: "తెలంగాణ", slug: "/category/telangana" },
  { name: "జాతీయం", slug: "/category/national" },
  { name: "అంతర్జాతీయం", slug: "/category/international" },
  { name: "బిజినెస్", slug: "/category/business" },
  { name: "టెక్నాలజీ", slug: "/category/technology" },
  { name: "సినిమా రివ్యూలు", slug: "/category/movie-reviews" },
  { name: "పరీక్షా ఫలితాలు", slug: "/category/exam-results" },
  { name: "ఉద్యోగాలు", slug: "/category/jobs" },
  { name: "వ్యవసాయం", slug: "/category/agriculture" },
  { name: "విద్య", slug: "/category/education" },
  { name: "ఆరోగ్యం", slug: "/category/health" },
  { name: "భక్తి", slug: "/category/devotional" },
  { name: "నేరాలు", slug: "/category/crime" },
  { name: "నవ్యసీమ", slug: "/category/navyaseema" },
  { name: "NRI వార్తలు", slug: "/category/nri" },
  { name: "వాతావరణం", slug: "/category/weather" },
  { name: "రియల్ ఎస్టేట్", slug: "/category/real-estate" },
  { name: "ఫీచర్ పేజీలు", slug: "/category/features" },
  { name: "సంపాదకీయం", slug: "/category/editorial" },
  { name: "పాఠకుల లేఖలు", slug: "/category/reader-letters" },
  { name: "రాయలసీమ రుచులు", slug: "/category/rayalaseema-ruchulu" },
  { name: "ఎట్టెట 😄", slug: "/category/yetteta" },
  { name: "పజిల్స్", slug: "/category/puzzles" },
];

const breakingHeadlines = [
  "తుంగభద్ర డ్యామ్ నుండి 1 లక్ష క్యూసెక్కుల నీటి విడుదల - కర్నూలు, నంద్యాల జిల్లాల్లో అప్రమత్తం",
  "కడప స్టీల్ ప్లాంట్ ఏర్పాటుకు కేంద్ర కేబినెట్ ఆమోదం - రూ.12,000 కోట్ల పెట్టుబడి",
  "తిరుపతి బ్రహ్మోత్సవాలు ప్రారంభం - 10 లక్షల భక్తులు అంచనా, భారీ భద్రతా ఏర్పాట్లు",
  "అనంతపురం కియా EV ప్లాంట్ శంకుస్థాపన - 5,000 కొత్త ఉద్యోగాలు",
  "బనగానపల్లె మామిడికి GI ట్యాగ్ - అంతర్జాతీయ మార్కెట్లో ఎగుమతులు రెట్టింపు",
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="bg-white">
      {/* Breaking News Ticker */}
      <div style={{ background: "#000", overflow: "hidden", whiteSpace: "nowrap" as const }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ background: "var(--color-brand)", color: "#fff", padding: "6px 14px", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
            BREAKING
          </span>
          <div style={{ overflow: "hidden", flex: 1, padding: "6px 0" }}>
            <div className="animate-marquee" style={{ display: "inline-block", whiteSpace: "nowrap" as const }}>
              {breakingHeadlines.map((tag, i) => (
                <span key={i}>
                  <a href="#" style={{ color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", marginLeft: 24, marginRight: 24 }}>
                    {tag}
                  </a>
                  {i < breakingHeadlines.length - 1 && <span style={{ color: "var(--color-brand)" }}>●</span>}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{ padding: "6px 12px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Dropdown */}
      {searchOpen && (
        <div className="bg-gray-50 border-b border-gray-200 py-3">
          <div className="container-news">
            <div className="flex items-center bg-white border border-gray-300 rounded-lg px-4 py-2 max-w-xl mx-auto">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="వార్తలు వెతకండి..."
                className="flex-1 outline-none text-sm font-telugu"
                autoFocus
              />
              <button onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Masthead */}
      <div className="container-news">
        <div className="flex items-center justify-between py-3">
          {/* Left Ad */}
          <div className="hidden lg:block w-[160px] shrink-0">
            <div className="bg-gradient-to-b from-blue-900 to-blue-800 text-white rounded p-2 text-center">
              <p className="text-[9px] text-blue-200">Planning to prepare for</p>
              <p className="text-lg font-black text-yellow-400">IAS/IPS?</p>
              <p className="text-[9px] text-blue-200">Choose <span className="text-yellow-300 font-bold">La Excellence</span></p>
              <p className="text-[8px] text-blue-300 mt-1">📞 9052 29 29 29</p>
            </div>
          </div>

          {/* Center: Logo & Date */}
          <div className="flex-1 flex flex-col items-center">
            <Link href="/" className="block">
              <img
                src="/logo.svg"
                alt="రాయలసీమ ఎక్స్‌ప్రెస్ - Rayalaseema Express"
                className="h-16 md:h-20 w-auto"
              />
            </Link>
            <p className="text-xs text-gray-500 mt-1 font-telugu">
              {new Date().toLocaleDateString("te-IN", { weekday: "long" })},{" "}
              {new Date().toLocaleDateString("te-IN", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* Right: Ad + Quick Links */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="w-[300px] bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded p-2.5">
              <p className="text-sm font-bold text-amber-800">🏠 MY HOME UDYAN</p>
              <p className="text-xs text-amber-700">2, 2.5, 3 & 4 BHK Premium Homes</p>
              <p className="text-[10px] text-gray-500">at TELLAPUR | Starting ₹45 Lakhs*</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <a href="#" style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#555", textDecoration: "none", borderBottom: "2px solid #f59e0b" }}>
                  ⚡ Latest
                </a>
                <a href="#" style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#555", textDecoration: "none", borderBottom: "2px solid var(--color-brand)" }}>
                  🔴 Breaking
                </a>
              </div>
              <Link href="/epaper" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 16px", background: "var(--color-brand)", borderRadius: 4, fontSize: 12, fontWeight: 800, color: "#fff", textDecoration: "none", letterSpacing: "0.05em" }}>
                E-PAPER
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation Bar - Red Gradient with Districts as main items */}
      <nav className="nav-gradient shadow-md relative">
        <div className="container-news">
          <ul className="hidden lg:flex items-center">
            {mainNavItems.map((item, i) => (
              <li key={item.slug} className="relative">
                {item.isDropdown ? (
                  /* "మరిన్ని" dropdown trigger */
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                    className="block px-4 py-2.5 text-[13px] hover:bg-white/20 transition-colors whitespace-nowrap font-telugu fw-bold"
                    style={{ color: "#fff" }}
                  >
                    {item.name}
                  </button>
                ) : (
                  <Link
                    href={item.slug}
                    className={`block px-3 py-2.5 text-[13px] hover:bg-white/20 transition-colors whitespace-nowrap font-telugu border-r border-white/15 ${
                      i === 0 ? "bg-white/20" : ""
                    }`}
                    style={{ color: "#fff" }}
                  >
                    {(item as any).isHome ? (
                      <svg className="w-5 h-5" fill="#fff" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                      </svg>
                    ) : (
                      item.name
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Dropdown Menu - 2 column grid */}
        {dropdownOpen && (
          <div style={{
            position: "absolute", right: 8, top: "100%",
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "0 0 10px 10px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            zIndex: 50, width: 420, padding: "8px 0",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {dropdownItems.map((item) => (
                <Link
                  key={item.slug}
                  href={item.slug}
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: "block", padding: "8px 16px",
                    fontSize: 14, fontWeight: 700, color: "#333",
                    textDecoration: "none", borderBottom: "1px solid #f5f5f5",
                    transition: "all 0.15s",
                  }}
                  className="hover:bg-red-50 hover:text-[var(--color-brand)]"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg fixed inset-x-0 top-[120px] bottom-0 z-50 overflow-y-auto">
          {/* Mobile Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2.5">
              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="వార్తలు వెతకండి..." className="bg-transparent outline-none text-sm w-full font-telugu" />
            </div>
          </div>

          {/* District Section */}
          <div className="px-4 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#FF2C2C] font-bold mb-1">రాయలసీమ జిల్లాలు</p>
          </div>
          <ul>
            {mainNavItems.filter(i => !i.isDropdown && i.slug !== "/").map((item) => (
              <li key={item.slug} className="border-b border-gray-50">
                <Link
                  href={item.slug}
                  className="block px-5 py-3 text-sm font-semibold text-gray-700 hover:text-[#FF2C2C] hover:bg-red-50 font-telugu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          {/* Other Sections */}
          <div className="px-4 py-2 mt-2 bg-gray-50">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">ఇతర విభాగాలు</p>
          </div>
          <ul>
            {dropdownItems.map((item) => (
              <li key={item.slug} className="border-b border-gray-50">
                <Link
                  href={item.slug}
                  className="block px-5 py-2.5 text-sm text-gray-600 hover:text-[#FF2C2C] hover:bg-red-50 font-telugu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          <div className="p-4 flex gap-2">
            <Link href="/epaper" className="flex-1 text-center bg-[#FF2C2C] text-white py-2.5 rounded-lg font-bold text-sm" onClick={() => setMobileMenuOpen(false)}>
              E-PAPER
            </Link>
            <a href="#" className="flex-1 text-center bg-gray-800 text-white py-2.5 rounded-lg font-bold text-sm">
              APP
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
