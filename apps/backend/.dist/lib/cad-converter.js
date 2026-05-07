"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAD_DEFAULT_SIZE = void 0;
exports.getCadConverterStatus = getCadConverterStatus;
exports.convertCadToScene = convertCadToScene;
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
exports.CAD_DEFAULT_SIZE = { width: 1600, height: 900 };
const DEFAULT_TIMEOUT_MS = 900000;
const MAX_TIMEOUT_MS = 900000;
const CHECK_TIMEOUT_MS = 5000;
const MAX_CAPTURED_LOG = 12000;
const CAD_TOOL_ROOT = node_path_1.default.join(process.cwd(), "tools", "cad-converter");
const CAD_WRAPPER_PATH = node_path_1.default.join(CAD_TOOL_ROOT, "cad-converter.mjs");
const CAD_SVG_MAX_DISPLAY_SIDE = 1800;
const CAD_SVG_DISPLAY_STYLE_ID = "smart-fire-cad-svg-display";
const CAD_SVG_DISPLAY_STYLE = `<style id="${CAD_SVG_DISPLAY_STYLE_ID}">
path,line,polyline,polygon,rect,circle,ellipse {
  vector-effect: non-scaling-stroke;
  stroke-width: 1px !important;
}
[style*="stroke:#000000"],[style*="stroke: #000000"],[stroke="#000000"] {
  stroke: #d8e4f0 !important;
}
[style*="fill:#000000"],[style*="fill: #000000"],[fill="#000000"] {
  fill: #d8e4f0 !important;
}
</style>`;
function fail(message, log = []) {
    return {
        status: "failed",
        width: exports.CAD_DEFAULT_SIZE.width,
        height: exports.CAD_DEFAULT_SIZE.height,
        message,
        log,
    };
}
function boundedTimeout(value, fallback = DEFAULT_TIMEOUT_MS) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return Math.min(Math.max(Math.round(parsed), 1000), MAX_TIMEOUT_MS);
}
function formatTimeoutMs(timeoutMs) {
    const minutes = Math.max(1, Math.round(timeoutMs / 60000));
    return `${minutes} 分钟`;
}
function appendLimited(current, chunk) {
    if (current.length >= MAX_CAPTURED_LOG)
        return current;
    return (current + chunk.toString("utf8")).slice(0, MAX_CAPTURED_LOG);
}
async function fileExists(filePath) {
    try {
        await (0, promises_1.access)(filePath);
        const fileStat = await (0, promises_1.stat)(filePath);
        return fileStat.isFile() && fileStat.size > 0;
    }
    catch {
        return false;
    }
}
async function pathExists(filePath) {
    try {
        await (0, promises_1.access)(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function parseSvgLength(value) {
    if (!value)
        return 0;
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
}
function normalizeSvgDisplaySize(width, height) {
    if (width <= 0 || height <= 0)
        return exports.CAD_DEFAULT_SIZE;
    const maxSide = Math.max(width, height);
    if (maxSide <= CAD_SVG_MAX_DISPLAY_SIDE) {
        return { width: Math.round(width), height: Math.round(height) };
    }
    const ratio = CAD_SVG_MAX_DISPLAY_SIDE / maxSide;
    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
}
function readSvgTagSize(svgTag) {
    const width = parseSvgLength(svgTag.match(/\bwidth=["']([^"']+)["']/i)?.[1]);
    const height = parseSvgLength(svgTag.match(/\bheight=["']([^"']+)["']/i)?.[1]);
    if (width > 0 && height > 0)
        return { width, height };
    const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    const viewBoxParts = viewBox?.split(/[\s,]+/).map(Number).filter(Number.isFinite) ?? [];
    if (viewBoxParts.length === 4 && viewBoxParts[2] > 0 && viewBoxParts[3] > 0) {
        return { width: viewBoxParts[2], height: viewBoxParts[3] };
    }
    return null;
}
async function readSvgSize(scenePath) {
    try {
        const svg = await (0, promises_1.readFile)(scenePath, "utf8");
        const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
        const size = readSvgTagSize(svgTag);
        if (size)
            return normalizeSvgDisplaySize(size.width, size.height);
    }
    catch {
        // Keep the default size when the converter generated an SVG without dimensions.
    }
    return exports.CAD_DEFAULT_SIZE;
}
async function makeCadSvgReadable(scenePath) {
    try {
        const svg = await (0, promises_1.readFile)(scenePath, "utf8");
        let nextSvg = svg;
        const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
        if (svgTag) {
            const sourceSize = readSvgTagSize(svgTag);
            if (sourceSize) {
                const displaySize = normalizeSvgDisplaySize(sourceSize.width, sourceSize.height);
                let nextTag = svgTag;
                nextTag = /\bwidth=["'][^"']+["']/i.test(nextTag)
                    ? nextTag.replace(/\bwidth=["'][^"']+["']/i, `width="${displaySize.width}"`)
                    : nextTag.replace(/<svg\b/i, `<svg width="${displaySize.width}"`);
                nextTag = /\bheight=["'][^"']+["']/i.test(nextTag)
                    ? nextTag.replace(/\bheight=["'][^"']+["']/i, `height="${displaySize.height}"`)
                    : nextTag.replace(/<svg\b/i, `<svg height="${displaySize.height}"`);
                nextSvg = nextSvg.replace(svgTag, nextTag);
            }
        }
        if (!nextSvg.includes(CAD_SVG_DISPLAY_STYLE_ID)) {
            nextSvg = nextSvg.replace(/(<svg\b[^>]*>)/i, `$1\n    ${CAD_SVG_DISPLAY_STYLE}`);
        }
        if (nextSvg !== svg) {
            await (0, promises_1.writeFile)(scenePath, nextSvg, "utf8");
        }
    }
    catch {
        // A generated SVG without post-processing can still be served; the UI will show the converter log if it fails.
    }
}
async function readConverterLog(outputDir) {
    const logPath = node_path_1.default.join(outputDir, "conversion-log.txt");
    try {
        const content = await (0, promises_1.readFile)(logPath, "utf8");
        return content
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 20);
    }
    catch {
        return [];
    }
}
function splitArgs(value) {
    const args = [];
    const matcher = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match;
    while ((match = matcher.exec(value)) !== null) {
        args.push(match[1] ?? match[2] ?? match[3] ?? "");
    }
    return args;
}
function templateReplace(value, token, replacement) {
    return value.split(token).join(replacement);
}
function applyTemplate(args, sourcePath, outputDir) {
    const outputFile = node_path_1.default.join(outputDir, "scene.svg");
    return args.map((arg) => templateReplace(templateReplace(templateReplace(arg, "{input}", sourcePath), "{output}", outputDir), "{outputFile}", outputFile));
}
function envCommand() {
    const converterBin = process.env.CAD_CONVERTER_BIN?.trim();
    if (!converterBin)
        return null;
    const argsTemplate = process.env.CAD_CONVERTER_ARGS?.trim()
        ? splitArgs(process.env.CAD_CONVERTER_ARGS)
        : ["{input}", "{output}"];
    return {
        bin: converterBin,
        argsTemplate,
        source: "env",
        displayName: "CAD_CONVERTER_BIN 运维覆盖项",
    };
}
function executableNames(baseName) {
    if (process.platform !== "win32")
        return [baseName];
    const pathExt = process.env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"];
    const extensions = new Set(["", ...pathExt, ".exe", ".cmd", ".bat", ".com"].map((item) => item.toLowerCase()));
    return Array.from(extensions).map((extension) => (extension ? `${baseName}${extension}` : baseName));
}
function converterBaseNames(fileType) {
    return fileType === "dxf" ? ["dxf2svg", "dwg2svg"] : ["dwg2svg"];
}
function pathSearchDirs() {
    return (process.env.PATH ?? "")
        .split(node_path_1.default.delimiter)
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
            node_path_1.default.join(root, "QCAD"),
            node_path_1.default.join(root, "QCAD Professional"),
            node_path_1.default.join(root, "QCADCAM"),
            node_path_1.default.join(root, "ODA", "ODAFileConverter"),
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
async function findSystemConverter(fileType) {
    const dirs = [...pathSearchDirs(), ...commonConverterDirs()];
    for (const dir of dirs) {
        for (const baseName of converterBaseNames(fileType)) {
            for (const executableName of executableNames(baseName)) {
                const candidate = node_path_1.default.join(dir, executableName);
                if (await fileExists(candidate))
                    return candidate;
            }
        }
    }
    return null;
}
async function systemCommand(fileType) {
    const converterBin = await findSystemConverter(fileType);
    if (!converterBin)
        return null;
    return {
        bin: converterBin,
        argsTemplate: ["{input}", "{outputFile}"],
        source: "system",
        displayName: "本机 CAD 转换器",
    };
}
async function builtinCommand(fileType) {
    if (!(await pathExists(CAD_WRAPPER_PATH)))
        return null;
    return {
        bin: process.execPath,
        argsTemplate: [CAD_WRAPPER_PATH, "{input}", "{output}"],
        checkArgs: [CAD_WRAPPER_PATH, "--check", fileType],
        source: "builtin",
        displayName: "平台内置 CAD 转换器",
    };
}
function runCommand(bin, args, cwd, timeoutMs) {
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        let timedOut = false;
        let timer;
        const startedAt = Date.now();
        const child = (0, node_child_process_1.spawn)(bin, args, {
            cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            if (timer)
                clearTimeout(timer);
            resolve({
                ...result,
                stdout,
                stderr,
                timedOut,
                elapsedMs: Date.now() - startedAt,
            });
        };
        const terminateChild = () => {
            if (process.platform === "win32" && child.pid) {
                const taskkill = (0, node_child_process_1.spawn)("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
                    windowsHide: true,
                    stdio: "ignore",
                });
                taskkill.on("error", () => {
                    child.kill();
                });
                return;
            }
            child.kill();
        };
        timer = setTimeout(() => {
            timedOut = true;
            terminateChild();
        }, timeoutMs);
        child.stdout?.on("data", (chunk) => {
            stdout = appendLimited(stdout, chunk);
        });
        child.stderr?.on("data", (chunk) => {
            stderr = appendLimited(stderr, chunk);
        });
        child.on("error", (error) => finish({ exitCode: null, error }));
        child.on("close", (exitCode) => finish({ exitCode }));
    });
}
async function checkBuiltin(command) {
    const result = await runCommand(command.bin, command.checkArgs ?? [], process.cwd(), CHECK_TIMEOUT_MS);
    const log = [
        `source: ${command.displayName}`,
        `elapsed: ${result.elapsedMs}ms`,
        result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : "",
        result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : "",
    ].filter(Boolean);
    if (result.timedOut) {
        return {
            status: "timeout",
            available: false,
            source: command.source,
            displayName: command.displayName,
            detail: "平台 CAD 转换器检查超时。",
            log,
        };
    }
    if (result.error || result.exitCode !== 0) {
        return {
            status: "missing",
            available: false,
            source: command.source,
            displayName: command.displayName,
            detail: "平台 CAD 转换器未安装或未被检测到。",
            log,
        };
    }
    return {
        status: "available",
        available: true,
        source: command.source,
        displayName: command.displayName,
        detail: "平台 CAD 转换器已就绪。",
        log,
    };
}
async function resolveConverterCommand(fileType) {
    const builtin = await builtinCommand(fileType);
    if (builtin) {
        const status = await checkBuiltin(builtin);
        if (status.available)
            return { command: builtin, status };
        const fallback = envCommand();
        if (fallback) {
            return {
                command: fallback,
                status: {
                    status: "available",
                    available: true,
                    source: fallback.source,
                    displayName: fallback.displayName,
                    detail: "内置 CAD 转换器不可用，已使用 CAD_CONVERTER_BIN 覆盖配置。",
                    log: [...status.log, "fallback: CAD_CONVERTER_BIN is configured"],
                },
            };
        }
        const systemFallback = await systemCommand(fileType);
        if (systemFallback) {
            return {
                command: systemFallback,
                status: {
                    status: "available",
                    available: true,
                    source: systemFallback.source,
                    displayName: systemFallback.displayName,
                    detail: "内置 CAD 转换器不可用，已自动使用本机可用转换器。",
                    log: [...status.log, `fallback: ${systemFallback.bin}`],
                },
            };
        }
        return { command: null, status };
    }
    const fallback = envCommand();
    if (fallback) {
        return {
            command: fallback,
            status: {
                status: "available",
                available: true,
                source: fallback.source,
                displayName: fallback.displayName,
                detail: "已使用 CAD_CONVERTER_BIN 覆盖配置。",
                log: ["source: CAD_CONVERTER_BIN override"],
            },
        };
    }
    const systemFallback = await systemCommand(fileType);
    if (systemFallback) {
        return {
            command: systemFallback,
            status: {
                status: "available",
                available: true,
                source: systemFallback.source,
                displayName: systemFallback.displayName,
                detail: "已自动使用本机可用 CAD 转换器。",
                log: [`source: ${systemFallback.bin}`],
            },
        };
    }
    return {
        command: null,
        status: {
            status: "missing",
            available: false,
            displayName: "平台内置 CAD 转换器",
            detail: "平台未检测到可用 CAD 转换器。",
            log: ["source: no bundled converter and no CAD_CONVERTER_BIN override"],
        },
    };
}
async function getCadConverterStatus() {
    let builtinStatus = null;
    const builtin = await builtinCommand("dwg");
    if (builtin) {
        const status = await checkBuiltin(builtin);
        if (status.available)
            return status;
        builtinStatus = status;
    }
    const fallback = envCommand();
    if (fallback) {
        const pathLooksLocal = node_path_1.default.isAbsolute(fallback.bin);
        const exists = pathLooksLocal ? await pathExists(fallback.bin) : true;
        return {
            status: exists ? "available" : "failed",
            available: exists,
            source: fallback.source,
            displayName: fallback.displayName,
            detail: exists
                ? "CAD_CONVERTER_BIN 已作为运维覆盖配置启用。"
                : "CAD_CONVERTER_BIN 指向的文件不存在。",
            log: ["source: CAD_CONVERTER_BIN override"],
        };
    }
    const systemFallback = await systemCommand("dwg");
    if (systemFallback) {
        return {
            status: "available",
            available: true,
            source: systemFallback.source,
            displayName: systemFallback.displayName,
            detail: "已自动检测到本机 CAD 转换器。",
            log: [`source: ${systemFallback.bin}`],
        };
    }
    return {
        status: builtinStatus?.status ?? "missing",
        available: false,
        source: builtinStatus?.source,
        displayName: builtinStatus?.displayName ?? "平台内置 CAD 转换器",
        detail: builtinStatus?.detail ?? "未检测到内置 CAD 转换器。",
        log: builtinStatus?.log ?? ["source: no bundled converter and no CAD_CONVERTER_BIN override"],
    };
}
async function convertCadToScene(input) {
    const resolved = await resolveConverterCommand(input.fileType);
    const baseLog = [
        `converter: received ${input.fileType.toUpperCase()} drawing ${input.originalFileName}`,
        `converter: ${resolved.status.detail}`,
    ];
    if (!resolved.command) {
        return fail("CAD 转换服务未启用：平台未检测到可用转换器。请上传 PDF 导出版，或联系平台管理员补齐 CAD 转换内核。", [
            ...baseLog,
            ...resolved.status.log,
        ]);
    }
    const timeoutMs = boundedTimeout(process.env.CAD_CONVERTER_TIMEOUT_MS);
    const args = applyTemplate(resolved.command.argsTemplate, input.sourcePath, input.outputDir);
    const result = await runCommand(resolved.command.bin, args, input.outputDir, timeoutMs);
    const runLog = [
        ...baseLog,
        `source: ${resolved.command.displayName}`,
        `elapsed: ${result.elapsedMs}ms`,
        result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : "",
        result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : "",
        result.error ? `error: ${result.error.message}` : "",
    ].filter(Boolean);
    if (result.timedOut) {
        return fail(`CAD 转换超过 ${formatTimeoutMs(timeoutMs)} 仍未完成：请上传 PDF 导出版，或联系平台管理员处理该图纸。`, runLog);
    }
    if (result.error || result.exitCode !== 0) {
        return fail("CAD 转换失败：请上传 PDF 导出版，或联系平台管理员处理该 CAD 文件。", runLog);
    }
    const sceneFileName = "scene.svg";
    const previewFileName = "preview.png";
    const scenePath = node_path_1.default.join(input.outputDir, sceneFileName);
    const previewPath = node_path_1.default.join(input.outputDir, previewFileName);
    const sceneReady = await fileExists(scenePath);
    if (!sceneReady) {
        return fail("CAD 转换完成但没有生成可展示的 scene.svg。", [
            ...runLog,
            ...(await readConverterLog(input.outputDir)),
        ]);
    }
    await makeCadSvgReadable(scenePath);
    const size = await readSvgSize(scenePath);
    const hasPreview = await fileExists(previewPath);
    return {
        status: "ready",
        sceneFileName,
        previewFileName: hasPreview ? previewFileName : sceneFileName,
        width: size.width,
        height: size.height,
        message: "CAD 图纸已转换为可视化场景。",
        log: [...runLog, ...(await readConverterLog(input.outputDir)), "converter: scene.svg generated"],
    };
}
