import Link from "next/link";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
}

export function LatestNewsSidebar({ items }: { items: NewsItem[] }) {
  return (
    <div className="bg-white">
      {/* Header */}
      <div style={{ textAlign: "center", padding: "10px 0", borderBottom: "2px solid var(--color-brand)" }}>
        <h3 style={{ fontSize: "var(--fs-headline-lg)", fontWeight: "var(--fw-black)" as any, color: "var(--color-brand)" }}>
          — తాజా వార్తలు —
        </h3>
      </div>

      {/* News List */}
      <div style={{ padding: 12 }}>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((item) => (
            <li key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <Link
                href={`/article/${item.slug}`}
                className="group hover-brand"
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0" }}
              >
                <span className="news-bullet-dot" style={{ marginTop: 8 }} />
                <span className="news-headline-bullet group-hover:text-[var(--color-brand)]" style={{ transition: "color 0.15s" }}>
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
