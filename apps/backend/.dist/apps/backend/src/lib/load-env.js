"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBackendEnv = loadBackendEnv;
const fs_1 = require("fs");
const path_1 = require("path");
function parseEnvValue(raw) {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
function loadBackendEnv() {
    const envCandidates = [
        (0, path_1.resolve)(__dirname, "../../../../.env"),
        (0, path_1.resolve)(process.cwd(), ".env"),
        (0, path_1.resolve)(process.cwd(), "smart-fire-platform/.env"),
    ];
    for (const envPath of envCandidates) {
        if (!(0, fs_1.existsSync)(envPath))
            continue;
        const source = (0, fs_1.readFileSync)(envPath, "utf8");
        for (const line of source.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#"))
                continue;
            const separatorIndex = trimmed.indexOf("=");
            if (separatorIndex <= 0)
                continue;
            const key = trimmed.slice(0, separatorIndex).trim();
            const value = parseEnvValue(trimmed.slice(separatorIndex + 1));
            if (!key || process.env[key] !== undefined)
                continue;
            process.env[key] = value;
        }
        return;
    }
}
