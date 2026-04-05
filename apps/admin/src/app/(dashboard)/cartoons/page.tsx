import { Sidebar } from "@/components/sidebar";
import { CrudTable } from "@/components/crud-table";
import { prisma } from "@rayalaseema/db";

export default async function CartoonsPage() {
  const data = await prisma.cartoon.findMany({ orderBy: { date: "desc" } });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CrudTable
          title="Cartoons (Yetteta)"
          apiPath="cartoons"
          data={JSON.parse(JSON.stringify(data))}
          columns={[
            { key: "title", label: "Title" },
            { key: "caption", label: "Caption" },
            { key: "date", label: "Date", type: "date" },
            { key: "active", label: "Status", type: "boolean" },
          ]}
          fields={[
            { key: "title", label: "Title", type: "text", required: true },
            { key: "caption", label: "Caption", type: "textarea", required: true },
            { key: "imageUrl", label: "Image URL", type: "url", required: true },
            { key: "date", label: "Date", type: "date", required: true },
            { key: "active", label: "Active", type: "checkbox", placeholder: "Cartoon is active" },
          ]}
        />
      </main>
    </div>
  );
}
