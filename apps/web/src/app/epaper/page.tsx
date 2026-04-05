import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DateBar } from "@/components/date-bar";

const editions = [
  {
    date: "2026-04-04",
    title: "ఏప్రిల్ 4, 2026",
    section: "ప్రధాన సంచిక",
    pages: 16,
  },
  {
    date: "2026-04-03",
    title: "ఏప్రిల్ 3, 2026",
    section: "ప్రధాన సంచిక",
    pages: 16,
  },
  {
    date: "2026-04-02",
    title: "ఏప్రిల్ 2, 2026",
    section: "ప్రధాన సంచిక",
    pages: 16,
  },
  {
    date: "2026-04-01",
    title: "ఏప్రిల్ 1, 2026",
    section: "ప్రధాన సంచిక",
    pages: 16,
  },
];

export default function EpaperPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <DateBar />

      <main className="container-news py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-10 rounded-full bg-primary-500" />
          <div>
            <h1 className="text-telugu-2xl font-bold text-gray-900 font-telugu">
              ePaper - డిజిటల్ ఎడిషన్
            </h1>
            <p className="text-sm text-gray-500">
              రాయలసీమ ఎక్స్‌ప్రెస్ ప్రింట్ ఎడిషన్ ఆన్‌లైన్‌లో చదవండి
            </p>
          </div>
        </div>

        {/* Today's Edition - Large */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-12 flex flex-col items-center justify-center">
              <div className="bg-primary-500 text-white rounded-2xl p-8 mb-6 shadow-lg">
                <span className="font-bold text-6xl">RE</span>
              </div>
              <h2 className="text-telugu-xl font-bold text-primary-500 font-telugu">
                రాయలసీమ ఎక్స్‌ప్రెస్
              </h2>
              <p className="text-gray-500 mt-1">Rayalaseema Express</p>
              <p className="text-telugu-lg font-semibold text-gray-700 mt-4 font-telugu">
                {new Date().toLocaleDateString("te-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-sm text-gray-400 mt-1">16 పేజీలు | ప్రధాన సంచిక</p>
            </div>
            <div className="p-8 flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">నేటి సంచిక</h3>
              <p className="text-gray-500 mb-6">
                ప్రింట్ ఎడిషన్ యొక్క అన్ని పేజీలు ఆన్‌లైన్‌లో చదవండి.
                జూమ్, పేజీ నావిగేషన్, డౌన్‌లోడ్ సదుపాయాలు అందుబాటులో ఉన్నాయి.
              </p>
              <div className="flex gap-3">
                <button className="bg-primary-500 text-white px-8 py-3 rounded-xl font-medium hover:bg-primary-600 transition-colors text-lg">
                  ePaper చదవండి
                </button>
                <button className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  PDF డౌన్‌లోడ్
                </button>
              </div>
              <div className="flex gap-6 mt-6 text-sm text-gray-400">
                <span>ప్రధాన సంచిక</span>
                <span>|</span>
                <span>జిల్లా సంచిక</span>
                <span>|</span>
                <span>సప్లిమెంట్</span>
              </div>
            </div>
          </div>
        </div>

        {/* Past Editions Grid */}
        <h3 className="text-telugu-xl font-bold text-gray-900 mb-5 font-telugu border-b-2 border-gray-200 pb-3">
          గత సంచికలు
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {editions.map((edition) => (
            <a
              key={edition.date}
              href="#"
              className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 flex flex-col items-center">
                <div className="bg-primary-500 text-white rounded-lg p-3 mb-3 group-hover:scale-110 transition-transform">
                  <span className="font-bold text-xl">RE</span>
                </div>
                <p className="text-sm font-bold text-primary-500 font-telugu">
                  రాయలసీమ ఎక్స్‌ప్రెస్
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="font-semibold text-gray-800 font-telugu">
                  {edition.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {edition.section} • {edition.pages} పేజీలు
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Calendar Browse */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500 font-telugu">
            📅 క్యాలెండర్ ద్వారా గత సంచికలు బ్రౌజ్ చేయడం త్వరలో అందుబాటులోకి వస్తుంది
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
