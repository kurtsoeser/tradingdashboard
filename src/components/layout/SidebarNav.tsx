import { BarChart3, CandlestickChart, Database, LayoutDashboard } from "lucide-react";
import type { View } from "../../app/types";

interface SidebarNavProps {
  view: View;
  onViewChange: (view: View) => void;
}

export function SidebarNav({ view, onViewChange }: SidebarNavProps) {
  return (
    <aside className="sidebar">
      <div className="brand">Trading Dashboard</div>
      <div className="menu">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => onViewChange("dashboard")}>
          <LayoutDashboard size={15} />
          Dashboard
        </button>
        <button className={view === "trades" ? "active" : ""} onClick={() => onViewChange("trades")}>
          <CandlestickChart size={15} />
          Trades
        </button>
        <button className={view === "assets" ? "active" : ""} onClick={() => onViewChange("assets")}>
          <Database size={15} />
          Basiswerte
        </button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => onViewChange("analytics")}>
          <BarChart3 size={15} />
          Auswertungen
        </button>
      </div>
    </aside>
  );
}
