import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { getAllArticles } from "@/lib/admin-queries";

export default async function ArticlesPage() {
  const { articles, total } = await getAllArticles();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>Articles</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{total} total articles</p>
          </div>
          <Link
            href="/articles/new"
            style={{ padding: "10px 20px", background: "#FF2C2C", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
          >
            + New Article
          </Link>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Title</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Category</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Author</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Views</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, color: "#888", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "12px 20px", maxWidth: 350 }}>
                    <Link href={`/articles/${article.id}`} style={{ fontSize: 13, fontWeight: 600, color: "#111", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {article.title}
                    </Link>
                    <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{article.slug}</span>
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: article.category.color || "#888", padding: "2px 8px", borderRadius: 4 }}>
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
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#888" }}>
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : "-"}
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    <Link href={`/articles/${article.id}`} style={{ padding: "4px 10px", background: "#eff6ff", color: "#2563eb", borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: "none", marginRight: 6 }}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
