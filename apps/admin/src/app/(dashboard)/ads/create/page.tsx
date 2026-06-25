import { CreateAdClient } from "./create-ad-client";

export default function CreateAdPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <main style={{ marginLeft: 240, flex: 1, padding: 24 }}>
        <CreateAdClient />
      </main>
    </div>
  );
}
