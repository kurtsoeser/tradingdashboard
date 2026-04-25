import { Clock3, HandCoins, Layers, LayoutDashboard, TrendingUp } from "lucide-react";
import { formatDateTimeAT, formatMonthLabel, isMarketOpenNow } from "../../app/date";
import { t } from "../../app/i18n";
import { money } from "../../lib/analytics";
import type { AppSettings } from "../../app/settings";
import type { Trade } from "../../types/trade";
import { EquityCurve } from "../EquityCurve";
import { PageHeader } from "../PageHeader";

interface DashboardViewProps {
  kpis: {
    totalPL: number;
    openTrades: number;
    openCapital: number;
  };
  dashboardNow: Date;
  trades: Trade[];
  dashboardOpenPositions: Trade[];
  dashboardMonthlyStats: Array<{
    month: string;
    trades: number;
    pl: number;
    cumulative: number;
    winRate: number;
  }>;
  dashboardTopFlop: {
    top: Array<[string, number]>;
    flop: Array<[string, number]>;
  };
  onOpenAnalyticsOverview: () => void;
  onOpenTradesWithOpenFilter: () => void;
  onToggleDashboardOpenSort: (field: "name" | "typ" | "basiswert" | "kaufzeitpunkt" | "kaufPreis" | "stueck") => void;
  dashboardOpenSortMarker: (field: "name" | "typ" | "basiswert" | "kaufzeitpunkt" | "kaufPreis" | "stueck") => string;
  onEditTrade: (trade: Trade) => void;
  onJumpToAsset: (assetName: string) => void;
  exchange: AppSettings["exchange"];
  language: AppSettings["language"];
  showMarketPulse: boolean;
}

export function DashboardView({
  kpis,
  dashboardNow,
  trades,
  dashboardOpenPositions,
  dashboardMonthlyStats,
  dashboardTopFlop,
  onOpenAnalyticsOverview,
  onOpenTradesWithOpenFilter,
  onToggleDashboardOpenSort,
  dashboardOpenSortMarker,
  onEditTrade,
  onJumpToAsset,
  exchange,
  language,
  showMarketPulse
}: DashboardViewProps) {
  const locale = language === "en" ? "en-US" : "de-AT";
  const dashboardTime = dashboardNow.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const dashboardDate = dashboardNow.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const marketOpen = isMarketOpenNow(dashboardNow, exchange);

  return (
    <>
      <PageHeader
        className="dashboard-header"
        title={
          <>
            <LayoutDashboard size={18} />
            Trading Dashboard
          </>
        }
        subtitle="Überblick über deine Trading-Performance"
      />

      <section className="section dashboard-link-grid">
        <button className="card dashboard-link-card" onClick={onOpenAnalyticsOverview}>
          <h3>
            <TrendingUp size={14} />
            Realisierter P&L
          </h3>
          <div className={`value ${kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(kpis.totalPL)}</div>
          <p>Zu Auswertungen</p>
        </button>
        <button className="card dashboard-link-card" onClick={onOpenTradesWithOpenFilter}>
          <h3>
            <Layers size={14} />
            Offene Positionen
          </h3>
          <div className="value">{kpis.openTrades}</div>
          <p>Zu Trades (Status: Offen)</p>
        </button>
        <button className="card dashboard-link-card" onClick={onOpenTradesWithOpenFilter}>
          <h3>
            <HandCoins size={14} />
            Offenes Kapital
          </h3>
          <div className="value">{money(kpis.openCapital)}</div>
          <p>Zu offenen Positionen</p>
        </button>
        <div className="card dashboard-link-card dashboard-clock-card" role="status" aria-live="polite">
          <h3>
            <Clock3 size={14} />
            {t(language, "dateTime")}
          </h3>
          <div className="dashboard-clock-grid">
            <div className="dashboard-clock-left">
              <div className="value">{dashboardTime}</div>
              <p>{dashboardDate}</p>
            </div>
            <div className="dashboard-clock-right">
              <p>{`Börse: ${exchange}`}</p>
              {showMarketPulse ? (
                <p className={`market-status ${marketOpen ? "open" : "closed"}`}>
                  <span className={`market-pulse ${marketOpen ? "open" : "closed"}`} aria-hidden="true" />
                  {marketOpen ? t(language, "marketOpen") : t(language, "marketClosed")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <EquityCurve trades={trades} />
      </section>

      <section className="section card">
        <div className="dashboard-section-head">
          <h3>Offene Positionen ({dashboardOpenPositions.length})</h3>
          <button className="secondary slim" onClick={onOpenTradesWithOpenFilter}>
            Alle anzeigen
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th onClick={() => onToggleDashboardOpenSort("name")} className="sortable">
                Name{dashboardOpenSortMarker("name")}
              </th>
              <th onClick={() => onToggleDashboardOpenSort("typ")} className="sortable">
                Typ{dashboardOpenSortMarker("typ")}
              </th>
              <th onClick={() => onToggleDashboardOpenSort("basiswert")} className="sortable">
                Basiswert{dashboardOpenSortMarker("basiswert")}
              </th>
              <th onClick={() => onToggleDashboardOpenSort("kaufzeitpunkt")} className="sortable">
                Kaufdatum{dashboardOpenSortMarker("kaufzeitpunkt")}
              </th>
              <th onClick={() => onToggleDashboardOpenSort("kaufPreis")} className="sortable">
                Investiert{dashboardOpenSortMarker("kaufPreis")}
              </th>
              <th onClick={() => onToggleDashboardOpenSort("stueck")} className="sortable">
                Stück{dashboardOpenSortMarker("stueck")}
              </th>
            </tr>
          </thead>
          <tbody>
            {dashboardOpenPositions.slice(0, 10).map((trade) => (
              <tr key={`open-${trade.id}`} className="dashboard-open-row" onClick={() => onEditTrade(trade)}>
                <td>{trade.name}</td>
                <td>{trade.typ}</td>
                <td>{trade.basiswert}</td>
                <td>{formatDateTimeAT(trade.kaufzeitpunkt)}</td>
                <td>{money(trade.kaufPreis ?? 0)}</td>
                <td>{trade.stueck ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dashboardOpenPositions.length > 10 && (
          <p className="dashboard-more-link">+{dashboardOpenPositions.length - 10} weitere offene Trades anzeigen</p>
        )}
      </section>

      <section className="section dashboard-bottom-grid">
        <div className="card">
          <h3>Monats-P&L</h3>
          <table>
            <thead>
              <tr>
                <th>Monat</th>
                <th># Trades</th>
                <th>P&L</th>
                <th>Win-Rate</th>
                <th>Kumulativ</th>
              </tr>
            </thead>
            <tbody>
              {dashboardMonthlyStats.map((m) => (
                <tr key={m.month}>
                  <td>{formatMonthLabel(m.month)}</td>
                  <td>{m.trades}</td>
                  <td className={m.pl >= 0 ? "positive" : "negative"}>{money(m.pl)}</td>
                  <td>{m.winRate.toFixed(1)}%</td>
                  <td className={m.cumulative >= 0 ? "positive" : "negative"}>{money(m.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Top & Flop Basiswerte</h3>
          <div className="topflop-block">
            <h4 className="positive">Top 5 Gewinner</h4>
            {dashboardTopFlop.top.map(([asset, pl]) => (
              <div key={`top-${asset}`} className="topflop-row top">
                <button className="asset-jump-link" onClick={() => onJumpToAsset(asset)}>
                  {asset}
                </button>
                <span>{money(pl)}</span>
              </div>
            ))}
          </div>
          <div className="topflop-block">
            <h4 className="negative">Top 5 Verlierer</h4>
            {dashboardTopFlop.flop.map(([asset, pl]) => (
              <div key={`flop-${asset}`} className="topflop-row flop">
                <button className="asset-jump-link" onClick={() => onJumpToAsset(asset)}>
                  {asset}
                </button>
                <span>{money(pl)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
