// Pure presentational view for the live-data strip. No hooks, no state -
// renders the supplied data into the dark bar that sits under BREAKING.
// Used by:
//   - MarketTickerServer (server-side fetch + render, zero flash on first paint)
//   - MarketTicker (legacy client-side fetch, fallback for pages not yet migrated)
import "@/styles/market-ticker-view.css";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface CricketMatch {
  id: string;
  name: string;
  status: string;
  isLive?: boolean;
  score?: { team: string; runs: number; wickets: number; overs: number }[];
}

export interface TickerData {
  mandi: { commodity: string; market: string; price: number; unit: string; change: number }[];
  bullion: { name: string; nameEn: string; price: number; unit: string; change: number }[];
  forex: { name: string; price: number; icon: string }[];
  cricket: CricketMatch[] | null;
}

function renderCricketLine(m: CricketMatch) {
  const scoreLine = (m.score ?? [])
    .map((s) => `${s.team} ${s.runs}/${s.wickets}${s.overs ? ` (${s.overs})` : ""}`)
    .join(" v ");
  return scoreLine || m.name;
}

export function MarketTickerView({ data }: { data: TickerData | null }) {
  // Always render the bar so the page reserves this strip's
  // height even before data arrives. The client <MarketTicker> fetches in a
  // useEffect (~300ms after hydration); returning null until then made the bar
  // pop in and shove the page down (layout shift) on every non-home page.
  // While loading/empty we render an invisible placeholder row sized like the
  // populated bar, so the data fills in with no jump.
  const cricketMatches = data && Array.isArray(data.cricket) ? data.cricket : [];
  const hasAny =
    !!data &&
    (data.mandi.length > 0 ||
      data.bullion.length > 0 ||
      data.forex.length > 0 ||
      cricketMatches.length > 0);

  return (
    <div className="market-ticker-bar" aria-hidden={hasAny ? undefined : true}>
      <div className="market-ticker-scroll">
        <div className="market-ticker-content">
          {!hasAny && (
            <span className="ticker-section-label" style={{ visibility: "hidden" }}>
              &nbsp;
            </span>
          )}
          {hasAny && data && (
            <>
          {cricketMatches.length > 0 && (
            <>
              {cricketMatches.slice(0, 2).map((m) => (
                <span key={m.id} className="ticker-item">
                  <span className="ticker-text">
                    {m.isLive ? "" : "Next: "}{m.name}
                  </span>
                  <span className="ticker-value">{renderCricketLine(m)}</span>
                  <span className="ticker-status">{m.status}</span>
                </span>
              ))}
              <span className="ticker-divider">|</span>
            </>
          )}

          {data.bullion.length > 0 && (
            <>
              {data.bullion.map((b, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{b.name}</span>
                  <span className="ticker-value">{"₹"}{b.price.toLocaleString()}/{b.unit}</span>
                  {b.change !== 0 && (
                    <span className={`ticker-change ${b.change > 0 ? "up" : "down"}`}>
                      {b.change > 0
                        ? <TrendingUp size={10} strokeWidth={2.5} aria-hidden />
                        : <TrendingDown size={10} strokeWidth={2.5} aria-hidden />}
                      {Math.abs(b.change)}%
                    </span>
                  )}
                </span>
              ))}
              <span className="ticker-divider">|</span>
            </>
          )}

          {data.forex.length > 0 && (
            <>
              {data.forex.map((f, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{f.icon} {f.name}</span>
                  <span className="ticker-value">{"₹"}{f.price}</span>
                </span>
              ))}
              <span className="ticker-divider">|</span>
            </>
          )}

          {data.mandi.length > 0 && (
            <>
              {data.mandi.map((m, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-name">{m.commodity} ({m.market})</span>
                  <span className="ticker-value">{"₹"}{m.price.toLocaleString()}/{m.unit}</span>
                  {m.change !== 0 && (
                    <span className={`ticker-change ${m.change > 0 ? "up" : "down"}`}>
                      {m.change > 0
                        ? <TrendingUp size={10} strokeWidth={2.5} aria-hidden />
                        : <TrendingDown size={10} strokeWidth={2.5} aria-hidden />}
                      {Math.abs(m.change)}%
                    </span>
                  )}
                </span>
              ))}
            </>
          )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
