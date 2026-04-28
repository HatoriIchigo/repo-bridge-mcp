import { readFile } from "fs/promises";
import { join } from "path";
import type { RepositoryConfig } from "./types.js";

function isRepositoryConfig(value: unknown): value is RepositoryConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    typeof v["path"] === "string" &&
    typeof v["enabled"] === "boolean" &&
    Array.isArray(v["exclude_patterns"])
  );
}

function isSettings(value: unknown): value is { repositories: unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v["repositories"]);
}

export async function loadRepositories(baseDir: string = process.cwd()): Promise<RepositoryConfig[]> {
  const settingsPath = join(baseDir, ".repo-bridge", "settings.json");

  let content: string;
  try {
    content = await readFile(settingsPath, "utf-8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!isSettings(parsed)) return [];

  return parsed.repositories.filter((r): r is RepositoryConfig => isRepositoryConfig(r) && r.enabled);
}
