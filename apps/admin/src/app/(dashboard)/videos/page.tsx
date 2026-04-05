import { Sidebar } from "@/components/sidebar";
import { CrudTable } from "@/components/crud-table";
import { prisma } from "@rayalaseema/db";

export default async function VideosPage() {
  const data = await prisma.video.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CrudTable
          title="Videos"
          apiPath="videos"
          data={JSON.parse(JSON.stringify(data))}
          columns={[
            { key: "title", label: "Title" },
            { key: "duration", label: "Duration" },
            { key: "views", label: "Views" },
            { key: "featured", label: "Featured", type: "boolean" },
            { key: "active", label: "Status", type: "boolean" },
          ]}
          fields={[
            { key: "title", label: "Title", type: "text", required: true, placeholder: "Video title" },
            { key: "thumbnailUrl", label: "Thumbnail URL", type: "url", required: true, placeholder: "https://..." },
            { key: "videoUrl", label: "Video URL (YouTube)", type: "url", placeholder: "https://youtube.com/watch?v=..." },
            { key: "duration", label: "Duration", type: "text", placeholder: "12:45" },
            { key: "description", label: "Description", type: "textarea" },
            { key: "featured", label: "Featured", type: "checkbox", placeholder: "Show as featured video" },
            { key: "active", label: "Active", type: "checkbox", placeholder: "Video is active" },
          ]}
        />
      </main>
    </div>
  );
}
