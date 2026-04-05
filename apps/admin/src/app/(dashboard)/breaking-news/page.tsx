import { Sidebar } from "@/components/sidebar";
import { getBreakingNewsList } from "@/lib/admin-queries";

export default async function BreakingNewsPage() {
  const items = await getBreakingNewsList();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>Breaking News</h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{items.length} items</p>
          </div>
          <button style={{ padding: "10px 20px", background: "#FF2C2C", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
            + Add Breaking News
          </button>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#FF2C2C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {item.priority}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{item.headline}</p>
                {item.url && <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Link: {item.url}</p>}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                background: item.active ? "#dcfce7" : "#fee2e2",
                color: item.active ? "#166534" : "#991b1b",
              }}>
                {item.active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
