import * as XLSX from "xlsx";
import { getBackendBaseUrl, buildBackendHeaders } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";

export const runtime = "nodejs";

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    return Boolean(sheet?.["!ref"]);
  });
  if (!sheetName) {
    throw new Error("Excel 文件没有可读取的工作表");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const headerRow = rows.find((row) => row.some((cell) => normalizeCell(cell))) ?? [];
  const headers = headerRow.map(normalizeCell);
  const nonEmptyHeaderIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter((item) => item.header)
    .map((item) => item.index);
  const headerRowIndex = rows.indexOf(headerRow);

  return {
    sheetName,
    headers: nonEmptyHeaderIndexes.map((index) => headers[index]),
    rows: rows
      .slice(headerRowIndex + 1)
      .map((row, index) => {
        const values = Object.fromEntries(nonEmptyHeaderIndexes.map((columnIndex) => [headers[columnIndex], normalizeCell(row[columnIndex])]));
        return { rowNumber: headerRowIndex + index + 2, values };
      })
      .filter((row) => Object.values(row.values).some((value) => value)),
  };
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "缺少 Excel 文件" }, { status: 400 });
  }

  try {
    const parsed = parseWorkbook(Buffer.from(await file.arrayBuffer()));
    const response = await fetch(`${getBackendBaseUrl()}/api/tenant/device-import/preview`, {
      method: "POST",
      headers: buildBackendHeaders(session),
      body: JSON.stringify({ fileName: file.name, ...parsed }),
      cache: "no-store",
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel 文件解析失败";
    return Response.json({ message }, { status: 400 });
  }
}
