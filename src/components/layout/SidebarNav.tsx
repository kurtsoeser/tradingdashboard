import { BarChart3, CandlestickChart, Database, LayoutDashboard, Moon, Settings2, Sun } from "lucide-react";
import { t } from "../../app/i18n";
import type { View } from "../../app/types";
import type { AppSettings } from "../../app/settings";

interface SidebarNavProps {
  view: View;
  onViewChange: (view: View) => void;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  language: AppSettings["language"];
}

export function SidebarNav({ view, onViewChange, theme, onThemeChange, language }: SidebarNavProps) {
  return (
    <aside className="sidebar">
      <div className="brand">Trading Dashboard</div>
      <div className="menu">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => onViewChange("dashboard")}>
          <LayoutDashboard size={15} />
          {t(language, "navDashboard")}
        </button>
        <button className={view === "trades" ? "active" : ""} onClick={() => onViewChange("trades")}>
          <CandlestickChart size={15} />
          {t(language, "navTrades")}
        </button>
        <button className={view === "assets" ? "active" : ""} onClick={() => onViewChange("assets")}>
          <Database size={15} />
          {t(language, "navAssets")}
        </button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => onViewChange("analytics")}>
          <BarChart3 size={15} />
          {t(language, "navAnalytics")}
        </button>
      </div>
      <div className="sidebar-theme-switcher">
        <button className={`secondary theme-switch-btn ${view === "settings" ? "active" : ""}`} onClick={() => onViewChange("settings")}>
          <Settings2 size={14} />
          {t(language, "navSettings")}
        </button>
        <button className="secondary theme-switch-btn" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {theme === "dark" ? t(language, "themeLight") : t(language, "themeDark")}
        </button>
      </div>
    </aside>
  );
}
