import { AlarmRealtimePanel } from "@/components/dashboard/alarm-realtime-panel";
import { DashboardChartsPanel } from "@/components/dashboard/dashboard-charts-panel";
import { DashboardTopMetrics } from "@/components/dashboard/dashboard-top-metrics";
import { InteractiveMapPanel } from "@/components/dashboard/interactive-map-panel";
import {
  alarmFeed,
  alarmTrendData,
  alarmTypeStats,
  dashboardMetrics,
  deviceOverview,
  floorZones,
} from "@/data/platform-data";

export default function VisualizationPage() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[72px_minmax(0,1fr)_172px] gap-4 overflow-hidden pt-1">
      <DashboardTopMetrics metrics={dashboardMetrics} />

      <section className="grid min-h-0 gap-4 pt-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <InteractiveMapPanel zones={floorZones} />

        <div className="grid min-h-0 gap-4 pt-1">
          <AlarmRealtimePanel alarms={alarmFeed} />
        </div>
      </section>

      <DashboardChartsPanel
        trendData={alarmTrendData}
        overview={deviceOverview}
        typeStats={alarmTypeStats}
      />
    </div>
  );
}
