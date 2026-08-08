// Page Builder block: LatestNews - a card grid of the newest published
// articles (optionally scoped to a category). The grid auto-fits the available
// width, so it works full-bleed or inside a Columns block. Data comes from
// fetchLatestNews; this component is presentational.

import "@/styles/latest-news.css";
import Link from "next/link";
import { SmartImg } from "@/components/smart-img";

export interface LatestNewsArticle {
  id: string;
  title: string;
  href: string;
  featuredImage: string | null;
  categoryName: string | null;
  publishedAtIso: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ఇప్పుడే";
  if (m < 60) return `${m} నిమి. క్రితం`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} గం. క్రితం`;
  return `${Math.floor(h / 24)} రోజుల క్రితం`;
}

export function LatestNews({ articles }: { articles: LatestNewsArticle[] }) {
  if (!articles || articles.length === 0) return null;
  return (
    <div className="ln-block">
      <div className="ln-grid">
        {articles.map((a) => (
          <Link key={a.id} href={a.href} className="ln-card">
            <span className="ln-thumb">
              {a.featuredImage ? (
                <SmartImg src={a.featuredImage} width={256} alt={a.title} />
              ) : (
                <span className="ln-noimg">RN</span>
              )}
            </span>
            <span className="ln-body">
              <span className="ln-meta">
                {a.categoryName && <span className="ln-cat">{a.categoryName}</span>}
                {a.publishedAtIso && <span className="ln-time">{timeAgo(a.publishedAtIso)}</span>}
              </span>
              <span className="ln-title">{a.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
