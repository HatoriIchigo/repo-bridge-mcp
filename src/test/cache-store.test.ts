import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { RepositoryConfig } from "../types.js";

let baseDir: string;

const makeConfig = (
  id: string,
  repoPath: string,
  excludePatterns: string[] = [],
  cacheExcludePatterns: string[] = [],
): RepositoryConfig => ({
  id,
  name: id,
  path: repoPath,
  enabled: true,
  exclude_patterns: excludePatterns,
  cache_exclude_patterns: cacheExcludePatterns,
});

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "cache-store-test-"));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

// ---- 正常系 ----

describe("正常系", () => {
  it("TC-C-001: search_files でキャッシュから walkDir 結果を返す", async () => {
    const { searchFiles } = await import("../file-searcher.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });

    const cacheData = {
      repository_id: "my-repo",
      repository_name: "My Repo",
      created_at: "2026-04-28T00:00:00.000Z",
      files: {
        "src/index.ts": { chunks: ["const x = 1;"], cached_at: "2026-04-28T12:00:00.000Z" },
        "README.md": { chunks: ["# Title"], cached_at: "2026-04-28T12:00:00.000Z" },
      },
    };
    await writeFile(join(cacheDir, "my-repo.json"), JSON.stringify(cacheData));

    const repoPath = join(baseDir, "repo");
    await mkdir(repoPath, { recursive: true });

    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await searchFiles({ pattern: "*.ts", repository_id: "my-repo", configs, cacheStore: store });

    expect(result.some((e) => e.repository_id === "my-repo" && e.path === "src/index.ts")).toBe(true);
    expect(result.every((e) => e.type === "file")).toBe(true);
  });

  it("TC-C-002: read_file でキャッシュの chunks を結合して全文を返す", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });

    const cacheData = {
      repository_id: "my-repo",
      repository_name: "My Repo",
      created_at: "2026-04-28T00:00:00.000Z",
      files: {
        "src/index.ts": { chunks: ["const x = 1;\nconst y = 2;"], cached_at: "2026-04-28T12:00:00.000Z" },
      },
    };
    await writeFile(join(cacheDir, "my-repo.json"), JSON.stringify(cacheData));

    const repoPath = join(baseDir, "repo");
    await mkdir(repoPath, { recursive: true });

    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await readFileContent({
      repository_id: "my-repo",
      path: "src/index.ts",
      configs,
      cacheStore: store,
    });

    expect(result).toBe("const x = 1;\nconst y = 2;");
  });

  it("TC-C-003: キャッシュミス時に実ファイルを読んでチャンク分割してキャッシュに書き込む", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "utils.ts"), "export const a = 2;");

    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await readFileContent({
      repository_id: "my-repo",
      path: "src/utils.ts",
      configs,
      cacheStore: store,
    });

    expect(result).toBe("export const a = 2;");

    const cacheFile = join(baseDir, ".repo-bridge", "cache", "my-repo.json");
    const raw = await readFile(cacheFile, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.files["src/utils.ts"]).toBeDefined();
    expect(parsed.files["src/utils.ts"].chunks).toEqual(["export const a = 2;"]);
    expect(parsed.files["src/utils.ts"].cached_at).toBeTruthy();
  });

  it("TC-C-004: cache_exclude_patterns に一致するファイルはキャッシュに書き込まない", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "utils.ts"), "export const a = 2;");

    const configs = [makeConfig("my-repo", repoPath, [], ["src/**"])];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await readFileContent({
      repository_id: "my-repo",
      path: "src/utils.ts",
      configs,
      cacheStore: store,
    });

    expect(result).toBe("export const a = 2;");

    const cacheFile = join(baseDir, ".repo-bridge", "cache", "my-repo.json");
    let cacheExists = true;
    try {
      const raw = await readFile(cacheFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.files && parsed.files["src/utils.ts"]) {
        cacheExists = true;
      } else {
        cacheExists = false;
      }
    } catch {
      cacheExists = false;
    }
    expect(cacheExists).toBe(false);
  });

  it("TC-C-005: cache_delete: true 時に起動でキャッシュディレクトリを削除する", async () => {
    const { clearCacheIfNeeded } = await import("../cache-store.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "my-repo.json"), "{}");

    await clearCacheIfNeeded(baseDir, true);

    let exists = true;
    try {
      await readFile(join(cacheDir, "my-repo.json"), "utf-8");
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it("TC-C-006: cache_delete: false 時に起動でキャッシュを保持する", async () => {
    const { clearCacheIfNeeded } = await import("../cache-store.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "my-repo.json"), "{}");

    await clearCacheIfNeeded(baseDir, false);

    const raw = await readFile(join(cacheDir, "my-repo.json"), "utf-8");
    expect(raw).toBe("{}");
  });
});

// ---- 異常系 ----

describe("異常系", () => {
  it("TC-C-007: キャッシュJSONのパース失敗時は実ファイルにフォールバック", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "my-repo.json"), "INVALID_JSON");

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "index.ts"), "const z = 3;");

    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await readFileContent({
      repository_id: "my-repo",
      path: "src/index.ts",
      configs,
      cacheStore: store,
    });

    expect(result).toBe("const z = 3;");
  });

  it("TC-C-008: キャッシュ書き込み失敗時はエラーをスローせず正常終了", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "index.ts"), "const z = 3;");

    const configs = [makeConfig("my-repo", repoPath)];

    // CacheStore を継承して save を上書きし書き込み失敗をシミュレーション
    const { CacheStore } = await import("../cache-store.js");
    class FailingCacheStore extends CacheStore {
      override async setFileContent(): Promise<void> {
        throw new Error("Permission denied");
      }
    }
    const store = new FailingCacheStore(baseDir, true);

    await expect(
      readFileContent({
        repository_id: "my-repo",
        path: "src/index.ts",
        configs,
        cacheStore: store,
      })
    ).resolves.toBe("const z = 3;");
  });

  it("TC-C-009: cache/ が存在しない状態で cache_delete: false の削除処理を実行", async () => {
    const { clearCacheIfNeeded } = await import("../cache-store.js");

    await expect(clearCacheIfNeeded(baseDir, false)).resolves.not.toThrow();
  });
});

// ---- 境界値 ----

describe("境界値", () => {
  it("TC-C-010: files が空の {} のキャッシュで searchFiles を呼び出す → walkDir を呼ばず [] を返す", async () => {
    const { searchFiles } = await import("../file-searcher.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });

    const cacheData = {
      repository_id: "my-repo",
      repository_name: "My Repo",
      created_at: "2026-04-28T00:00:00.000Z",
      files: {},
    };
    await writeFile(join(cacheDir, "my-repo.json"), JSON.stringify(cacheData));

    const repoPath = join(baseDir, "repo");
    await mkdir(repoPath, { recursive: true });

    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    const result = await searchFiles({ pattern: "*.ts", repository_id: "my-repo", configs, cacheStore: store });

    expect(result).toEqual([]);
  });

  it("TC-C-011: cache_delete フィールドが未設定の場合は true として扱いキャッシュを削除する", async () => {
    const { clearCacheIfNeeded } = await import("../cache-store.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "my-repo.json"), "{}");

    // cache_delete 未設定 → undefined → true 相当
    await clearCacheIfNeeded(baseDir, undefined);

    let exists = true;
    try {
      await readFile(join(cacheDir, "my-repo.json"), "utf-8");
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it("TC-C-012: local_cache: false 時はキャッシュを参照せず実ファイルを読む", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const cacheDir = join(baseDir, ".repo-bridge", "cache");
    await mkdir(cacheDir, { recursive: true });

    const cacheData = {
      repository_id: "my-repo",
      repository_name: "My Repo",
      created_at: "2026-04-28T00:00:00.000Z",
      files: {
        "src/index.ts": { chunks: ["const x = 1;"], cached_at: "2026-04-28T12:00:00.000Z" },
      },
    };
    await writeFile(join(cacheDir, "my-repo.json"), JSON.stringify(cacheData));

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "index.ts"), "const actual = 999;");

    const configs = [makeConfig("my-repo", repoPath)];

    // local_cache: false → cacheStore を渡さない
    const result = await readFileContent({
      repository_id: "my-repo",
      path: "src/index.ts",
      configs,
    });

    expect(result).toBe("const actual = 999;");
  });

  it("TC-C-013: cache_exclude_patterns が未指定の場合は全ファイルをキャッシュ対象にする", async () => {
    const { readFileContent } = await import("../file-searcher.js");

    const repoPath = join(baseDir, "repo");
    await mkdir(join(repoPath, "src"), { recursive: true });
    await writeFile(join(repoPath, "src", "index.ts"), "const x = 1;");

    // cache_exclude_patterns 未設定
    const configs = [makeConfig("my-repo", repoPath)];

    const { CacheStore } = await import("../cache-store.js");
    const store = new CacheStore(baseDir, true);

    await readFileContent({
      repository_id: "my-repo",
      path: "src/index.ts",
      configs,
      cacheStore: store,
    });

    const cacheFile = join(baseDir, ".repo-bridge", "cache", "my-repo.json");
    const raw = await readFile(cacheFile, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.files["src/index.ts"]).toBeDefined();
  });
});
