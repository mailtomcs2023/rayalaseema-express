import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { prisma } from "@rayalaseema/db";
import { ConstituencyFilter } from "./filter";

export default async function DistrictPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Get district with constituencies
  const district = await prisma.district.findUnique({
    where: { slug },
    include: {
      constituencies: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { mandals: true } } },
      },
    },
  });

  if (!district) return notFound();

  // Get articles from this district's constituencies
  const constituencyIds = district.constituencies.map((c) => c.id);
  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { constituencyId: { in: constituencyIds } },
        // Also show articles from this district's category
        { category: { slug: slug } },
      ],
    },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      author: { select: { name: true } },
      constituency: { select: { nameEn: true, name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  // Also get general articles if no constituency-tagged articles yet
  let allArticles = articles;
  if (articles.length < 5) {
    const generalArticles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
        constituency: { select: { nameEn: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });
    allArticles = generalArticles;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* District Header - like Eenadu */}
      <div style={{ background: "#fff", borderBottom: "3px solid var(--color-brand)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--color-brand)" }}>{district.name}</h1>
              <p style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
                {district.nameEn} District | {district.constituencies.length} Constituencies | {district.loksabhaSeats} Lok Sabha
              </p>
            </div>
            {/* Constituency dropdown filter */}
            <ConstituencyFilter
              constituencies={district.constituencies.map((c) => ({
                id: c.id,
                name: c.name,
                nameEn: c.nameEn,
                slug: c.slug,
              }))}
            />
          </div>

          {/* Constituency pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {district.constituencies.map((c) => (
              <Link
                key={c.id}
                href={`/constituency/${c.slug}`}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                  background: "#f3f4f6", color: "#333", textDecoration: "none",
                  border: "1px solid #e5e7eb", transition: "all 0.15s",
                }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 12px" }}>
        <div style={{ display: "flex", gap: 20 }}>
          {/* Articles Grid - Eenadu style with location pins */}
          <div style={{ flex: 1 }}>
            {/* Top 3 featured */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              {allArticles.slice(0, 3).map((article) => (
                <Link key={article.id} href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                    {article.featuredImage && (
                      <img src={article.featuredImage} alt="" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover" }} />
                    )}
                    <div style={{ padding: 12 }}>
                      {/* Location pin */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                        <svg width="12" height="12" fill="var(--color-brand)" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-brand)" }}>
                          {article.constituency?.name || district.name}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#000", lineHeight: 1.5 }}>
                        {article.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Article list with location pins */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {allArticles.slice(3).map((article) => (
                <Link key={article.id} href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "flex", gap: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #f3f4f6" }}>
                  {article.featuredImage && (
                    <img src={article.featuredImage} alt="" style={{ width: 90, height: 65, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                      <svg width="10" height="10" fill="var(--color-brand)" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-brand)" }}>
                        {article.constituency?.nameEn || district.nameEn}
                      </span>
                    </div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "#111", lineHeight: 1.45 }}>
                      {article.title.substring(0, 60)}...
                    </h4>
                    <span style={{ fontSize: 10, color: "#aaa" }}>
                      {article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString("te-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ width: 300, flexShrink: 0 }}>
            {/* Ad */}
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #eee", padding: 16, textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: "#aaa" }}>Advertisement</p>
              <div style={{ height: 250, background: "#f9f9f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}>
                Ad Space
              </div>
            </div>

            {/* Constituencies list */}
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #eee", padding: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#000", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--color-brand)" }}>
                నియోజకవర్గాలు
              </h3>
              {district.constituencies.map((c) => (
                <Link key={c.id} href={`/constituency/${c.slug}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none", fontSize: 14, fontWeight: 700, color: "#333" }}>
                  <span>{c.name}</span>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{c._count.mandals} mandals</span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
