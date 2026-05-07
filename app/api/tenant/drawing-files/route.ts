import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocalDrawingWriteTarget } from "@/lib/drawing-storage";
import {
  createDrawingUploadFolder,
  createLocalDrawingWriteTarget,
  drawingFileUrl,
  DrawingStorageConfigurationError,
  sanitizeStoragePathSegment,
  writeLocalDrawingFile,
} from "@/lib/drawing-storage";
import { getServerSession } from "@/lib/server-auth";

export const runtime = "nodejs";

const pdfSize = { width: 1000, height: 1414 };
const pdfPreviewBounds = { width: 1800, height: 1400 };

function detectFileType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

function isCadFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".dwg") || name.endsWith(".dxf");
}

function readPngSize(buffer: Buffer) {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

function readImageSize(buffer: Buffer) {
  return readPngSize(buffer) ?? readJpegSize(buffer) ?? { width: 1600, height: 900 };
}

async function readPdfSize(buffer: Buffer) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
    });
    const pdfDocument = await loadingTask.promise;
    try {
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      return {
        width: Math.max(1, Math.round(viewport.width)),
        height: Math.max(1, Math.round(viewport.height)),
      };
    } finally {
      await pdfDocument.destroy();
    }
  } catch {
    return pdfSize;
  }
}

async function createPdfPreview(buffer: Buffer, targetDir: string, tenantId: string, folder: string, originalFileName: string) {
  try {
    const [{ createCanvas }, pdfjs] = await Promise.all([
      import("@napi-rs/canvas"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
    ]);
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
    });
    const pdfDocument = await loadingTask.promise;

    try {
      const page = await pdfDocument.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        pdfPreviewBounds.width / baseViewport.width,
        pdfPreviewBounds.height / baseViewport.height,
        1,
      );
      const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
      const canvas = createCanvas(Math.max(1, Math.round(viewport.width)), Math.max(1, Math.round(viewport.height)));
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      const previewName = `${originalFileName.replace(/\.[^.]+$/, "") || "drawing"}.preview.png`;
      const previewPath = path.join(targetDir, previewName);
      await writeFile(previewPath, canvas.toBuffer("image/png"));

      return {
        url: drawingFileUrl(tenantId, folder, previewName),
        width: canvas.width,
        height: canvas.height,
        log: `converter: PDF 首页已生成 PNG 预览 ${canvas.width} x ${canvas.height}。`,
      };
    } finally {
      await pdfDocument.destroy();
    }
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return Response.json({ message: "未登录企业账号" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "缺少图纸文件" }, { status: 400 });
  }

  const fileType = detectFileType(file);
  if (isCadFile(file)) {
    return Response.json({ message: "请先在 CAD 软件中导出 PDF 后上传。" }, { status: 400 });
  }
  if (!fileType) {
    return Response.json({ message: "仅支持图片或 PDF 图纸，请先将 CAD 导出为 PDF 后上传。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = createDrawingUploadFolder();
  const originalFileName = sanitizeStoragePathSegment(file.name, "drawing-file");
  let target: LocalDrawingWriteTarget;

  try {
    target = createLocalDrawingWriteTarget(session.tenantId, folder, originalFileName);
    await writeLocalDrawingFile(target, buffer);
  } catch (error) {
    if (error instanceof DrawingStorageConfigurationError) {
      return Response.json({ message: error.message }, { status: 501 });
    }
    throw error;
  }

  const pdfPreview =
    fileType === "pdf"
      ? await createPdfPreview(buffer, target.directoryPath, target.tenantStorageId, target.folder, target.fileName)
      : null;

  const fileUrl = target.url;
  const visualUrl = pdfPreview?.url ?? fileUrl;
  const sceneUrl = pdfPreview?.url ?? fileUrl;
  const size = pdfPreview ?? (fileType === "pdf" ? await readPdfSize(buffer) : readImageSize(buffer));
  const processingStatus = "ready";
  const processingMessage = "图纸已生成可视化场景。";
  const conversionLog = [
    "uploaded: 原始文件已保存到本地存储。",
    ...(fileType === "pdf"
      ? [pdfPreview?.log ?? "viewer: PDF 将使用 PDF.js canvas 渲染首页。"]
      : ["viewer: 图片将作为高清底图展示。"]),
  ];

  return Response.json({
    fileUrl,
    sourceFileUrl: fileUrl,
    previewUrl: visualUrl,
    sceneUrl,
    fileType,
    originalFileName,
    fileSize: buffer.length,
    processingStatus,
    processingMessage,
    conversionLog,
    width: size.width,
    height: size.height,
  });
}
