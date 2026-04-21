import { DeviceManager } from "@/components/devices/device-manager";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ deviceId?: string }>;
}) {
  const params = await searchParams;

  return <DeviceManager initialDeviceId={params.deviceId} />;
}
