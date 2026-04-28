import { getServerSession } from "@/lib/server-auth";
import { decodeSession } from "@/lib/auth";
import { proxyBackendStream } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pinnedSession = decodeSession(searchParams.get("session") ?? "");
  const session = pinnedSession ?? (await getServerSession());
  return proxyBackendStream("/api/tenant/realtime-events", { method: "GET", session });
}
