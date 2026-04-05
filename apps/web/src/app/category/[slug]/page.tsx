import Link from "next/link";
import { Badge } from "@rayalaseema/ui";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DateBar } from "@/components/date-bar";
import { TrendingSidebar } from "@/components/trending-sidebar";
import {
  trendingArticles,
  politicsArticles,
  crimeArticles,
  sportsArticles,
  businessArticles,
  educationArticles,
  entertainmentArticles,
  agricultureArticles,
  districtArticles,
  nationalArticles,
} from "@/lib/mock-data";

const categoryMap: Record<string, { name: string; nameEn: string; color: string; articles: any[] }> = {
  politics: { name: "రాజకీయాలు", nameEn: "Politics", color: "#FF2C2C", articles: politicsArticles },
  crime: { name: "నేరాలు", nameEn: "Crime", color: "#7C3AED", articles: crimeArticles },
  sports: { name: "క్రీడలు", nameEn: "Sports", color: "#16A34A", articles: sportsArticles },
  business: { name: "వ్యాపారం", nameEn: "Business", color: "#2563EB", articles: businessArticles },
  education: { name: "విద్య", nameEn: "Education", color: "#0891B2", articles: educationArticles },
  entertainment: { name: "వినోదం", nameEn: "Entertainment", color: "#DB2777", articles: entertainmentArticles },
  agriculture: { name: "వ్యవసాయం", nameEn: "Agriculture", color: "#65A30D", articles: agricultureArticles },
  "district-news": { name: "జిల్లా వార్తలు", nameEn: "District News", color: "#EA580C", articles: districtArticles },
  national: { name: "జాతీయం", nameEn: "National", color: "#4F46E5", articles: nationalArticles },
};

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)} ని. క్రితం`;
  if (hours < 24) return `${hours} గంటల క్రితం`;
  return `${Math.floor(hours / 24)} రోజుల క్రితం`;
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = categoryMap[params.slug] || {
    name: "వార్తలు",
    nameEn: "News",
    color: "#FF2C2C",
    articles: politicsArticles,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <DateBar />

      {/* Category Header Banner */}
      <div className="border-b border-gray-200 bg-white">
        <div className="container-news py-6">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link href="/" className="hover:text-primary-500">హోమ్</Link>
            <span>/</span>
            <span className="text-gray-700 font-telugu">{cat.name}</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="w-2 h-10 rounded-full" style={{ backgroundColor: cat.color }} />
            <div>
              <h1 className="text-telugu-2xl font-bold text-gray-900 font-telugu">
                {cat.name}
              </h1>
              <p className="text-sm text-gray-400">{cat.nameEn}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container-news py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Articles */}
          <div className="lg:col-span-8">
            {/* Featured first article */}
            {cat.articles.length > 0 && (
              <Link href={`/article/${cat.articles[0].slug}`} className="group block mb-8">
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-4">
                  <img
                    src={cat.articles[0].featuredImage || ""}
                    alt={cat.articles[0].title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge color={cat.color}>{cat.name}</Badge>
                    <h2 className="text-telugu-2xl font-bold text-white mt-2 font-telugu drop-shadow-lg">
                      {cat.articles[0].title}
                    </h2>
                    <p className="text-white/80 font-telugu text-sm mt-2 line-clamp-2">
                      {cat.articles[0].summary}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of articles */}
            <div className="space-y-6">
              {cat.articles.slice(1).map((article: any) => (
                <Link
                  key={article.id}
                  href={`/article/${article.slug}`}
                  className="group flex gap-5 pb-6 border-b border-gray-100"
                >
                  <div className="w-48 h-32 shrink-0 rounded-xl overflow-hidden">
                    <img
                      src={article.featuredImage || ""}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1">
                    <Badge color={cat.color}>{cat.name}</Badge>
                    <h3 className="text-telugu-lg font-bold text-gray-900 font-telugu mt-1 group-hover:text-primary-500 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-telugu-sm text-gray-500 font-telugu mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{formatTimeAgo(article.publishedAt)}</span>
                      {article.viewCount && (
                        <>
                          <span>•</span>
                          <span>{article.viewCount.toLocaleString()} views</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 mt-10">
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-400 cursor-not-allowed">
                ← మునుపటి
              </button>
              <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium">
                1
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                2
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                3
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                తదుపరి →
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <TrendingSidebar articles={trendingArticles} />

            <div className="bg-gradient-to-b from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-2">ప్రకటన</p>
              <div className="bg-white rounded-lg p-8 shadow-inner">
                <p className="text-lg font-bold text-orange-600 font-telugu">మీ ప్రకటన ఇక్కడ</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
