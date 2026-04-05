import { Sidebar } from "@/components/sidebar";
import { CrudTable } from "@/components/crud-table";
import { prisma } from "@rayalaseema/db";

export default async function BreakingNewsPage() {
  const data = await prisma.breakingNews.findMany({ orderBy: { priority: "asc" } });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CrudTable
          title="Breaking News"
          apiPath="breaking-news"
          data={JSON.parse(JSON.stringify(data))}
          columns={[
            { key: "priority", label: "Priority" },
            { key: "headline", label: "Headline" },
            { key: "url", label: "Link", type: "link" },
            { key: "active", label: "Status", type: "boolean" },
          ]}
          fields={[
            { key: "headline", label: "Headline (Telugu)", type: "text", required: true, placeholder: "Breaking news headline" },
            { key: "headlineEn", label: "Headline (English)", type: "text" },
            { key: "url", label: "Link URL", type: "url", placeholder: "Link to full article" },
            { key: "priority", label: "Priority (1 = highest)", type: "number" },
            { key: "active", label: "Active", type: "checkbox", placeholder: "Show in ticker" },
          ]}
        />
      </main>
    </div>
  );
}
