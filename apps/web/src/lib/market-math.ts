// Pure market helpers — no I/O, so bun test can cover them directly.

export const TROY_OZ_GRAMS = 31.1034768;

const IST_OFFSET_MIN = 5.5 * 60;

// NSE cash session 09:15-15:30; we keep the cache "hot" 09:00-15:45 IST.
export function isMarketOpen(now: Date = new Date()): boolean {
  const istMs = now.getTime() + IST_OFFSET_MIN * 60_000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay(); // shifted date, so UTC accessors read IST
  if (day === 0 || day === 6) return false;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 45;
}

export function metalsToInr(
  goldUsdPerOz: number,
  silverUsdPerOz: number,
  usdInr: number,
): { gold24kPer10g: number; gold22kPer10g: number; silverPerKg: number } {
  const goldInrPerGram = (goldUsdPerOz * usdInr) / TROY_OZ_GRAMS;
  const silverInrPerGram = (silverUsdPerOz * usdInr) / TROY_OZ_GRAMS;
  const gold24kPer10g = goldInrPerGram * 10;
  return {
    gold24kPer10g,
    gold22kPer10g: gold24kPer10g * 0.916,
    silverPerKg: silverInrPerGram * 1000,
  };
}
