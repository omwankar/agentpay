import { existsSync, readFileSync } from "node:fs";

function readEnvFile(file: string) {
  const values = new Map<string, string>();
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export function loadLocalEnv(dir: string) {
  const preexisting = new Set(Object.keys(process.env));
  const merged = readEnvFile(`${dir}/.env`);
  for (const [key, value] of readEnvFile(`${dir}/.env.local`)) merged.set(key, value);
  for (const [key, value] of merged) {
    if (!preexisting.has(key)) process.env[key] = value;
  }
}
