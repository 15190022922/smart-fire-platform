import { readPlatformNoticeFile } from "@/lib/platform-notice-file-storage";
import { getServerSession } from "@/lib/server-auth";

export const runtime = "nodejs";

function contentDispositionFileName(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const session = await getServerSession();
  if (!session?.scope) {
    return Response.json({ message: "请先登录后下载附件" }, { status: 401 });
  }

  const params = await context.params;
  const file = await readPlatformNoticeFile(params.path ?? []);
  if (!file) {
    return Response.json({ message: "附件不存在" }, { status: 404 });
  }

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": contentDispositionFileName(file.fileName),
      "Cache-Control": "private, max-age=300",
    },
  });
}
