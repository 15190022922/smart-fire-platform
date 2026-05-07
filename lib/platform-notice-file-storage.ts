import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type PlatformNoticeFileTarget = {
  folder: string;
  fileName: string;
  directoryPath: string;
  filePath: string;
  url: string;
};

export type PlatformNoticeFileReadResult = {
  fileName: string;
  size: number;
  contentType: string;
  body: Buffer;
};

const storageRoot = path.join(process.cwd(), "storage", "platform-notice-files");

export function sanitizeNoticeFilePathSegment(value: string, fallback = "attachment") {
  const base = path.basename(value || fallback).replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-");
  return base || fallback;
}

export function createNoticeAttachmentFolder() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function platformNoticeFileUrl(folder: string, fileName: string) {
  return `/api/platform-notice-files/${[folder, fileName].map(encodeURIComponent).join("/")}`;
}

export function createPlatformNoticeFileTarget(folder: string, fileName: string): PlatformNoticeFileTarget {
  const safeFolder = sanitizeNoticeFilePathSegment(folder, "upload");
  const safeFileName = sanitizeNoticeFilePathSegment(fileName, "attachment");
  const directoryPath = path.join(storageRoot, safeFolder);
  return {
    folder: safeFolder,
    fileName: safeFileName,
    directoryPath,
    filePath: path.join(directoryPath, safeFileName),
    url: platformNoticeFileUrl(safeFolder, safeFileName),
  };
}

export async function writePlatformNoticeFile(target: PlatformNoticeFileTarget, buffer: Buffer) {
  await mkdir(target.directoryPath, { recursive: true });
  await writeFile(target.filePath, buffer);
}

export function contentTypeForNoticeFile(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export async function readPlatformNoticeFile(parts: string[]): Promise<PlatformNoticeFileReadResult | null> {
  if (parts.length < 2) return null;

  const safeParts = parts.map((part) => sanitizeNoticeFilePathSegment(part, "attachment"));
  const resolved = path.resolve(storageRoot, ...safeParts);
  const root = path.resolve(storageRoot);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) return null;
    return {
      fileName: safeParts.at(-1) ?? "attachment",
      size: fileStat.size,
      contentType: contentTypeForNoticeFile(resolved),
      body: await readFile(resolved),
    };
  } catch {
    return null;
  }
}
