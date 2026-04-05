import Link from "next/link";
import { Badge } from "@rayalaseema/ui";

interface Article {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: { name: string; color: string; slug: string };
  featuredImage: string | null;
  publishedAt: string;
  author: { name: string };
}

interface HeroProps {
  featured: Article & { viewCount?: number };
  secondary: Article[];
}

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)} ని. క్రితం`;
  if (hours < 24) return `${hours} గంటల క్రితం`;
  return `${Math.floor(hours / 24)} రోజుల క్రితం`;
}

export function HeroSection({ featured, secondary }: HeroProps) {
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="container-news py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Featured Article */}
          <div className="lg:col-span-7">
            <Link href={`/article/${featured.slug}`} className="group block">
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-4">
                <img
                  src={featured.featuredImage || ""}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <Badge color={featured.category.color}>
                    {featured.category.name}
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-telugu-2xl font-bold text-white mb-2 font-telugu leading-snug drop-shadow-lg">
                    {featured.title}
                  </h2>
                  <p className="text-white/80 font-telugu text-telugu-sm line-clamp-2 drop-shadow">
                    {featured.summary}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-sm text-white/60">
                    <span>{featured.author.name}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(featured.publishedAt)}</span>
                    {featured.viewCount && (
                      <>
                        <span>•</span>
                        <span>{featured.viewCount.toLocaleString("te-IN")} views</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Secondary Featured */}
          <div className="lg:col-span-5 space-y-4">
            {secondary.map((article) => (
              <Link
                key={article.id}
                href={`/article/${article.slug}`}
                className="group flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-32 h-24 shrink-0 rounded-lg overflow-hidden">
                  <img
                    src={article.featuredImage || ""}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge color={article.category.color}>
                    {article.category.name}
                  </Badge>
                  <h3 className="text-telugu-base font-semibold text-gray-900 font-telugu line-clamp-2 mt-1 group-hover:text-primary-500 transition-colors">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <span>{article.author.name}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(article.publishedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Quick Headlines Box */}
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <h3 className="text-sm font-bold text-primary-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                ఇప్పుడే వచ్చిన వార్తలు
              </h3>
              <ul className="space-y-2.5">
                {[
                  "పెట్రోల్, డీజిల్ ధరల్లో తగ్గుదల - లీటర్‌కు రూ.2 తక్కువ",
                  "కర్నూలు-హైదరాబాద్ బుల్లెట్ ట్రైన్ ప్రతిపాదన",
                  "ఏపీ సచివాలయంలో కీలక భేటీ - మంత్రుల హాజరు",
                  "రాయలసీమ యూనివర్సిటీకి NAAC A++ గ్రేడ్",
                ].map((headline, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary-400 text-xs mt-1.5">▸</span>
                    <a
                      href="#"
                      className="text-sm font-telugu text-gray-700 hover:text-primary-500 transition-colors leading-relaxed"
                    >
                      {headline}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
