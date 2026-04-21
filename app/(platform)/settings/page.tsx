import { SettingsManager } from "@/components/settings/settings-manager";
import { systemSettings } from "@/data/platform-data";

export default function SettingsPage() {
  return <SettingsManager initialSettings={systemSettings} />;
}
