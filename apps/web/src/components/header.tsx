"use client";

import { useState, useEffect } from "react";
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
  { name: "రాశి ఫలాలు", slug: "/horoscope" },
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

interface HeaderProps {
  config?: Record<string, string>;
  breakingNews?: { id: string; text: string }[];
}

export function Header({ config: initialConfig = {}, breakingNews: initialBreaking = [] }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [config, setConfig] = useState(initialConfig);
  const [breakingNews, setBreakingNews] = useState(initialBreaking);

  // Self-fetch if no data was passed (for pages that don't pass props)
  useEffect(() => {
    if (breakingNews.length === 0) {
      fetch("/api/breaking-news").then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setBreakingNews(data.map((b: any) => ({ id: b.id, text: b.headline || b.text })));
      }).catch(() => {});
    }
    if (Object.keys(config).length === 0) {
      fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
    }
  }, []);

  return (
    <header className="bg-white">
      {/* Breaking News Ticker */}
      <div style={{ background: "#000", overflow: "hidden", whiteSpace: "nowrap" as const }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ background: "var(--color-brand)", color: "#fff", padding: "6px 14px", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
            BREAKING
          </span>
          <div style={{ overflow: "hidden", flex: 1, padding: "6px 0" }}>
            <div className="animate-marquee" style={{ display: "inline-block", whiteSpace: "nowrap" as const, animationDuration: `${(config.ticker_speed || 30)}s` }}>
              {breakingNews.map((item, i) => (
                <span key={item.id || i}>
                  <a href="#" style={{ color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", marginLeft: 24, marginRight: 24 }}>
                    {item.text}
                  </a>
                  {i < breakingNews.length - 1 && <span style={{ color: "var(--color-brand)" }}>●</span>}
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
            <form action="/search" method="GET" className="flex items-center bg-white border border-gray-300 rounded-lg px-4 py-2 max-w-xl mx-auto">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                placeholder="వార్తలు వెతకండి... (Telugu or English)"
                className="flex-1 outline-none text-sm font-telugu"
                autoFocus
              />
              <button onClick={() => setSearchOpen(false)} type="button" className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
            </form>
          </div>
        </div>
      )}

      {/* Masthead - Eenadu style: Logo left, ad center, links right */}
      <div className="container-news">
        <div className="flex items-center py-2 gap-4">
          {/* Left: Logo + Date */}
          <div className="shrink-0 flex items-center gap-4">
            <Link href="/" className="block">
              <img
                src="/logo.svg"
                alt="రాయలసీమ ఎక్స్‌ప్రెస్"
                className="h-12 md:h-16 w-auto"
              />
            </Link>
            <div className="hidden md:block border-l border-gray-200 pl-4">
              <p className="text-sm font-bold text-gray-700 font-telugu">
                {new Date().toLocaleDateString("te-IN", { weekday: "long" })}
              </p>
              <p className="text-xs text-gray-500 font-telugu">
                {new Date().toLocaleDateString("te-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Center: spacer (desktop only) */}
          <div className="hidden lg:block flex-1" />

          {/* Right: Tabs + E-Paper (desktop) */}
          <div className="hidden lg:flex flex-col items-end gap-2 shrink-0">
            {/* Top row: Latest & Breaking tabs */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <Link href="/" className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200 transition-colors">
                <svg width="14" height="14" fill="none" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                తాజా వార్తలు
              </Link>
              <Link href="/search" className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200 transition-colors">
                <svg width="13" height="13" fill="none" stroke="#888" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                వెతకండి
              </Link>
              <Link href="/" className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--color-brand)] bg-red-50 hover:bg-red-100 transition-colors">
                <span className="w-2 h-2 bg-[var(--color-brand)] rounded-full animate-pulse" />
                బ్రేకింగ్
              </Link>
            </div>
            {/* Bottom row: E-Paper + Google News Follow */}
            <div className="flex gap-2">
              <Link href="/epaper" className="group flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg transition-all shadow-sm hover:shadow-md">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2"/></svg>
                <span className="text-xs font-black tracking-wide">E-PAPER</span>
              </Link>
              <a href="https://news.google.com/publications/CAAqBwgKMIGwlgswrOWEAw?hl=te&gl=IN&ceid=IN:te" target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.077 12c0-5.523-4.477-10-10-10S2.077 6.477 2.077 12s4.477 10 10 10 10-4.477 10-10z" fill="#4285F4"/><path d="M22.077 12c0-5.523-4.477-10-10-10" fill="#EA4335"/><path d="M2.077 12c0 5.523 4.477 10 10 10" fill="#34A853"/><path d="M2.077 12c0-5.523 4.477-10 10-10" fill="#FBBC05"/><path d="M12.077 7v10" stroke="#fff" strokeWidth="2"/><path d="M7.077 12h10" stroke="#fff" strokeWidth="2"/></svg>
                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">Follow</span>
              </a>
            </div>
          </div>

          {/* Mobile: hamburger */}
          <div className="lg:hidden ml-auto">
            <button
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
            <Link href="/search" className="flex-1 text-center bg-gray-800 text-white py-2.5 rounded-lg font-bold text-sm" onClick={() => setMobileMenuOpen(false)}>
              వెతకండి
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
