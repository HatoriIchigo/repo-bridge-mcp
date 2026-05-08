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

/**
 * path 文字列内の ${HOME} と ${CUR} を展開する。
 * HOME が undefined または空文字、CUR が空文字の場合はエラーをスローする。
 */
function expandPathVariables(path: string): string {
  if (path.includes("${HOME}")) {
    const home = process.env["HOME"];
    if (!home) throw new Error("Variable ${HOME} is not defined");
    path = path.replaceAll("${HOME}", home);
  }
  if (path.includes("${CUR}")) {
    const cur = process.cwd();
    if (!cur) throw new Error("Variable ${CUR} is not defined");
    path = path.replaceAll("${CUR}", cur);
  }
  return path;
}

/** settings.json を読み込んでリポジトリ設定一覧を返す。 */
export async function loadRepositories(baseDir: string = process.cwd()): Promise<RepositoryConfig[]> {
  const settings = await loadSettings(baseDir);
  return settings.repositories
    .filter((r): r is RepositoryConfig => isRepositoryConfig(r) && r.enabled)
    .map((r) => ({ ...r, path: expandPathVariables(r.path) }));
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
