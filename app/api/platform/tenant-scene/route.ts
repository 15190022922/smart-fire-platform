import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getTenantById, getTenantSpatialModel, listTenantDevices } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权访问企业模拟视图" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ message: "缺少 tenantId" }, { status: 400 });
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ message: "未找到企业" }, { status: 404 });
  }

  const [spatialModel, devices] = await Promise.all([getTenantSpatialModel(tenantId), listTenantDevices(tenantId)]);

  return NextResponse.json({
    tenant,
    spatialModel,
    devices,
  });
}
