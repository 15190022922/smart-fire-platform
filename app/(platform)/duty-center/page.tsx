import { DutyCenterBoard } from "@/components/duty/duty-center-board";
import { getServerSession } from "@/lib/server-auth";
import { getDutyCenterData } from "@/lib/db";

export default async function DutyCenterPage() {
  const session = await getServerSession();
  const initialData = session?.tenantId ? await getDutyCenterData(session.tenantId) : null;

  return <DutyCenterBoard initialData={initialData} />;
}
