import { getTradeRealizedPL, isTradeClosed } from "../lib/analytics";
import type { Trade } from "../types/trade";
import type { AssetRow } from "./types";
import { parseStoredDateTime } from "./date";

export function buildDashboardMonthlyStats(trades: Trade[]) {
  const grouped = new Map<string, { trades: number; pl: number; wins: number; losses: number }>();

  trades
    .filter((trade) => isTradeClosed(trade))
    .forEach((trade) => {
      const closeDate = parseStoredDateTime(trade.verkaufszeitpunkt) ?? parseStoredDateTime(trade.kaufzeitpunkt);
      if (!closeDate) return;
      const key = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, "0")}`;
      const pl = getTradeRealizedPL(trade);
      const bucket = grouped.get(key) ?? { trades: 0, pl: 0, wins: 0, losses: 0 };
      bucket.trades += 1;
      bucket.pl += pl;
      if (pl > 0) bucket.wins += 1;
      if (pl < 0) bucket.losses += 1;
      grouped.set(key, bucket);
    });

  let cumulative = 0;
  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, bucket]) => {
      cumulative += bucket.pl;
      const winRate = bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0;
      return { month, ...bucket, cumulative, winRate };
    });
}

export function buildDashboardTopFlop(trades: Trade[]) {
  const byAsset = new Map<string, number>();
  trades
    .filter((trade) => isTradeClosed(trade))
    .forEach((trade) => {
      const key = trade.basiswert?.trim() || "Unknown";
      byAsset.set(key, (byAsset.get(key) ?? 0) + getTradeRealizedPL(trade));
    });
  const sorted = [...byAsset.entries()].sort((a, b) => b[1] - a[1]);
  return {
    top: sorted.slice(0, 5),
    flop: sorted.slice(-5).reverse()
  };
}

export function buildAssetRows(trades: Trade[]): AssetRow[] {
  const grouped = new Map<string, AssetRow>();
  trades.forEach((trade) => {
    const key = trade.basiswert?.trim() || "Unknown";
    const existing = grouped.get(key);
    const isClosed = isTradeClosed(trade);
    const category =
      trade.typ === "Anleihe"
        ? "Anleihe"
        : trade.typ === "Fond"
        ? "Fond"
        : ["Dividende", "Zinszahlung", "Steuerkorrektur"].includes(trade.typ)
        ? "Sonstiges"
        : /(gold|silber|platin|platinum|oil|rohstoff)/i.test(key)
        ? "Rohstoff"
        : /(nasdaq|dax|index|s&p|atx)/i.test(key)
        ? "Index"
        : "Aktie";

    if (!existing) {
      grouped.set(key, {
        name: key,
        category,
        tradesCount: 1,
        realizedPL: isClosed ? getTradeRealizedPL(trade) : 0,
        openCapital: trade.status === "Offen" ? trade.kaufPreis ?? 0 : 0,
        hasOpen: trade.status === "Offen"
      });
    } else {
      existing.tradesCount += 1;
      if (isClosed) existing.realizedPL += getTradeRealizedPL(trade);
      if (trade.status === "Offen") {
        existing.openCapital += trade.kaufPreis ?? 0;
        existing.hasOpen = true;
      }
    }
  });

  return [...grouped.values()];
}

export function buildAnalyticsData(trades: Trade[]) {
  const closed = trades.filter((trade) => isTradeClosed(trade));
  if (closed.length === 0) return null;

  const plValues = closed.map((trade) => getTradeRealizedPL(trade));
  const winners = closed.filter((trade) => getTradeRealizedPL(trade) > 0);
  const losers = closed.filter((trade) => getTradeRealizedPL(trade) < 0);
  const totalPL = plValues.reduce((sum, value) => sum + value, 0);
  const totalBuy = closed.reduce((sum, trade) => sum + (trade.kaufPreis ?? 0), 0);
  const totalSell = closed.reduce((sum, trade) => sum + (trade.verkaufPreis ?? 0), 0);
  const avgGain = winners.length ? winners.reduce((s, t) => s + getTradeRealizedPL(t), 0) / winners.length : 0;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + getTradeRealizedPL(t), 0) / losers.length : 0;
  const profitableMonths = new Set<string>();
  const monthBuckets = new Map<string, { pl: number; trades: number; wins: number }>();
  const weekday = new Map<number, number>();
  const hour = new Map<number, number>();
  const sizeBuckets = new Map<string, number>();
  const assetPerf = new Map<string, { pl: number; count: number; wins: number; invested: number }>();
  const typePerf = new Map<string, { pl: number; count: number; wins: number; invested: number }>();
  const holdDays: number[] = [];
  const tradingDays = new Set<string>();

  const sizeLabel = (kauf: number) => {
    if (kauf < 100) return "<100";
    if (kauf < 300) return "100-300";
    if (kauf < 600) return "300-600";
    if (kauf < 1000) return "600-1k";
    if (kauf < 2500) return "1k-2.5k";
    return ">2.5k";
  };

  closed.forEach((trade) => {
    const pl = getTradeRealizedPL(trade);
    const date = parseStoredDateTime(trade.verkaufszeitpunkt) ?? parseStoredDateTime(trade.kaufzeitpunkt);
    if (date) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const m = monthBuckets.get(monthKey) ?? { pl: 0, trades: 0, wins: 0 };
      m.pl += pl;
      m.trades += 1;
      if (pl > 0) m.wins += 1;
      monthBuckets.set(monthKey, m);
      tradingDays.add(dayKey);
      if (pl > 0) profitableMonths.add(monthKey);

      const w = date.getDay();
      weekday.set(w, (weekday.get(w) ?? 0) + pl);
    }

    const buyDate = parseStoredDateTime(trade.kaufzeitpunkt);
    if (buyDate) {
      const h = buyDate.getHours();
      hour.set(h, (hour.get(h) ?? 0) + pl);
    }

    const size = sizeLabel(trade.kaufPreis ?? 0);
    sizeBuckets.set(size, (sizeBuckets.get(size) ?? 0) + 1);

    const assetKey = trade.basiswert?.trim() || "Unknown";
    const ap = assetPerf.get(assetKey) ?? { pl: 0, count: 0, wins: 0, invested: 0 };
    ap.pl += pl;
    ap.count += 1;
    ap.invested += trade.kaufPreis ?? 0;
    if (pl > 0) ap.wins += 1;
    assetPerf.set(assetKey, ap);

    const typeKey = trade.typ || "Unknown";
    const tp = typePerf.get(typeKey) ?? { pl: 0, count: 0, wins: 0, invested: 0 };
    tp.pl += pl;
    tp.count += 1;
    tp.invested += trade.kaufPreis ?? 0;
    if (pl > 0) tp.wins += 1;
    typePerf.set(typeKey, tp);

    const sellDate = parseStoredDateTime(trade.verkaufszeitpunkt);
    if (buyDate && sellDate) {
      const d = Math.max(0, Math.round((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));
      holdDays.push(d);
    }
  });

  const mean = plValues.reduce((sum, v) => sum + v, 0) / (plValues.length || 1);
  const variance = plValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (plValues.length || 1);
  const stdDev = Math.sqrt(variance);
  const grossGain = winners.reduce((sum, trade) => sum + getTradeRealizedPL(trade), 0);
  const grossLoss = losers.reduce((sum, trade) => sum + getTradeRealizedPL(trade), 0);

  let peak = 0;
  let cum = 0;
  let maxDrawdown = 0;
  [...closed]
    .sort((a, b) => (parseStoredDateTime(a.verkaufszeitpunkt)?.getTime() ?? 0) - (parseStoredDateTime(b.verkaufszeitpunkt)?.getTime() ?? 0))
    .forEach((trade) => {
      cum += getTradeRealizedPL(trade);
      peak = Math.max(peak, cum);
      maxDrawdown = Math.max(maxDrawdown, peak - cum);
    });

  const monthSeries = [...monthBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  let cumulative = 0;
  const monthChart = monthSeries.map((m) => {
    cumulative += m.pl;
    return { ...m, cumulative };
  });

  const topAsset = [...assetPerf.entries()].sort((a, b) => b[1].pl - a[1].pl)[0];
  const flopAsset = [...assetPerf.entries()].sort((a, b) => a[1].pl - b[1].pl)[0];
  const bestMonth = monthChart.reduce((best, cur) => (cur.pl > (best?.pl ?? -Infinity) ? cur : best), null as null | (typeof monthChart)[number]);
  const worstMonth = monthChart.reduce((worst, cur) => (cur.pl < (worst?.pl ?? Infinity) ? cur : worst), null as null | (typeof monthChart)[number]);

  return {
    closedCount: closed.length,
    winners: winners.length,
    losers: losers.length,
    bestSeries: (() => {
      let best = 0;
      let curr = 0;
      closed.forEach((trade) => {
        curr = getTradeRealizedPL(trade) > 0 ? curr + 1 : 0;
        best = Math.max(best, curr);
      });
      return best;
    })(),
    worstSeries: (() => {
      let best = 0;
      let curr = 0;
      closed.forEach((trade) => {
        curr = getTradeRealizedPL(trade) < 0 ? curr + 1 : 0;
        best = Math.max(best, curr);
      });
      return best;
    })(),
    totalBuy,
    totalSell,
    totalPL,
    avgPosition: totalBuy / (closed.length || 1),
    minPosition: Math.min(...closed.map((t) => t.kaufPreis ?? 0)),
    maxPosition: Math.max(...closed.map((t) => t.kaufPreis ?? 0)),
    avgGain,
    avgLoss,
    profitFactor: Math.abs(grossLoss) > 0 ? grossGain / Math.abs(grossLoss) : 0,
    expectancy: closed.length ? totalPL / closed.length : 0,
    stdDev,
    maxDrawdown,
    totalLossTrades: losers.length,
    totalLossValue: grossLoss,
    grossGain,
    grossLoss,
    tradingDays: tradingDays.size,
    returnPct: totalBuy ? (totalPL / totalBuy) * 100 : 0,
    profitableMonths: profitableMonths.size,
    monthCount: monthChart.length,
    monthChart,
    topAsset,
    flopAsset,
    bestMonth,
    worstMonth,
    weekdayData: [1, 2, 3, 4, 5].map((d) => ({ label: ["Mo", "Di", "Mi", "Do", "Fr"][d - 1], value: weekday.get(d) ?? 0 })),
    hourData: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => ({ label: `${h}h`, value: hour.get(h) ?? 0 })),
    sizeData: ["<100", "100-300", "300-600", "600-1k", "1k-2.5k", ">2.5k"].map((s) => ({ label: s, value: sizeBuckets.get(s) ?? 0 })),
    assetRows: [...assetPerf.entries()]
      .map(([name, d]) => ({ name, count: d.count, winRate: d.count ? (d.wins / d.count) * 100 : 0, pl: d.pl, rendite: d.invested ? (d.pl / d.invested) * 100 : 0 }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 10),
    typeRows: [...typePerf.entries()]
      .map(([type, d]) => ({ type, count: d.count, winRate: d.count ? (d.wins / d.count) * 100 : 0, pl: d.pl, rendite: d.invested ? (d.pl / d.invested) * 100 : 0 }))
      .sort((a, b) => b.count - a.count),
    hold: {
      avg: holdDays.length ? holdDays.reduce((s, d) => s + d, 0) / holdDays.length : 0,
      winAvg: winners.length
        ? winners
            .map((t) => {
              const b = parseStoredDateTime(t.kaufzeitpunkt);
              const s = parseStoredDateTime(t.verkaufszeitpunkt);
              return b && s ? Math.max(0, Math.round((s.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))) : 0;
            })
            .reduce((a, b) => a + b, 0) / winners.length
        : 0,
      lossAvg: losers.length
        ? losers
            .map((t) => {
              const b = parseStoredDateTime(t.kaufzeitpunkt);
              const s = parseStoredDateTime(t.verkaufszeitpunkt);
              return b && s ? Math.max(0, Math.round((s.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))) : 0;
            })
            .reduce((a, b) => a + b, 0) / losers.length
        : 0,
      max: holdDays.length ? Math.max(...holdDays) : 0,
      intraday: holdDays.filter((d) => d === 0).length,
      oneTo7: holdDays.filter((d) => d >= 1 && d <= 7).length,
      eightTo30: holdDays.filter((d) => d >= 8 && d <= 30).length,
      over30: holdDays.filter((d) => d > 30).length
    }
  };
}
