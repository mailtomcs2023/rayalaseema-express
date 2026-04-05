"use client";

import { useRouter } from "next/navigation";

interface Constituency {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
}

export function ConstituencyFilter({ constituencies }: { constituencies: Constituency[] }) {
  const router = useRouter();

  return (
    <select
      onChange={(e) => {
        if (e.target.value) router.push(`/constituency/${e.target.value}`);
      }}
      style={{
        padding: "8px 14px", border: "2px solid var(--color-brand)", borderRadius: 8,
        fontSize: 14, fontWeight: 700, color: "#333", background: "#fff", cursor: "pointer",
        minWidth: 200,
      }}
    >
      <option value="">ఏ నియోజకవర్గం</option>
      {constituencies.map((c) => (
        <option key={c.id} value={c.slug}>{c.name} ({c.nameEn})</option>
      ))}
    </select>
  );
}
