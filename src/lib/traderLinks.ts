import type { AssetDisplayRow } from "../app/types";
import type { AppSettings, TraderProviderId } from "../app/settings";
import type { Trade } from "../types/trade";

/**
 * Trader/Broker-Links für externe Portale (ohne Login-Automation).
 * Aktuell: Trade Republic (Suche), onvista (Suche).
 */

export function getTraderSearchQueryForTrade(trade: Trade): string {
  return (trade.isin ?? trade.wkn ?? trade.basiswert ?? trade.name ?? "").trim();
}

export function getTraderSearchQueryForAsset(asset: AssetDisplayRow): string {
  return (asset.ticker ?? asset.name ?? "").trim();
}

export function traderProviderShortLabel(provider: TraderProviderId): string {
  switch (provider) {
    case "trade-republic":
      return "TR";
    case "onvista":
      return "OV";
  }
}

function traderProviderDisplayName(language: AppSettings["language"], provider: TraderProviderId): string {
  switch (provider) {
    case "trade-republic":
      return language === "en" ? "Trade Republic" : "Trade Republic";
    case "onvista":
      return language === "en" ? "onvista" : "onvista";
  }
}

/**
 * Öffnet die Suche des jeweiligen Traders/Brokers für ein freies Suchwort (ISIN/WKN/Name/Ticker).
 */
export function buildTraderSearchUrl(provider: TraderProviderId, query: string): string {
  const q = query.trim();
  switch (provider) {
    case "trade-republic":
      return `https://app.traderepublic.com/search?q=${encodeURIComponent(q)}`;
    case "onvista":
      return `https://www.onvista.de/suche?q=${encodeURIComponent(q)}`;
  }
}

export function getTraderProviderDisplayNameForLanguage(language: AppSettings["language"], provider: TraderProviderId): string {
  return traderProviderDisplayName(language, provider);
}

