import { readdir, readFile } from "fs/promises";
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

export async function loadRepositories(baseDir: string = process.cwd()): Promise<RepositoryConfig[]> {
  const repoBridgeDir = join(baseDir, ".repo-bridge");

  let entries: string[];
  try {
    const dirents = await readdir(repoBridgeDir, { withFileTypes: true });
    entries = dirents
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name);
  } catch {
    return [];
  }

  const repositories: RepositoryConfig[] = [];

  for (const filename of entries) {
    try {
      const content = await readFile(join(repoBridgeDir, filename), "utf-8");
      const parsed: unknown = JSON.parse(content);

      if (!isRepositoryConfig(parsed) || !parsed.enabled) continue;

      repositories.push(parsed);
    } catch {
      continue;
    }
  }

  return repositories;
}
