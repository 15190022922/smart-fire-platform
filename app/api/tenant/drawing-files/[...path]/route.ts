import { DrawingStorageConfigurationError, readLocalDrawingFileForTenant } from "@/lib/drawing-storage";
import { getServerSession } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return Response.json({ message: "未登录企业账号" }, { status: 401 });
  }

  const params = await context.params;
  const parts = params.path ?? [];

  try {
    const file = await readLocalDrawingFileForTenant(session.tenantId, parts);
    if (!file) {
      return Response.json({ message: "无权访问该图纸文件或文件不存在" }, { status: 404 });
    }

    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof DrawingStorageConfigurationError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    return Response.json({ message: "文件不存在" }, { status: 404 });
  }
}
