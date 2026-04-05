import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { getDashboardStats } from "@/lib/admin-queries";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    { label: "Published", value: stats.publishedArticles, color: "#16a34a", href: "/articles" },
    { label: "Drafts", value: stats.draftArticles, color: "#eab308", href: "/articles" },
    { label: "In Review", value: stats.inReviewArticles, color: "#3b82f6", href: "/articles" },
    { label: "Categories", value: stats.totalCategories, color: "#8b5cf6", href: "/categories" },
    { label: "Breaking News", value: stats.breakingNewsCount, color: "#ef4444", href: "/breaking-news" },
    { label: "Videos", value: stats.totalVideos, color: "#ec4899", href: "/videos" },
    { label: "Web Stories", value: stats.totalStories, color: "#f59e0b", href: "/stories" },
    { label: "Reels", value: stats.totalReels, color: "#14b8a6", href: "/reels" },
    { label: "Cartoons", value: stats.totalCartoons, color: "#6366f1", href: "/cartoons" },
    { label: "Active Ads", value: stats.totalAds, color: "#64748b", href: "/ads" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Welcome to Rayalaseema Express CMS</p>
          </div>
          <Link
            href="/articles/new"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "#FF2C2C", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            + New Article
          </Link>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {statCards.map((s) => (
            <Link key={s.label} href={s.href} style={{ background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textDecoration: "none", borderLeft: `4px solid ${s.color}` }}>
              <p style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#111", marginTop: 4 }}>{s.value}</p>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "New Article", href: "/articles/new", icon: "+" },
            { label: "Breaking News", href: "/breaking-news", icon: "!" },
            { label: "Upload ePaper", href: "/epaper", icon: "^" },
            { label: "Add Category", href: "/categories", icon: "#" },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textDecoration: "none", textAlign: "center" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>{a.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent Articles */}
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Recent Articles</h2>
            <Link href="/articles" style={{ fontSize: 13, color: "#FF2C2C", fontWeight: 600, textDecoration: "none" }}>View All</Link>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Title</th>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Category</th>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Author</th>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Views</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentArticles.map((article) => (
                <tr key={article.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#111", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link href={`/articles/${article.id}`} style={{ color: "#111", textDecoration: "none" }}>
                      {article.title.substring(0, 50)}...
                    </Link>
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#FF2C2C", padding: "2px 8px", borderRadius: 4 }}>
                      {article.category.nameEn}
                    </span>
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#888" }}>{article.author.name}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      background: article.status === "PUBLISHED" ? "#dcfce7" : article.status === "DRAFT" ? "#fef3c7" : "#dbeafe",
                      color: article.status === "PUBLISHED" ? "#166534" : article.status === "DRAFT" ? "#92400e" : "#1e40af",
                    }}>
                      {article.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#888" }}>{article.viewCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
