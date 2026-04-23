import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/ingestion/event", {
    method: "POST",
    session,
    body,
  });
}
