import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { NewsSlider } from "@/components/news-slider";
import { LatestNewsSidebar } from "@/components/latest-news-sidebar";
import { NewsGrid } from "@/components/news-grid";
import { VideoWidget } from "@/components/video-widget";
import { PhotoGallery } from "@/components/photo-gallery";
import {
  AdSidebarSquare,
  AdBannerMid,
  AdInFeedBanner,
  AdLeaderboard,
} from "@/components/ad-slots";
import { MovieGallery, TrendingReels } from "@/components/movie-gallery";
import { YettetaCartoon } from "@/components/yetteta-cartoon";
import { WebStories } from "@/components/web-stories";
import { getFullHomepageData } from "@/lib/db-queries";

export default async function HomePage() {
  // Fetch ALL data from PostgreSQL - articles, videos, galleries, reels, stories, cartoons, ads
  const { featured, latest, breakingNews, articlesByCategory, videos, galleries, webStories, reels, cartoons, ads } = await getFullHomepageData();

  // Map DB articles to slider format
  const sliderItems = featured.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary || "",
    slug: a.slug,
    category: { name: a.category.name, color: a.category.color || "#FF2C2C", slug: a.category.slug },
    featuredImage: a.featuredImage || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&h=700&fit=crop",
    publishedAt: a.publishedAt?.toISOString() || new Date().toISOString(),
    author: { name: a.author.name },
  }));

  // Map DB articles to news grid format (take first 8)
  const allDbArticles = Object.values(articlesByCategory).flat();
  const newsGridItems = allDbArticles.slice(0, 8).map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    summary: a.summary || "",
    featuredImage: a.featuredImage,
    label: a.category.name,
  }));

  // Map DB articles to latest news sidebar
  const latestNewsItems = latest.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
  }));

  // Helper to get articles for a category (from DB or empty)
  const catArticles = (slug: string) =>
    (articlesByCategory[slug] || []).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary || "",
      featuredImage: a.featuredImage,
      publishedAt: a.publishedAt?.toISOString() || new Date().toISOString(),
      viewCount: a.viewCount,
    }));

  // Map DB videos to component format
  const videoItems = videos.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnail: v.thumbnailUrl,
    duration: v.duration || "",
    views: v.views,
  }));

  // Map DB galleries to component format
  const photoGalleryItems = galleries.map((g) => ({
    id: g.id,
    title: g.title,
    image: g.coverImage,
    count: g._count.photos,
  }));
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "2px 8px 0" }}>
        {/* ===== SECTION 1: Slider + తాజా వార్తలు ===== */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {/* Left: Slider + News Grid */}
          <div className="panel" style={{ flex: "0 0 63%", overflow: "hidden" }}>
            <NewsSlider items={sliderItems} />
            <AdBannerMid />
            <NewsGrid items={newsGridItems} />
          </div>
          {/* Right: Latest News sidebar */}
          <div className="panel" style={{ flex: "1 1 auto", overflow: "hidden" }}>
            <LatestNewsSidebar items={latestNewsItems} />
            <AdSidebarSquare />
          </div>
        </div>

        {/* ===== SECTION 2: Video + Movies + Reels ===== */}
        <div style={{ display: "flex", marginTop: 4, gap: 4, alignItems: "stretch" }}>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <VideoWidget videos={videoItems} />
          </div>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <MovieGallery items={webStories.slice(0, 6).map((s) => ({ id: s.id, title: s.title, image: s.imageUrl, tag: s.category || "", tagColor: "#DB2777", subtitle: s.category || "" }))} />
          </div>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <TrendingReels items={reels.map((r) => ({ id: r.id, title: r.title, image: r.thumbnailUrl, views: r.views }))} />
          </div>
        </div>

        {/* ===== BELOW FOLD: 3-col cards + right strip (like Eenadu) ===== */}
        <div style={{ display: "flex", marginTop: 4, gap: 4 }}>
          {/* LEFT: 3-column category grid */}
          <div style={{ flex: "1 1 auto" }} className="space-y-2">

            {/* Row 1: Entertainment | Business | Sports - from DB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CategoryCard title="\u0C38\u0C3F\u0C28\u0C3F\u0C2E\u0C3E" slug="entertainment" articles={catArticles("entertainment")} />
              <CategoryCard title="\u0C2C\u0C3F\u0C1C\u0C3F\u0C28\u0C46\u0C38\u0C4D" slug="business" articles={catArticles("business")} />
              <CategoryCard title="\u0C15\u0C4D\u0C30\u0C40\u0C21\u0C32\u0C41" slug="sports" articles={catArticles("sports")} />
            </div>

            {/* Row 2: National | District News | Agriculture - from DB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CategoryCard title="\u0C1C\u0C3E\u0C24\u0C40\u0C2F\u0C02" slug="national" articles={catArticles("national")} />
              <CategoryCard title="\u0C1C\u0C3F\u0C32\u0C4D\u0C32\u0C3E \u0C35\u0C3E\u0C30\u0C4D\u0C24\u0C32\u0C41" slug="district-news" articles={catArticles("district-news")} />
              <CategoryCard title="\u0C35\u0C4D\u0C2F\u0C35\u0C38\u0C3E\u0C2F\u0C02" slug="agriculture" articles={catArticles("agriculture")} />
            </div>

            {/* Banner Ad */}
            <AdLeaderboard />

            {/* Row 3: Education | Crime | Devotional - from DB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CategoryCard title="\u0C35\u0C3F\u0C26\u0C4D\u0C2F" slug="education" articles={catArticles("education")} />
              <CategoryCard title="\u0C28\u0C47\u0C30\u0C3E\u0C32\u0C41" slug="crime" articles={catArticles("crime")} />
              <CategoryCard title="\u0C30\u0C3E\u0C1C\u0C15\u0C40\u0C2F\u0C3E\u0C32\u0C41" slug="politics" articles={catArticles("politics")} />
            </div>

            {/* Web Stories */}
            <WebStories items={webStories.map((s) => ({ id: s.id, title: s.title, image: s.imageUrl, category: s.category || "" }))} />

            {/* Photo Gallery */}
            <PhotoGallery photos={photoGalleryItems} />

            <AdInFeedBanner />

          </div>

          {/* RIGHT: ఎట్టెట Cartoon column */}
          <div style={{ flex: "0 0 180px" }} className="hidden lg:block">
            <YettetaCartoon items={cartoons.map((c) => ({ id: c.id, title: c.title, caption: c.caption, image: c.imageUrl, date: c.date.toLocaleDateString("te-IN", { month: "long", day: "numeric" }) }))} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ---- Category Card (uniform red header like Eenadu's blue) ---- */
function CategoryCard({
  title,
  slug,
  articles,
}: {
  title: string;
  slug: string;
  articles: any[];
}) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="category-card">
      {/* Header - inline tab (uses CSS var) */}
      <div style={{ padding: "8px 8px 0" }}>
        <a href={`/category/${slug}`} className="section-tab" style={{ textDecoration: "none" }}>
          <span className="section-tab-text">{title}</span>
          <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Image */}
      <div style={{ padding: "8px 8px 0" }}>
        <a href={`/article/${articles[0].slug}`} className="block group">
          <div style={{ overflow: "hidden", borderRadius: 2 }}>
            {articles[0].featuredImage ? (
              <img
                src={articles[0].featuredImage}
                alt={articles[0].title}
                className="group-hover:scale-105 transition-transform duration-300"
                style={{ display: "block", width: "100%", aspectRatio: "16/10", objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div style={{ aspectRatio: "16/10", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#9ca3af", fontSize: 24 }}>RE</span>
              </div>
            )}
          </div>
        </a>
      </div>

      {/* Featured title - uses CSS class */}
      <div style={{ padding: "6px 10px 4px" }}>
        <a href={`/article/${articles[0].slug}`} className="group">
          <h4 className="news-headline-featured line-clamp-2 hover-brand" style={{ margin: 0 }}>
            {articles[0].title}
          </h4>
        </a>
      </div>

      {/* Bullet Headlines - uses CSS classes */}
      <div style={{ padding: "4px 10px 14px" }}>
        {articles.slice(1, 4).map((article: any) => (
          <div key={article.id} style={{ marginBottom: 8 }}>
            <a
              href={`/article/${article.slug}`}
              className="group"
              style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
            >
              <span className="news-bullet-dot" style={{ marginTop: 8 }} />
              <span className="news-headline-bullet hover-brand line-clamp-2">
                {article.title}
              </span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
