import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { searchFiles, readFileContent } from "../file-searcher.js";
import type { RepositoryConfig } from "../types.js";

let baseDir: string;

const makeConfig = (id: string, repoPath: string, excludePatterns: string[] = []): RepositoryConfig => ({
  id,
  name: id,
  path: repoPath,
  enabled: true,
  exclude_patterns: excludePatterns,
});

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "file-searcher-test-"));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

// 正常系

describe("正常系", () => {
  it("TC-F002-001: 全リポジトリ対象のglobパターン検索", async () => {
    const repoA = join(baseDir, "repo-a");
    const repoB = join(baseDir, "repo-b");
    await mkdir(join(repoA, "src"), { recursive: true });
    await mkdir(join(repoB, "src"), { recursive: true });
    await mkdir(join(repoB, "docs"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "");
    await writeFile(join(repoA, "src", "utils.ts"), "");
    await writeFile(join(repoA, "README.md"), "");
    await writeFile(join(repoB, "src", "index.ts"), "");
    await writeFile(join(repoB, "docs", "api.md"), "");

    const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
    const result = await searchFiles({ pattern: "*.ts", configs });

    expect(result).toHaveLength(3);
    const paths = result.map((e) => `${e.repository_id}/${e.path}`);
    expect(paths).toEqual(expect.arrayContaining([
      "repo-a/src/main.ts",
      "repo-a/src/utils.ts",
      "repo-b/src/index.ts",
    ]));
  });

  it("TC-F002-002: repository_id指定での絞り込み検索", async () => {
    const repoA = join(baseDir, "repo-a");
    const repoB = join(baseDir, "repo-b");
    await mkdir(join(repoA, "src"), { recursive: true });
    await mkdir(join(repoB, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "");
    await writeFile(join(repoB, "src", "index.ts"), "");

    const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
    const result = await searchFiles({ pattern: "*.ts", repository_id: "repo-a", configs });

    expect(result).toHaveLength(1);
    expect(result[0].repository_id).toBe("repo-a");
    expect(result[0].path).toBe("src/main.ts");
  });

  it("TC-F002-003: 除外パターンによるファイル除外", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await mkdir(join(repoA, "node_modules", "lib"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "");
    await writeFile(join(repoA, "node_modules", "lib", "index.ts"), "");

    const configs = [makeConfig("repo-a", repoA, ["node_modules"])];
    const result = await searchFiles({ pattern: "*.ts", configs });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("src/main.ts");
  });

  it("TC-F002-004: read_fileによるファイル内容取得", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "const x = 1;");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await readFileContent({ repository_id: "repo-a", path: "src/main.ts", configs });

    expect(result).toBe("const x = 1;");
  });

  it("TC-F002-005: マッチするファイルが0件", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    await writeFile(join(repoA, "README.md"), "");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await searchFiles({ pattern: "*.ts", configs });

    expect(result).toEqual([]);
  });
});

// 異常系

describe("異常系", () => {
  it("TC-F002-006: 存在しないrepository_idを指定したsearch_files", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await searchFiles({ pattern: "*.ts", repository_id: "non-existent", configs });

    expect(result).toEqual([]);
  });

  it("TC-F002-007: 存在しないrepository_idを指定したread_file", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });

    const configs = [makeConfig("repo-a", repoA)];

    await expect(
      readFileContent({ repository_id: "non-existent", path: "src/main.ts", configs })
    ).rejects.toThrow("Repository not found: non-existent");
  });

  it("TC-F002-008: パストラバーサル攻撃の拒否（read_file）", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });

    const configs = [makeConfig("repo-a", repoA)];

    await expect(
      readFileContent({ repository_id: "repo-a", path: "../secret.txt", configs })
    ).rejects.toThrow("Path traversal is not allowed");
  });

  it("TC-F002-009: 存在しないファイルのread_file", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });

    const configs = [makeConfig("repo-a", repoA)];

    await expect(
      readFileContent({ repository_id: "repo-a", path: "nonexistent.ts", configs })
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

// 境界値

describe("境界値", () => {
  it("TC-F002-010: patternが空文字", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await searchFiles({ pattern: "", configs });

    expect(result).toEqual([]);
  });

  it("TC-F002-011: リポジトリが0件登録の場合", async () => {
    const result = await searchFiles({ pattern: "*.ts", configs: [] });

    expect(result).toEqual([]);
  });

  it("TC-F002-012: src/../src/main.ts はリポジトリ内に留まるため許可", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "main.ts"), "const x = 1;");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await readFileContent({ repository_id: "repo-a", path: "src/../src/main.ts", configs });

    expect(result).toBe("const x = 1;");
  });
});
