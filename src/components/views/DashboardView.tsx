import { Clock3, HandCoins, Layers, LayoutDashboard, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window !== "undefined" ? window.innerWidth <= 760 : false));
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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <PageHeader
        className={`dashboard-header${isMobile ? " page-header--mobile-one-hand" : ""}`}
        title={
          <>
            <LayoutDashboard size={18} />
            Trading Dashboard
          </>
        }
        subtitle={t(language, "dashboardSubtitle")}
      />

      <section className="section dashboard-link-grid">
        <button className="card dashboard-link-card" onClick={onOpenAnalyticsOverview}>
          <h3>
            <TrendingUp size={14} />
            {t(language, "dashboardRealizedPL")}
          </h3>
          <div className={`value ${kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(kpis.totalPL)}</div>
          <p>{t(language, "dashboardToAnalytics")}</p>
        </button>
        <button className="card dashboard-link-card" onClick={onOpenTradesWithOpenFilter}>
          <h3>
            <Layers size={14} />
            {t(language, "dashboardOpenPositionsTitle")}
          </h3>
          <div className="value">{kpis.openTrades}</div>
          <p>{t(language, "dashboardOpenTradesLink")}</p>
        </button>
        <button className="card dashboard-link-card" onClick={onOpenTradesWithOpenFilter}>
          <h3>
            <HandCoins size={14} />
            {t(language, "dashboardOpenCapitalTitle")}
          </h3>
          <div className="value">{money(kpis.openCapital)}</div>
          <p>{t(language, "dashboardToOpenPositions")}</p>
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
              <p>{t(language, "exchangeLabel", { ex: exchange })}</p>
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
        <EquityCurve trades={trades} language={language} />
      </section>

      <section className="section card">
        <div className="dashboard-section-head">
          <h3>{t(language, "openPositionsSection", { n: dashboardOpenPositions.length })}</h3>
          <button className="secondary slim" onClick={onOpenTradesWithOpenFilter}>
            {t(language, "showAll")}
          </button>
        </div>
        {isMobile ? (
          <div className="dashboard-open-mobile-list">
            {dashboardOpenPositions.slice(0, 10).map((trade) => (
              <button key={`mobile-open-${trade.id}`} type="button" className="dashboard-open-mobile-card" onClick={() => onEditTrade(trade)}>
                <div className="dashboard-open-mobile-head">
                  <strong>{trade.name}</strong>
                  <span>{trade.typ}</span>
                </div>
                <div className="dashboard-open-mobile-grid">
                  <span>{trade.basiswert || "-"}</span>
                  <span>{formatDateTimeAT(trade.kaufzeitpunkt)}</span>
                  <span>{money(trade.kaufPreis ?? 0)}</span>
                  <span>{trade.stueck ?? "-"}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => onToggleDashboardOpenSort("name")} className="sortable">
                  {t(language, "name")}
                  {dashboardOpenSortMarker("name")}
                </th>
                <th onClick={() => onToggleDashboardOpenSort("typ")} className="sortable">
                  {t(language, "type")}
                  {dashboardOpenSortMarker("typ")}
                </th>
                <th onClick={() => onToggleDashboardOpenSort("basiswert")} className="sortable">
                  {t(language, "basiswert")}
                  {dashboardOpenSortMarker("basiswert")}
                </th>
                <th onClick={() => onToggleDashboardOpenSort("kaufzeitpunkt")} className="sortable">
                  {t(language, "buyDate")}
                  {dashboardOpenSortMarker("kaufzeitpunkt")}
                </th>
                <th onClick={() => onToggleDashboardOpenSort("kaufPreis")} className="sortable">
                  {t(language, "invested")}
                  {dashboardOpenSortMarker("kaufPreis")}
                </th>
                <th onClick={() => onToggleDashboardOpenSort("stueck")} className="sortable">
                  {t(language, "shares")}
                  {dashboardOpenSortMarker("stueck")}
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
        )}
        {dashboardOpenPositions.length > 10 && (
          <p className="dashboard-more-link">{t(language, "moreOpenTrades", { n: dashboardOpenPositions.length - 10 })}</p>
        )}
      </section>

      <section className="section dashboard-bottom-grid">
        <div className="card">
          <h3>{t(language, "monthPL")}</h3>
          {isMobile ? (
            <div className="dashboard-month-mobile-list">
              {dashboardMonthlyStats.map((m) => (
                <div key={`mobile-month-${m.month}`} className="dashboard-month-mobile-card">
                  <strong>{formatMonthLabel(m.month)}</strong>
                  <span>{t(language, "hashTrades")}: {m.trades}</span>
                  <span className={m.pl >= 0 ? "positive" : "negative"}>{t(language, "pl")}: {money(m.pl)}</span>
                  <span>{t(language, "winRate")}: {m.winRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
          <table>
            <thead>
              <tr>
                <th>{t(language, "month")}</th>
                <th>{t(language, "hashTrades")}</th>
                <th>{t(language, "pl")}</th>
                <th>{t(language, "winRate")}</th>
                <th>{t(language, "cumulative")}</th>
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
          )}
        </div>

        <div className="card">
          <h3>{t(language, "topFlopTitle")}</h3>
          <div className="topflop-block">
            <h4 className="positive">{t(language, "topWinners")}</h4>
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
            <h4 className="negative">{t(language, "topLosers")}</h4>
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
