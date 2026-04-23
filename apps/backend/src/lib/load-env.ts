import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function parseEnvValue(raw: string) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadBackendEnv() {
  const envCandidates = [
    resolve(__dirname, "../../../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "smart-fire-platform/.env"),
  ];

  for (const envPath of envCandidates) {
    if (!existsSync(envPath)) continue;

    const source = readFileSync(envPath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = value;
    }

    return;
  }
}
