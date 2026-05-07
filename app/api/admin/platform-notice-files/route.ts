import {
  contentTypeForNoticeFile,
  createNoticeAttachmentFolder,
  createPlatformNoticeFileTarget,
  sanitizeNoticeFilePathSegment,
  writePlatformNoticeFile,
} from "@/lib/platform-notice-file-storage";
import { getServerSession } from "@/lib/server-auth";
import { bootstrapDatabase } from "@/packages/database/src/bootstrap";
import { platformNoticeRepository } from "@/packages/database/src/ops-repositories";

export const runtime = "nodejs";

const maxFileSize = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (session?.scope !== "platform") {
    return Response.json({ message: "无权上传平台通知附件" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "缺少附件文件" }, { status: 400 });
  }
  if (file.size > maxFileSize) {
    return Response.json({ message: "附件不能超过 20MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = createNoticeAttachmentFolder();
  const originalFileName = sanitizeNoticeFilePathSegment(file.name, "attachment");
  const target = createPlatformNoticeFileTarget(folder, originalFileName);
  await writePlatformNoticeFile(target, buffer);
  await bootstrapDatabase({ includeDemoSeed: false });
  const attachment = await platformNoticeRepository.createUploadedPlatformNoticeAttachment({
    name: originalFileName,
    url: target.url,
    size: buffer.length,
    contentType: file.type || contentTypeForNoticeFile(originalFileName),
    storageKey: `${target.folder}/${target.fileName}`,
    uploadedByName: session.displayName || session.username,
    uploadedByRole: String(session.roleKey ?? "platform_super_admin"),
  });

  return Response.json({
    attachment,
  });
}
