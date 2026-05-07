import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type DrawingStorageDriver = "local" | "oss";

export type LocalDrawingWriteTarget = {
  tenantStorageId: string;
  folder: string;
  fileName: string;
  directoryPath: string;
  filePath: string;
  url: string;
};

export type LocalDrawingReadResult = {
  filePath: string;
  size: number;
  contentType: string;
  body: Buffer;
};

export class DrawingStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawingStorageConfigurationError";
  }
}

const storageRoot = path.join(process.cwd(), "storage", "drawings");

export function getDrawingStorageDriver(): DrawingStorageDriver {
  const value = process.env.DRAWING_STORAGE_DRIVER?.trim().toLowerCase();
  return value === "oss" ? "oss" : "local";
}

export function assertLocalDrawingStorage() {
  const driver = getDrawingStorageDriver();
  if (driver !== "local") {
    throw new DrawingStorageConfigurationError("当前版本尚未启用 OSS 图纸存储，请将 DRAWING_STORAGE_DRIVER 设置为 local。");
  }
}

export function sanitizeStoragePathSegment(value: string, fallback = "drawing-file") {
  const base = path.basename(value || fallback).replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-");
  return base || fallback;
}

export function createDrawingUploadFolder() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function drawingFileUrl(tenantId: string, folder: string, fileName: string) {
  const tenantStorageId = sanitizeStoragePathSegment(tenantId, "tenant");
  const encodedPath = [tenantStorageId, folder, fileName].map(encodeURIComponent).join("/");
  return `/api/tenant/drawing-files/${encodedPath}`;
}

export function createLocalDrawingWriteTarget(tenantId: string, folder: string, fileName: string): LocalDrawingWriteTarget {
  assertLocalDrawingStorage();
  const tenantStorageId = sanitizeStoragePathSegment(tenantId, "tenant");
  const safeFolder = sanitizeStoragePathSegment(folder, "upload");
  const safeFileName = sanitizeStoragePathSegment(fileName, "drawing-file");
  const directoryPath = path.join(storageRoot, tenantStorageId, safeFolder);
  return {
    tenantStorageId,
    folder: safeFolder,
    fileName: safeFileName,
    directoryPath,
    filePath: path.join(directoryPath, safeFileName),
    url: drawingFileUrl(tenantStorageId, safeFolder, safeFileName),
  };
}

export async function writeLocalDrawingFile(target: LocalDrawingWriteTarget, buffer: Buffer) {
  await mkdir(target.directoryPath, { recursive: true });
  await writeFile(target.filePath, buffer);
}

export function contentTypeForDrawingFile(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function readLocalDrawingFileForTenant(tenantId: string, parts: string[]): Promise<LocalDrawingReadResult | null> {
  assertLocalDrawingStorage();
  const tenantStorageId = sanitizeStoragePathSegment(tenantId, "tenant");
  if (parts.length < 3 || parts[0] !== tenantStorageId) return null;

  const resolved = path.resolve(storageRoot, ...parts);
  const tenantRoot = path.resolve(storageRoot, tenantStorageId);
  if (!resolved.startsWith(`${tenantRoot}${path.sep}`)) {
    throw new DrawingStorageConfigurationError("无效文件路径。");
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) return null;
    return {
      filePath: resolved,
      size: fileStat.size,
      contentType: contentTypeForDrawingFile(resolved),
      body: await readFile(resolved),
    };
  } catch {
    return null;
  }
}
