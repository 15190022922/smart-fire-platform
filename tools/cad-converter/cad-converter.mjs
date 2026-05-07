#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = __dirname;
const LOG_FILE_NAME = "conversion-log.txt";

function platformKey() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function executableNames(baseName) {
  if (process.platform === "win32") {
    const pathExt = process.env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"];
    const extensions = new Set(["", ...pathExt, ".exe", ".cmd", ".bat", ".com"].map((item) => item.toLowerCase()));
    return Array.from(extensions).map((extension) => (extension ? `${baseName}${extension}` : baseName));
  }
  return [baseName];
}

async function isFile(filePath) {
  try {
    await access(filePath);
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

async function childDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

async function converterIsUsable(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (![".bat", ".cmd"].includes(extension)) return true;

  try {
    const content = await readFile(filePath, "utf8");
    const autostartMatch = content.match(/-autostart\s+([^\s]+)/i);
    if (!autostartMatch) return true;
    const scriptPath = path.join(path.dirname(filePath), autostartMatch[1]);
    if (await isFile(scriptPath)) return true;
    return await isFile(path.join(path.dirname(filePath), "plugins", "qcadproscripts.dll"));
  } catch {
    return false;
  }
}

function candidateBaseNames(fileType) {
  if (fileType === "dxf") return ["dxf2svg", "dwg2svg"];
  return ["dwg2svg"];
}

function pathSearchDirs() {
  return (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function commonConverterDirs() {
  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, "QCAD"),
      path.join(root, "QCAD Professional"),
      path.join(root, "QCADCAM"),
      path.join(root, "ODA", "ODAFileConverter"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/QCAD.app/Contents/MacOS",
      "/Applications/QCADCAM.app/Contents/MacOS",
      "/usr/local/bin",
      "/opt/homebrew/bin",
    ];
  }
  return ["/usr/local/bin", "/usr/bin", "/opt/qcad", "/opt/qcadcam", "/opt/oda"];
}

async function findConverter(fileType = "dwg") {
  const bundledDir = path.join(TOOL_ROOT, "bin", platformKey());
  const searchDirs = [
    bundledDir,
    ...(await childDirs(bundledDir)),
    ...pathSearchDirs(),
    ...commonConverterDirs(),
  ];
  const seenDirs = new Set();
  const dirs = searchDirs.filter((dir) => {
    if (seenDirs.has(dir)) return false;
    seenDirs.add(dir);
    return true;
  });
  for (const baseName of candidateBaseNames(fileType)) {
    for (const executableName of executableNames(baseName)) {
      for (const dir of dirs) {
        const candidate = path.join(dir, executableName);
        if ((await isFile(candidate)) && (await converterIsUsable(candidate))) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function runCommand(bin, args, cwd) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const isWindowsBatch = process.platform === "win32" && [".bat", ".cmd"].includes(path.extname(bin).toLowerCase());
    const child = isWindowsBatch ? spawn("cmd.exe", ["/d", "/c", "call", bin, ...args], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }) : spawn(bin, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => resolve({ exitCode: null, stdout, stderr, error }));
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

async function writeLog(outputDir, lines) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, LOG_FILE_NAME), `${lines.filter(Boolean).join("\n")}\n`, "utf8");
}

async function check() {
  const requestedType = process.argv[3] === "dxf" ? "dxf" : "dwg";
  const converter = await findConverter(requestedType);
  if (!converter) {
    console.error(`missing: ${path.join("tools", "cad-converter", "bin", platformKey(), requestedType === "dxf" ? "dxf2svg" : "dwg2svg")}`);
    process.exit(1);
  }
  console.log(`ready: ${requestedType.toUpperCase()} converter found for ${platformKey()}`);
  console.log(`${requestedType}: ${converter}`);
}

async function convert(sourcePath, outputDir) {
  if (!sourcePath || !outputDir) {
    console.error("usage: cad-converter.mjs <sourceCadPath> <outputDir>");
    process.exit(2);
  }

  const extension = path.extname(sourcePath).toLowerCase();
  const fileType = extension === ".dxf" ? "dxf" : "dwg";
  const converter = await findConverter(fileType);
  const scenePath = path.join(outputDir, "scene.svg");

  if (!converter) {
    await writeLog(outputDir, [
      `status: missing converter`,
      `platform: ${platformKey()}`,
      `fileType: ${fileType}`,
      `expectedDir: ${path.join(TOOL_ROOT, "bin", platformKey())}`,
    ]);
    console.error(`missing converter for ${fileType}`);
    process.exit(3);
  }

  const result = await runCommand(converter, ["-o", scenePath, sourcePath], path.dirname(converter));
  await writeLog(outputDir, [
    `status: converter finished`,
    `platform: ${platformKey()}`,
    `fileType: ${fileType}`,
    `exitCode: ${result.exitCode ?? "error"}`,
    result.stdout ? `stdout: ${result.stdout.trim()}` : "",
    result.stderr ? `stderr: ${result.stderr.trim()}` : "",
    result.error ? `error: ${result.error.message}` : "",
  ]);

  if (result.error || result.exitCode !== 0) {
    console.error(result.error?.message ?? `converter exit code ${result.exitCode}`);
    process.exit(4);
  }

  if (!(await isFile(scenePath))) {
    console.error("converter did not generate scene.svg");
    process.exit(5);
  }
}

if (process.argv.includes("--check")) {
  await check();
} else {
  await convert(process.argv[2], process.argv[3]);
}
