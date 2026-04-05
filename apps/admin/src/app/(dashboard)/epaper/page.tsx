import { Sidebar } from "@/components/sidebar";

export default function EpaperPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111", marginBottom: 8 }}>ePaper Management</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Upload and manage daily print edition PDFs</p>
        <div style={{ background: "#fff", borderRadius: 10, padding: 40, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📰</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>ePaper Upload Coming Soon</h3>
          <p style={{ fontSize: 14, color: "#888", marginTop: 8 }}>PDF upload, page extraction, and flip-book viewer will be available in the next update.</p>
        </div>
      </main>
    </div>
  );
}
