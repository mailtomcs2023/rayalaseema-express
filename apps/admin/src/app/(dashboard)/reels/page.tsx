import { Sidebar } from "@/components/sidebar";
import { CrudTable } from "@/components/crud-table";
import { prisma } from "@rayalaseema/db";

export default async function ReelsPage() {
  const data = await prisma.reel.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CrudTable
          title="Reels"
          apiPath="reels"
          data={JSON.parse(JSON.stringify(data))}
          columns={[
            { key: "title", label: "Title" },
            { key: "views", label: "Views" },
            { key: "active", label: "Status", type: "boolean" },
          ]}
          fields={[
            { key: "title", label: "Title", type: "text", required: true },
            { key: "thumbnailUrl", label: "Thumbnail URL", type: "url", required: true },
            { key: "videoUrl", label: "Video URL", type: "url" },
            { key: "views", label: "Views (e.g. 2.5L)", type: "text", placeholder: "0" },
            { key: "active", label: "Active", type: "checkbox", placeholder: "Reel is active" },
          ]}
        />
      </main>
    </div>
  );
}
