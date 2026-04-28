import { readdir, readFile } from "fs/promises";
import { join, resolve, relative } from "path";
import type { RepositoryConfig, FileEntry, ContextResult } from "./types.js";

interface SearchFilesOptions {
  pattern: string;
  repository_id?: string;
  configs: RepositoryConfig[];
}

interface ReadFileOptions {
  repository_id: string;
  path: string;
  configs: RepositoryConfig[];
}

/** globパターンを正規表現に変換する（外部ライブラリ不使用）。 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§DOUBLE§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLE§/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`(^|/)${escaped}$`);
}

/** ディレクトリを再帰的に走査し、全ファイルの相対パスを収集する。 */
async function walkDir(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath);
    if (entry.isDirectory()) {
      const nested = await walkDir(fullPath, base);
      results.push(...nested);
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

/** 相対パスが除外パターンのいずれかに該当するか判定する。 */
function isExcluded(relPath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pat) => {
    const segments = relPath.split("/");
    return segments.some((seg) => seg === pat) || relPath.startsWith(pat + "/") || relPath === pat;
  });
}

/**
 * 登録リポジトリを横断してglobパターンにマッチするファイルを検索する。
 * @param options.pattern - ファイル名のglobパターン
 * @param options.repository_id - 絞り込むリポジトリID（省略時は全リポジトリ対象）
 * @param options.configs - リポジトリ設定一覧
 */
export async function searchFiles(options: SearchFilesOptions): Promise<FileEntry[]> {
  const { pattern, repository_id, configs } = options;

  if (!pattern) return [];

  const targets = repository_id
    ? configs.filter((c) => c.id === repository_id)
    : configs;

  const regex = globToRegex(pattern);
  const results: FileEntry[] = [];

  for (const config of targets) {
    let allFiles: string[];
    try {
      allFiles = await walkDir(config.path, config.path);
    } catch {
      continue;
    }

    for (const relPath of allFiles) {
      if (isExcluded(relPath, config.exclude_patterns)) continue;
      if (!regex.test(relPath)) continue;
      results.push({ repository_id: config.id, path: relPath, type: "file" });
    }
  }

  return results;
}

interface SearchContentOptions {
  keyword: string;
  configs: RepositoryConfig[];
}

/** ヒット行インデックスのリストからスニペット文字列を生成する（前後3行）。 */
function buildSnippet(lines: string[], hitIndices: number[]): string {
  const included = new Set<number>();
  for (const idx of hitIndices) {
    for (let i = Math.max(0, idx - 3); i <= Math.min(lines.length - 1, idx + 3); i++) {
      included.add(i);
    }
  }
  return Array.from(included)
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .join("\n");
}

/**
 * 登録リポジトリを横断してファイル内容をキーワード検索し、スニペットを返す。
 * @param options.keyword - 検索キーワード
 * @param options.configs - リポジトリ設定一覧
 */
export async function searchContent(options: SearchContentOptions): Promise<ContextResult[]> {
  const { keyword, configs } = options;
  const results: ContextResult[] = [];

  for (const config of configs) {
    let allFiles: string[];
    try {
      allFiles = await walkDir(config.path, config.path);
    } catch {
      continue;
    }

    for (const relPath of allFiles) {
      if (isExcluded(relPath, config.exclude_patterns)) continue;

      const fullPath = resolve(config.path, relPath);
      let content: string;
      try {
        content = await readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      let hitIndices = lines
        .map((line, idx) => (line.includes(keyword) ? idx : -1))
        .filter((idx) => idx !== -1);

      if (hitIndices.length === 0) {
        const lowerKeyword = keyword.toLowerCase();
        hitIndices = lines
          .map((line, idx) => (line.toLowerCase().includes(lowerKeyword) ? idx : -1))
          .filter((idx) => idx !== -1);
      }

      if (hitIndices.length === 0) continue;

      results.push({
        repository_id: config.id,
        path: relPath,
        snippet: buildSnippet(lines, hitIndices),
      });
    }
  }

  return results;
}

/**
 * 指定リポジトリの指定パスのファイル内容をUTF-8文字列で返す。
 * @param options.repository_id - リポジトリID
 * @param options.path - リポジトリルートからの相対パス
 * @param options.configs - リポジトリ設定一覧
 * @throws リポジトリが見つからない場合 `Error: Repository not found: {id}`
 * @throws パストラバーサルの場合 `Error: Path traversal is not allowed`
 */
export async function readFileContent(options: ReadFileOptions): Promise<string> {
  const { repository_id, path: inputPath, configs } = options;

  const config = configs.find((c) => c.id === repository_id);
  if (!config) throw new Error(`Repository not found: ${repository_id}`);

  const repoRoot = resolve(config.path);
  const fullPath = resolve(repoRoot, inputPath);

  if (!fullPath.startsWith(repoRoot + "/") && fullPath !== repoRoot) {
    throw new Error("Path traversal is not allowed");
  }

  return readFile(fullPath, "utf-8");
}
