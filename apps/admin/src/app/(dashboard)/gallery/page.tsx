import { Sidebar } from "@/components/sidebar";
import { CrudTable } from "@/components/crud-table";
import { prisma } from "@rayalaseema/db";

export default async function GalleryPage() {
  const data = await prisma.photoGallery.findMany({ include: { _count: { select: { photos: true } } }, orderBy: { createdAt: "desc" } });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CrudTable
          title="Photo Galleries"
          apiPath="galleries"
          data={JSON.parse(JSON.stringify(data))}
          columns={[
            { key: "title", label: "Title" },
            { key: "_count", label: "Photos", type: "count" },
            { key: "coverImage", label: "Cover", type: "link" },
            { key: "active", label: "Status", type: "boolean" },
          ]}
          fields={[
            { key: "title", label: "Title", type: "text", required: true },
            { key: "coverImage", label: "Cover Image URL", type: "url", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "active", label: "Active", type: "checkbox", placeholder: "Gallery is active" },
          ]}
        />
      </main>
    </div>
  );
}
