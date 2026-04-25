import { Briefcase, CandlestickChart, ChartColumn, CircleDollarSign, Clock3, Database, LineChart, Percent, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import { formatMonthLabel } from "../../app/date";
import { getTradeRealizedPL, isTradeClosed, money } from "../../lib/analytics";
import type { Trade } from "../../types/trade";
import { PageHeader } from "../PageHeader";
import { buildAnalyticsData } from "../../app/derive";

type AnalyticsData = NonNullable<ReturnType<typeof buildAnalyticsData>>;

interface AnalyticsViewProps {
  analyticsData: AnalyticsData;
  analyticsTab: "overview" | "timing" | "assets";
  onAnalyticsTabChange: (tab: "overview" | "timing" | "assets") => void;
  trades: Trade[];
  onBackToTrades: () => void;
}

export function AnalyticsView({ analyticsData, analyticsTab, onAnalyticsTabChange, trades, onBackToTrades }: AnalyticsViewProps) {
  return (
    <section className="section analytics-page">
      <PageHeader
        title={
          <>
            <ChartColumn size={18} />
            Auswertungen
          </>
        }
        subtitle="Detaillierte Analyse deiner Trading-Performance"
        actions={
          <button className="secondary" onClick={onBackToTrades}>
            <CandlestickChart size={14} />
            Zu Trades
          </button>
        }
      />

      <div className="trades-summary-grid analytics-top-kpis">
        <div className="card">
          <h3>
            <Briefcase size={14} />
            Analysierte Trades
          </h3>
          <div className="value">{analyticsData.closedCount}</div>
        </div>
        <div className="card">
          <h3>
            <Percent size={14} />
            Win-Rate
          </h3>
          <div className="value positive">{((analyticsData.winners / (analyticsData.closedCount || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div className="card">
          <h3>
            <TrendingUp size={14} />
            Gesamt P&L
          </h3>
          <div className={`value ${analyticsData.totalPL >= 0 ? "positive" : "negative"}`}>{money(analyticsData.totalPL)}</div>
        </div>
        <div className="card">
          <h3>
            <ShieldAlert size={14} />
            Max Drawdown
          </h3>
          <div className="value negative">{money(analyticsData.maxDrawdown)}</div>
        </div>
        <div className="card">
          <h3>
            <Clock3 size={14} />
            Handelstage
          </h3>
          <div className="value">{analyticsData.tradingDays}</div>
        </div>
      </div>

      <div className="card analytics-insights-card">
        <h3>
          <Sparkles size={14} />
          Konsolidierte Highlights
        </h3>
        <div className="analytics-insights-list">
          <div className="analytics-insight positive">
            <span>Staerkste Serie</span>
            <strong>{analyticsData.bestSeries} Gewinne in Folge</strong>
          </div>
          <div className="analytics-insight negative">
            <span>Schwaechste Serie</span>
            <strong>{analyticsData.worstSeries} Verluste in Folge</strong>
          </div>
          <div className="analytics-insight">
            <span>Bester Monat</span>
            <strong>{analyticsData.bestMonth ? `${money(analyticsData.bestMonth.pl)} (${formatMonthLabel(analyticsData.bestMonth.month)})` : "-"}</strong>
          </div>
          <div className="analytics-insight">
            <span>Schlechtester Monat</span>
            <strong>{analyticsData.worstMonth ? `${money(analyticsData.worstMonth.pl)} (${formatMonthLabel(analyticsData.worstMonth.month)})` : "-"}</strong>
          </div>
          <div className="analytics-insight">
            <span>Top-Basiswert</span>
            <strong>{analyticsData.topAsset ? `${analyticsData.topAsset[0]} (${money(analyticsData.topAsset[1].pl)})` : "-"}</strong>
          </div>
          <div className="analytics-insight">
            <span>Flop-Basiswert</span>
            <strong>{analyticsData.flopAsset ? `${analyticsData.flopAsset[0]} (${money(analyticsData.flopAsset[1].pl)})` : "-"}</strong>
          </div>
        </div>
      </div>

      <div className="analytics-tabbar">
        <button className={analyticsTab === "overview" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("overview")}>
          Ueberblick
        </button>
        <button className={analyticsTab === "timing" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("timing")}>
          Timing & Verteilung
        </button>
        <button className={analyticsTab === "assets" ? "secondary active" : "secondary"} onClick={() => onAnalyticsTabChange("assets")}>
          Basiswerte & Typen
        </button>
      </div>

      {analyticsTab === "overview" && (
        <div className="analytics-tab-panel">
          <div className="card analytics-grid-6">
            <h3>
              <CircleDollarSign size={14} />
              Kauf & Verkauf Uebersicht
            </h3>
            <div className="analytics-mini-grid">
              <div>
                <span>Σ Kaufvolumen</span>
                <strong>{money(analyticsData.totalBuy)}</strong>
              </div>
              <div>
                <span>Σ Verkaufsvolumen</span>
                <strong>{money(analyticsData.totalSell)}</strong>
              </div>
              <div className="accent">
                <span>Differenz (P&L)</span>
                <strong>{money(analyticsData.totalPL)}</strong>
              </div>
              <div>
                <span>Ø Positionsgroesse</span>
                <strong>{money(analyticsData.avgPosition)}</strong>
              </div>
              <div>
                <span>Min Position</span>
                <strong>{money(analyticsData.minPosition)}</strong>
              </div>
              <div>
                <span>Max Position</span>
                <strong>{money(analyticsData.maxPosition)}</strong>
              </div>
            </div>
          </div>

          <div className="card analytics-grid-8">
            <h3>
              <LineChart size={14} />
              Gewinn & Verlust Statistiken
            </h3>
            <div className="analytics-mini-grid analytics-eight">
              <div className="good">
                <span>Gewinner</span>
                <strong>{analyticsData.winners}</strong>
              </div>
              <div className="bad">
                <span>Verlierer</span>
                <strong>{analyticsData.losers}</strong>
              </div>
              <div className="good">
                <span>Σ Gewinne</span>
                <strong>{money(analyticsData.grossGain)}</strong>
              </div>
              <div className="bad">
                <span>Σ Verluste</span>
                <strong>{money(analyticsData.grossLoss)}</strong>
              </div>
              <div className="good">
                <span>Ø Gewinn</span>
                <strong>{money(analyticsData.avgGain)}</strong>
              </div>
              <div className="bad">
                <span>Ø Verlust</span>
                <strong>{money(analyticsData.avgLoss)}</strong>
              </div>
              <div className="good">
                <span>Profit-Faktor</span>
                <strong>{analyticsData.profitFactor.toFixed(2)}</strong>
              </div>
              <div>
                <span>Erwartungswert</span>
                <strong>{money(analyticsData.expectancy)}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>
              <ChartColumn size={14} />
              Gewinn/Verlust Verteilung
            </h3>
            <div className="simple-chart">
              {[
                { label: "<-500", min: -Infinity, max: -500, color: "loss" },
                { label: "-500..-200", min: -500, max: -200, color: "loss" },
                { label: "-200..-100", min: -200, max: -100, color: "loss" },
                { label: "-100..0", min: -100, max: 0, color: "loss" },
                { label: "0..100", min: 0, max: 100, color: "win" },
                { label: "100..200", min: 100, max: 200, color: "win" },
                { label: "200..500", min: 200, max: 500, color: "win" },
                { label: ">500", min: 500, max: Infinity, color: "win" }
              ].map((b) => {
                const count = analyticsData.closedCount
                  ? trades.filter((t) => {
                      const pl = getTradeRealizedPL(t);
                      return isTradeClosed(t) && pl >= b.min && pl < b.max;
                    }).length
                  : 0;
                return (
                  <div key={b.label} className="simple-bar-wrap">
                    <div className={`simple-bar ${b.color}`} style={{ height: `${Math.max(6, count * 6)}px` }} />
                    <span>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {analyticsTab === "timing" && (
        <div className="analytics-tab-panel">
          <div className="dashboard-bottom-grid">
            <div className="card">
              <h3>
                <TrendingUp size={14} />
                Monats-Performance
              </h3>
              <div className="simple-chart">
                {analyticsData.monthChart.map((m) => (
                  <div key={`m-${m.month}`} className="simple-bar-wrap">
                    <div className={`simple-bar ${m.pl >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(m.pl) / 35)}px` }} />
                    <span>{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>
                <Target size={14} />
                Win/Loss Verteilung
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
                  <span className="positive">{analyticsData.winners} Wins</span> / <span className="negative">{analyticsData.losers} Losses</span>
                </p>
              </div>
            </div>
          </div>

          <div className="dashboard-bottom-grid">
            <div className="card">
              <h3>
                <ChartColumn size={14} />
                Performance nach Wochentag
              </h3>
              <div className="simple-chart">
                {analyticsData.weekdayData.map((d) => (
                  <div key={`w-${d.label}`} className="simple-bar-wrap">
                    <div className={`simple-bar ${d.value >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(d.value) / 20)}px` }} />
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>
                <Briefcase size={14} />
                Trades nach Positionsgroesse
              </h3>
              <div className="simple-chart">
                {analyticsData.sizeData.map((d) => (
                  <div key={`s-${d.label}`} className="simple-bar-wrap">
                    <div className="simple-bar win" style={{ height: `${Math.max(8, d.value * 7)}px` }} />
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>
              <Clock3 size={14} />
              Performance nach Uhrzeit (Kauf)
            </h3>
            <div className="simple-chart">
              {analyticsData.hourData.map((d) => (
                <div key={`h-${d.label}`} className="simple-bar-wrap">
                  <div className={`simple-bar ${d.value >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(d.value) / 22)}px` }} />
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card analytics-grid-8">
            <h3>
              <Clock3 size={14} />
              Haltedauer-Analyse
            </h3>
            <div className="analytics-mini-grid analytics-eight">
              <div>
                <span>Ø Gesamt</span>
                <strong>{analyticsData.hold.avg.toFixed(1)} Tage</strong>
              </div>
              <div className="good">
                <span>Ø Wins</span>
                <strong>{analyticsData.hold.winAvg.toFixed(1)} Tage</strong>
              </div>
              <div className="bad">
                <span>Ø Losses</span>
                <strong>{analyticsData.hold.lossAvg.toFixed(1)} Tage</strong>
              </div>
              <div>
                <span>Max Haltedauer</span>
                <strong>{analyticsData.hold.max} Tage</strong>
              </div>
              <div>
                <span>Intraday</span>
                <strong>{analyticsData.hold.intraday}</strong>
              </div>
              <div>
                <span>1-7 Tage</span>
                <strong>{analyticsData.hold.oneTo7}</strong>
              </div>
              <div>
                <span>8-30 Tage</span>
                <strong>{analyticsData.hold.eightTo30}</strong>
              </div>
              <div>
                <span>30+ Tage</span>
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
                Performance pro Basiswert
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Basiswert</th>
                    <th>#</th>
                    <th>Win%</th>
                    <th>P&L</th>
                    <th>Rendite</th>
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
                Performance pro Trade-Typ
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>#</th>
                    <th>Win%</th>
                    <th>P&L</th>
                    <th>Rendite</th>
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
            Risiko-Kennzahlen
          </h3>
          <div className="analytics-mini-grid">
            <div>
              <span>Standardabweichung</span>
              <strong>{money(analyticsData.stdDev)}</strong>
            </div>
            <div className="bad">
              <span>Max. Drawdown</span>
              <strong>{money(analyticsData.maxDrawdown)}</strong>
            </div>
            <div>
              <span>Gesamtrendite</span>
              <strong className={analyticsData.returnPct >= 0 ? "positive" : "negative"}>{analyticsData.returnPct.toFixed(1)}%</strong>
            </div>
            <div className="bad">
              <span>Totalverluste</span>
              <strong>{analyticsData.totalLossTrades}</strong>
            </div>
            <div>
              <span>Profit-Faktor</span>
              <strong>{analyticsData.profitFactor.toFixed(2)}</strong>
            </div>
            <div>
              <span>Erwartungswert</span>
              <strong>{money(analyticsData.expectancy)}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
