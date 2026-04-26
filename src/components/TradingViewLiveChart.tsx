interface TradingViewLiveChartProps {
  /** z. B. NASDAQ:AAPL oder XETR:RHM (Xetra; „XETRA:“ wird vor dem Embed normalisiert) */
  symbol: string;
  theme: "dark" | "light";
  /** Höhe des eingebetteten Charts in Pixel */
  height?: number;
}

/**
 * Live-Chart über das öffentliche TradingView-Widget (iframe).
 * Kein API-Key nötig; Daten kommen von TradingView.
 */
export function TradingViewLiveChart({ symbol, theme, height = 460 }: TradingViewLiveChartProps) {
  const tvTheme = theme === "dark" ? "dark" : "light";
  const enc = encodeURIComponent(symbol);
  const src = `https://www.tradingview.com/widgetembed/?frameElementId=tv_embed&symbol=${enc}&interval=5&symboledit=0&saveimage=0&hideideas=1&theme=${tvTheme}&style=1&timezone=Europe%2FBerlin&locale=de&utm_source=trading-dashboard&utm_medium=widget&utm_campaign=chart&utm_term=${enc}`;

  return (
    <div className="tv-live-chart-wrap" style={{ height }}>
      <iframe className="tv-live-chart-iframe" title={`TradingView ${symbol}`} src={src} allow="clipboard-write" />
    </div>
  );
}
