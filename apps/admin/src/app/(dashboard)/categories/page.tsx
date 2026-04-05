import { Sidebar } from "@/components/sidebar";
import { getAllCategories } from "@/lib/admin-queries";
import { CategoryActions } from "./actions";

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>Categories</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{categories.length} categories</p>
          </div>
          <CategoryActions />
        </div>

        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Order</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Name (Telugu)</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Name (English)</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Slug</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Color</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Articles</th>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#888" }}>{cat.sortOrder}</td>
                  <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#111" }}>{cat.name}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#555" }}>{cat.nameEn}</td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#888", fontFamily: "monospace" }}>{cat.slug}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: cat.color || "#ccc" }} />
                      <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{cat.color}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#111" }}>{cat._count.articles}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      background: cat.active ? "#dcfce7" : "#fee2e2",
                      color: cat.active ? "#166534" : "#991b1b",
                    }}>
                      {cat.active ? "Active" : "Inactive"}
                    </span>
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
