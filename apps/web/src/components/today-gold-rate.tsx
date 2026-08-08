// "Today's Gold Rate" card - Andhra Pradesh rates from Lalithaa Jewellery's
// API (see lib/lalithaa-rates.ts). Server component: rates are in the SSR
// HTML (no flash), refreshed via the source's 30-min cache. Renders nothing
// if the source is unreachable, so it never shows a broken/empty card.

import "@/styles/today-gold-rate.css";
import { getApGoldRates, formatRateTimestamp } from "@/lib/lalithaa-rates";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export async function TodayGoldRate() {
  const r = await getApGoldRates();
  if (!r) return null;

  const rows = [
    { label: "Gold (22KT / 1g)", value: r.goldPerGram },
    { label: "Silver (1g)", value: r.silverPerGram },
    { label: "Platinum (1g)", value: r.platinumPerGram },
  ];

  return (
    <section className="tgr" aria-label="Today's Gold Rate">
      <h2 className="tgr-title">Today&apos;s Gold Rate</h2>
      <dl className="tgr-list">
        {rows.map((row) => (
          <div key={row.label} className="tgr-row">
            <dt className="tgr-label">{row.label}</dt>
            <dd className="tgr-value">{inr(row.value)}</dd>
          </div>
        ))}
      </dl>
      {r.updatedAt && (
        <p className="tgr-updated">Last updated: {formatRateTimestamp(r.updatedAt)}</p>
      )}
    </section>
  );
}
