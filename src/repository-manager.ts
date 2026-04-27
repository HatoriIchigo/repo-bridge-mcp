import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { Repository, RepositoryConfig } from "./types.js";

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

export async function loadRepositories(baseDir: string = process.cwd()): Promise<Repository[]> {
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

  const repositories: Repository[] = [];

  for (const filename of entries) {
    try {
      const content = await readFile(join(repoBridgeDir, filename), "utf-8");
      const parsed: unknown = JSON.parse(content);

      if (!isRepositoryConfig(parsed) || !parsed.enabled) continue;

      repositories.push({ id: parsed.id, name: parsed.name, path: parsed.path });
    } catch {
      continue;
    }
  }

  return repositories;
}
