import { InspectionBoard } from "@/components/inspection/inspection-board";
import { getInspectionCenterData } from "@/lib/db";
import { getServerSession } from "@/lib/server-auth";

export default async function InspectionPage() {
  const session = await getServerSession();
  const initialData = session?.tenantId ? await getInspectionCenterData(session.tenantId) : null;

  return <InspectionBoard initialData={initialData} />;
}
