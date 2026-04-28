import { readFile } from "fs/promises";
import { join } from "path";
import type { RepositoryConfig, Settings } from "./types.js";

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

function isSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v["repositories"]);
}

/** settings.json を読み込んでリポジトリ設定一覧を返す。 */
export async function loadRepositories(baseDir: string = process.cwd()): Promise<RepositoryConfig[]> {
  const settings = await loadSettings(baseDir);
  return settings.repositories.filter((r): r is RepositoryConfig => isRepositoryConfig(r) && r.enabled);
}

/** settings.json を読み込んで Settings オブジェクトを返す。読み込み失敗時はデフォルト値を返す。 */
export async function loadSettings(baseDir: string = process.cwd()): Promise<Settings> {
  const settingsPath = join(baseDir, ".repo-bridge", "settings.json");

  let content: string;
  try {
    content = await readFile(settingsPath, "utf-8");
  } catch {
    return { repositories: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { repositories: [] };
  }

  if (!isSettings(parsed)) return { repositories: [] };

  return parsed;
}
