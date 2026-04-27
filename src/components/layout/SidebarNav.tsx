import { BarChart3, BookMarked, CandlestickChart, Database, LayoutDashboard, Moon, Route, Search, Settings2, Sparkles, Sun } from "lucide-react";
import { t } from "../../app/i18n";
import type { View } from "../../app/types";
import type { AppSettings } from "../../app/settings";

interface SidebarNavProps {
  view: View;
  onViewChange: (view: View) => void;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  language: AppSettings["language"];
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
}

export function SidebarNav({
  view,
  onViewChange,
  theme,
  onThemeChange,
  language,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu
}: SidebarNavProps) {
  const handleViewChange = (nextView: View) => {
    onViewChange(nextView);
    onCloseMobileMenu();
  };

  return (
    <>
      <div className="mobile-nav-header">
        <button className="secondary mobile-menu-toggle" onClick={onToggleMobileMenu} aria-expanded={mobileMenuOpen} aria-label={t(language, "ariaOpenMenu")}>
          <LayoutDashboard size={16} />
          {t(language, "menu")}
        </button>
        <div className="mobile-nav-brand">Trading Dashboard</div>
      </div>

      {mobileMenuOpen && <button className="mobile-menu-backdrop" onClick={onCloseMobileMenu} aria-label={t(language, "ariaCloseMenu")} />}

      <aside className={`sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="brand">Trading Dashboard</div>
        <div className="menu">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => handleViewChange("dashboard")}>
            <LayoutDashboard size={15} />
            {t(language, "navDashboard")}
          </button>
          <button className={view === "trades" ? "active" : ""} onClick={() => handleViewChange("trades")}>
            <CandlestickChart size={15} />
            {t(language, "navTrades")}
          </button>
          <button className={view === "assets" ? "active" : ""} onClick={() => handleViewChange("assets")}>
            <Database size={15} />
            {t(language, "navAssets")}
          </button>
          <button className={view === "analytics" ? "active" : ""} onClick={() => handleViewChange("analytics")}>
            <BarChart3 size={15} />
            {t(language, "navAnalytics")}
          </button>
          <button className={view === "journal" ? "active" : ""} onClick={() => handleViewChange("journal")}>
            <BookMarked size={15} />
            {t(language, "navJournal")}
          </button>
          <div className={`sidebar-ai-submenu ${view === "aiAssistant" || view === "aiAssistantPlan" ? "is-ai-section" : ""}`}>
            <button className={view === "aiAssistant" ? "active" : ""} onClick={() => handleViewChange("aiAssistant")}>
              <Sparkles size={15} />
              {t(language, "navAiAssistant")}
            </button>
            <button
              type="button"
              className={`ai-submenu-btn ${view === "aiAssistantPlan" ? "active" : ""}`}
              onClick={() => handleViewChange("aiAssistantPlan")}
            >
              <Route size={14} aria-hidden />
              {t(language, "navAiRoadmap")}
            </button>
          </div>
          <button className={view === "isinLive" ? "active" : ""} onClick={() => handleViewChange("isinLive")}>
            <Search size={15} />
            {t(language, "navIsinLive")}
          </button>
        </div>
        <div className="sidebar-theme-switcher">
          <button className={`secondary theme-switch-btn ${view === "settings" ? "active" : ""}`} onClick={() => handleViewChange("settings")}>
            <Settings2 size={14} />
            {t(language, "navSettings")}
          </button>
          <button className="secondary theme-switch-btn" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? t(language, "themeLight") : t(language, "themeDark")}
          </button>
        </div>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => handleViewChange("dashboard")} aria-label={t(language, "navDashboard")}>
          <LayoutDashboard size={16} />
          <span>{t(language, "navDashboard")}</span>
        </button>
        <button className={view === "trades" ? "active" : ""} onClick={() => handleViewChange("trades")} aria-label={t(language, "navTrades")}>
          <CandlestickChart size={16} />
          <span>{t(language, "navTrades")}</span>
        </button>
        <button className={view === "assets" ? "active" : ""} onClick={() => handleViewChange("assets")} aria-label={t(language, "navAssets")}>
          <Database size={16} />
          <span>{t(language, "navAssets")}</span>
        </button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => handleViewChange("analytics")} aria-label={t(language, "navAnalytics")}>
          <BarChart3 size={16} />
          <span>{t(language, "navAnalytics")}</span>
        </button>
        <button className={view === "journal" ? "active" : ""} onClick={() => handleViewChange("journal")} aria-label={t(language, "navJournal")}>
          <BookMarked size={16} />
          <span>{t(language, "navJournal")}</span>
        </button>
        <button
          className={view === "aiAssistant" || view === "aiAssistantPlan" ? "active" : ""}
          onClick={() => handleViewChange("aiAssistant")}
          aria-label={t(language, "navAiAssistant")}
        >
          <Sparkles size={16} />
          <span>{t(language, "navAiAssistant")}</span>
        </button>
        <button className={view === "isinLive" ? "active" : ""} onClick={() => handleViewChange("isinLive")} aria-label={t(language, "navIsinLive")}>
          <Search size={16} />
          <span>{t(language, "navIsinLive")}</span>
        </button>
        <button className={view === "settings" ? "active" : ""} onClick={() => handleViewChange("settings")} aria-label={t(language, "navSettings")}>
          <Settings2 size={16} />
          <span>{t(language, "navSettings")}</span>
        </button>
      </nav>
    </>
  );
}
