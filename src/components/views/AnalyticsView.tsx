import { Briefcase, CandlestickChart, ChartColumn, CircleDollarSign, Clock3, Database, LineChart, Percent, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import { formatMonthLabel } from "../../app/date";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../../lib/analytics";
import type { Trade } from "../../types/trade";
import { PageHeader } from "../PageHeader";
import { buildAnalyticsData } from "../../app/derive";
import { SimpleBarChart } from "../SimpleBarChart";

type AnalyticsData = NonNullable<ReturnType<typeof buildAnalyticsData>>;

interface AnalyticsViewProps {
  language: AppSettings["language"];
  analyticsData: AnalyticsData;
  analyticsTab: "overview" | "timing" | "assets";
  onAnalyticsTabChange: (tab: "overview" | "timing" | "assets") => void;
  trades: Trade[];
  onBackToTrades: () => void;
}

export function AnalyticsView({ language, analyticsData, analyticsTab, onAnalyticsTabChange, trades, onBackToTrades }: AnalyticsViewProps) {
  const plDistributionData = [
    { label: "<-500", min: -Infinity, max: -500 },
    { label: "-500..-200", min: -500, max: -200 },
    { label: "-200..-100", min: -200, max: -100 },
    { label: "-100..0", min: -100, max: 0 },
    { label: "0..100", min: 0, max: 100 },
    { label: "100..200", min: 100, max: 200 },
    { label: "200..500", min: 200, max: 500 },
    { label: ">500", min: 500, max: Infinity }
  ].map((bucket) => {
    const count = analyticsData.closedCount
      ? trades.filter((t) => {
          const pl = getTradeRealizedPL(t);
          return isTradeClosed(t) && pl >= bucket.min && pl < bucket.max;
        }).length
      : 0;

    return { label: bucket.label, value: count };
  });

  return (
    <section className="section analytics-page">
      <PageHeader
        title={
          <>
            <ChartColumn size={18} />
            {t(language, "analyticsTitle")}
          </>
        }
        subtitle={t(language, "analyticsSubtitle")}
        actions={
          <button className="secondary" onClick={onBackToTrades}>
            <CandlestickChart size={14} />
            {t(language, "toTrades")}
          </button>
        }
      />

      <div className="trades-summary-grid analytics-top-kpis">
        <div className="card">
          <h3>
            <Briefcase size={14} />
            {t(language, "analyzedTrades")}
          </h3>
          <div className="value">{analyticsData.closedCount}</div>
        </div>
        <div className="card">
          <h3>
            <Percent size={14} />
            {t(language, "winRate")}
          </h3>
          <div className="value positive">{((analyticsData.winners / (analyticsData.closedCount || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(language, "totalPL")}
          </h3>
          <div className={`value ${analyticsData.totalPL >= 0 ? "positive" : "negative"}`}>{money(analyticsData.totalPL)}</div>
        </div>
        <div className="card">
          <h3>
            <ShieldAlert size={14} />
            {t(language, "maxDrawdown")}
          </h3>
          <div className="value negative">{money(analyticsData.maxDrawdown)}</div>
        </div>
        <div className="card">
          <h3>
            <Clock3 size={14} />
            {t(language, "tradingDays")}
          </h3>
          <div className="value">{analyticsData.tradingDays}</div>
        </div>
      </div>

      <div className="card analytics-insights-card">
        <h3>
          <Sparkles size={14} />
          {t(language, "highlightsTitle")}
        </h3>
        <div className="analytics-insights-list">
          <div className="analytics-insight positive">
            <span>{t(language, "strongestStreak")}</span>
            <strong>{t(language, "winsInRow", { n: analyticsData.bestSeries })}</strong>
          </div>
          <div className="analytics-insight negative">
            <span>{t(language, "weakestStreak")}</span>
            <strong>{t(language, "lossesInRow", { n: analyticsData.worstSeries })}</strong>
          </div>
          <div className="analytics-insight">
            <span>{t(language, "bestMonth")}</span>
            <strong>
              {analyticsData.bestMonth
                ? `${money(analyticsData.bestMonth.pl)} (${formatMonthLabel(analyticsData.bestMonth.month)})`
                : t(language, "noneDash")}
            </strong>
          </div>
          <div className="analytics-insight">
            <span>{t(language, "worstMonth")}</span>
            <strong>
              {analyticsData.worstMonth
                ? `${money(analyticsData.worstMonth.pl)} (${formatMonthLabel(analyticsData.worstMonth.month)})`
                : t(language, "noneDash")}
            </strong>
          </div>
          <div className="analytics-insight">
            <span>{t(language, "topAsset")}</span>
            <strong>
              {analyticsData.topAsset ? `${analyticsData.topAsset[0]} (${money(analyticsData.topAsset[1].pl)})` : t(language, "noneDash")}
            </strong>
          </div>
          <div className="analytics-insight">
            <span>{t(language, "flopAsset")}</span>
            <strong>
              {analyticsData.flopAsset ? `${analyticsData.flopAsset[0]} (${money(analyticsData.flopAsset[1].pl)})` : t(language, "noneDash")}
            </strong>
          </div>
        </div>
      </div>

      <div className="analytics-tabbar">
        <button className={analyticsTab === "overview" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("overview")}>
          {t(language, "tabOverview")}
        </button>
        <button className={analyticsTab === "timing" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("timing")}>
          {t(language, "tabTiming")}
        </button>
        <button className={analyticsTab === "assets" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("assets")}>
          {t(language, "tabAssets")}
        </button>
      </div>

      {analyticsTab === "overview" && (
        <div className="analytics-tab-panel">
          <div className="card analytics-grid-6">
            <h3>
              <CircleDollarSign size={14} />
              {t(language, "buySellOverviewTitle")}
            </h3>
            <div className="analytics-mini-grid">
              <div>
                <span>{t(language, "sigmaBuyVol")}</span>
                <strong>{money(analyticsData.totalBuy)}</strong>
              </div>
              <div>
                <span>{t(language, "sigmaSellVol")}</span>
                <strong>{money(analyticsData.totalSell)}</strong>
              </div>
              <div className="accent">
                <span>{t(language, "diffPL")}</span>
                <strong>{money(analyticsData.totalPL)}</strong>
              </div>
              <div>
                <span>{t(language, "avgPosSize")}</span>
                <strong>{money(analyticsData.avgPosition)}</strong>
              </div>
              <div>
                <span>{t(language, "minPosition")}</span>
                <strong>{money(analyticsData.minPosition)}</strong>
              </div>
              <div>
                <span>{t(language, "maxPosition")}</span>
                <strong>{money(analyticsData.maxPosition)}</strong>
              </div>
            </div>
          </div>

          <div className="card analytics-grid-8">
            <h3>
              <ShieldAlert size={14} />
              {t(language, "costsFeesTaxTitle")}
            </h3>
            <div className="analytics-mini-grid analytics-eight">
              <div>
                <span>{t(language, "sigmaBuyFees")}</span>
                <strong>{money(analyticsData.totalBuyFees)}</strong>
              </div>
              <div>
                <span>{t(language, "sigmaSellFees")}</span>
                <strong>{money(analyticsData.totalSellFees)}</strong>
              </div>
              <div>
                <span>{t(language, "sigmaFeesTotal")}</span>
                <strong>{money(analyticsData.totalFees)}</strong>
              </div>
              <div>
                <span>{t(language, "sigmaTaxes")}</span>
                <strong>{money(analyticsData.totalTaxes)}</strong>
              </div>
              <div>
                <span>{t(language, "feesToBuyRatio")}</span>
                <strong>{analyticsData.feesToBuyPct.toFixed(2)}%</strong>
              </div>
              <div>
                <span>{t(language, "taxesToSellRatio")}</span>
                <strong>{analyticsData.taxesToSellPct.toFixed(2)}%</strong>
              </div>
              <div>
                <span>{t(language, "avgFeesPerTrade")}</span>
                <strong>{money(analyticsData.avgFeesPerTrade)}</strong>
              </div>
              <div>
                <span>{t(language, "avgTaxesPerTrade")}</span>
                <strong>{money(analyticsData.avgTaxesPerTrade)}</strong>
              </div>
            </div>
          </div>

          <div className="card analytics-grid-8">
            <h3>
              <LineChart size={14} />
              {t(language, "plStatsTitle")}
            </h3>
            <div className="analytics-mini-grid analytics-eight">
              <div className="good">
                <span>{t(language, "winners")}</span>
                <strong>{analyticsData.winners}</strong>
              </div>
              <div className="bad">
                <span>{t(language, "losers")}</span>
                <strong>{analyticsData.losers}</strong>
              </div>
              <div className="good">
                <span>{t(language, "sigmaGains")}</span>
                <strong>{money(analyticsData.grossGain)}</strong>
              </div>
              <div className="bad">
                <span>{t(language, "sigmaLosses")}</span>
                <strong>{money(analyticsData.grossLoss)}</strong>
              </div>
              <div className="good">
                <span>{t(language, "avgGain")}</span>
                <strong>{money(analyticsData.avgGain)}</strong>
              </div>
              <div className="bad">
                <span>{t(language, "avgLoss")}</span>
                <strong>{money(analyticsData.avgLoss)}</strong>
              </div>
              <div className="good">
                <span>{t(language, "profitFactor")}</span>
                <strong>{analyticsData.profitFactor.toFixed(2)}</strong>
              </div>
              <div>
                <span>{t(language, "expectancy")}</span>
                <strong>{money(analyticsData.expectancy)}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>
              <ChartColumn size={14} />
              {t(language, "plDistributionTitle")}
            </h3>
            <SimpleBarChart mode="count" data={plDistributionData} />
          </div>
        </div>
      )}

      {analyticsTab === "timing" && (
        <div className="analytics-tab-panel">
          <div className="dashboard-bottom-grid">
            <div className="card chart-card">
              <h3>
                <TrendingUp size={14} />
                {t(language, "monthPerf")}
              </h3>
              <SimpleBarChart
                mode="pl"
                data={analyticsData.monthChart.map((m) => ({
                  label: m.month.slice(5),
                  value: m.pl
                }))}
              />
            </div>
            <div className="card">
              <h3>
                <Target size={14} />
                {t(language, "winLossDist")}
              </h3>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#30c56f 0 ${((analyticsData.winners / analyticsData.closedCount) * 360).toFixed(1)}deg, #ff5d6c 0 360deg)`
                  }}
                >
                  <div className="donut-inner">{Math.round((analyticsData.winners / analyticsData.closedCount) * 100)}%</div>
                </div>
                <p>
                  <span className="positive">{t(language, "analyticsDonutWins", { n: analyticsData.winners })}</span> /{" "}
                  <span className="negative">{t(language, "analyticsDonutLosses", { n: analyticsData.losers })}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="dashboard-bottom-grid">
            <div className="card chart-card">
              <h3>
                <ChartColumn size={14} />
                {t(language, "perfByWeekday")}
              </h3>
              <SimpleBarChart mode="pl" data={analyticsData.weekdayData.map((d) => ({ label: d.label, value: d.value }))} />
            </div>
            <div className="card chart-card">
              <h3>
                <Briefcase size={14} />
                {t(language, "tradesBySize")}
              </h3>
              <SimpleBarChart mode="count" data={analyticsData.sizeData.map((d) => ({ label: d.label, value: d.value }))} />
            </div>
          </div>

          <div className="card chart-card">
            <h3>
              <Clock3 size={14} />
              {t(language, "perfByHourBuy")}
            </h3>
            <SimpleBarChart mode="pl" data={analyticsData.hourData.map((d) => ({ label: d.label, value: d.value }))} />
          </div>

          <div className="card chart-card">
            <h3>
              <ShieldAlert size={14} />
              {t(language, "feesTaxPerMonth")}
            </h3>
            <SimpleBarChart
              mode="pl"
              data={analyticsData.monthCostChart.map((m) => ({
                label: m.month.slice(5),
                value: m.costs
              }))}
            />
          </div>

          <div className="card analytics-grid-8">
            <h3>
              <Clock3 size={14} />
              {t(language, "holdAnalysisTitle")}
            </h3>
            <div className="analytics-mini-grid analytics-eight">
              <div>
                <span>{t(language, "avgTotal")}</span>
                <strong>{t(language, "daysCount", { n: analyticsData.hold.avg.toFixed(1) })}</strong>
              </div>
              <div className="good">
                <span>{t(language, "avgWinsHold")}</span>
                <strong>{t(language, "daysCount", { n: analyticsData.hold.winAvg.toFixed(1) })}</strong>
              </div>
              <div className="bad">
                <span>{t(language, "avgLossesHold")}</span>
                <strong>{t(language, "daysCount", { n: analyticsData.hold.lossAvg.toFixed(1) })}</strong>
              </div>
              <div>
                <span>{t(language, "maxHold")}</span>
                <strong>{t(language, "daysCount", { n: analyticsData.hold.max })}</strong>
              </div>
              <div>
                <span>{t(language, "intraday")}</span>
                <strong>{analyticsData.hold.intraday}</strong>
              </div>
              <div>
                <span>{t(language, "days1to7")}</span>
                <strong>{analyticsData.hold.oneTo7}</strong>
              </div>
              <div>
                <span>{t(language, "days8to30")}</span>
                <strong>{analyticsData.hold.eightTo30}</strong>
              </div>
              <div>
                <span>{t(language, "days30plus")}</span>
                <strong>{analyticsData.hold.over30}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {analyticsTab === "assets" && (
        <div className="analytics-tab-panel">
          <div className="dashboard-bottom-grid">
            <div className="card">
              <h3>
                <Database size={14} />
                {t(language, "perUnderlyingTitle")}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t(language, "basiswert")}</th>
                    <th>{t(language, "hashCount")}</th>
                    <th>{t(language, "winPct")}</th>
                    <th>{t(language, "pl")}</th>
                    <th>{t(language, "returnLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.assetRows.map((r) => (
                    <tr key={`ar-${r.name}`}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                      <td className={r.winRate >= 50 ? "positive" : "negative"}>{r.winRate.toFixed(1)}%</td>
                      <td className={r.pl >= 0 ? "positive" : "negative"}>{money(r.pl)}</td>
                      <td className={r.rendite >= 0 ? "positive" : "negative"}>{r.rendite.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>
                <CandlestickChart size={14} />
                {t(language, "perTypeTitle")}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t(language, "type")}</th>
                    <th>{t(language, "hashCount")}</th>
                    <th>{t(language, "winPct")}</th>
                    <th>{t(language, "pl")}</th>
                    <th>{t(language, "returnLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.typeRows.map((r) => (
                    <tr key={`tr-${r.type}`}>
                      <td>{r.type}</td>
                      <td>{r.count}</td>
                      <td className={r.winRate >= 50 ? "positive" : "negative"}>{r.winRate.toFixed(1)}%</td>
                      <td className={r.pl >= 0 ? "positive" : "negative"}>{money(r.pl)}</td>
                      <td className={r.rendite >= 0 ? "positive" : "negative"}>{r.rendite.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-bottom-grid analytics-risk-row">
        <div className="card">
          <h3>
            <ShieldAlert size={14} />
            {t(language, "riskMetricsTitle")}
          </h3>
          <div className="analytics-mini-grid">
            <div>
              <span>{t(language, "stdDevLabel")}</span>
              <strong>{money(analyticsData.stdDev)}</strong>
            </div>
            <div className="bad">
              <span>{t(language, "maxDdLabel")}</span>
              <strong>{money(analyticsData.maxDrawdown)}</strong>
            </div>
            <div>
              <span>{t(language, "totalReturnLabel")}</span>
              <strong className={analyticsData.returnPct >= 0 ? "positive" : "negative"}>{analyticsData.returnPct.toFixed(1)}%</strong>
            </div>
            <div className="bad">
              <span>{t(language, "totalLossTradesLabel")}</span>
              <strong>{analyticsData.totalLossTrades}</strong>
            </div>
            <div>
              <span>{t(language, "profitFactor")}</span>
              <strong>{analyticsData.profitFactor.toFixed(2)}</strong>
            </div>
            <div>
              <span>{t(language, "expectancy")}</span>
              <strong>{money(analyticsData.expectancy)}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
