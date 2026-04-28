import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { searchFiles, readFileContent, searchContent } from "../file-searcher.js";
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

// searchContent テスト

describe("searchContent", () => {
  describe("正常系", () => {
    it("TC-SC-001: キーワードにマッチした行のスニペットを返す", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(join(repoA, "src"), { recursive: true });
      await writeFile(join(repoA, "src", "auth.ts"), [
        "line1",
        "line2",
        "line3",
        "authentication logic",
        "line5",
        "line6",
        "line7",
      ].join("\n"));

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "authentication", configs });

      expect(results).toHaveLength(1);
      expect(results[0].repository_id).toBe("repo-a");
      expect(results[0].path).toBe("src/auth.ts");
      expect(results[0].snippet).toContain("authentication logic");
      expect(results[0].snippet).toContain("line1");
      expect(results[0].snippet).toContain("line7");
    });

    it("TC-SC-002: 複数ファイルにマッチする場合、それぞれのエントリを返す", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(join(repoA, "src"), { recursive: true });
      await writeFile(join(repoA, "src", "a.ts"), "config value here");
      await writeFile(join(repoA, "src", "b.ts"), "another config entry");

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "config", configs });

      expect(results).toHaveLength(2);
      const paths = results.map((r) => r.path);
      expect(paths).toEqual(expect.arrayContaining(["src/a.ts", "src/b.ts"]));
    });

    it("TC-SC-003: 複数リポジトリを横断して検索する", async () => {
      const repoA = join(baseDir, "repo-a");
      const repoB = join(baseDir, "repo-b");
      await mkdir(repoA, { recursive: true });
      await mkdir(repoB, { recursive: true });
      await writeFile(join(repoA, "config.ts"), "config setting");
      await writeFile(join(repoB, "settings.ts"), "config option");

      const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
      const results = await searchContent({ keyword: "config", configs });

      expect(results).toHaveLength(2);
      const repoIds = results.map((r) => r.repository_id);
      expect(repoIds).toEqual(expect.arrayContaining(["repo-a", "repo-b"]));
    });

    it("TC-SC-004: マッチするファイルなし → 空配列返却", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      await writeFile(join(repoA, "main.ts"), "hello world");

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "zzz_no_match_keyword_xyz", configs });

      expect(results).toEqual([]);
    });

    it("TC-SC-005: 1ファイルに複数ヒット → 1エントリで結合", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      await writeFile(join(repoA, "multi.ts"), [
        "line1",
        "keyword here",
        "line3",
        "line4",
        "line5",
        "another keyword",
        "line7",
      ].join("\n"));

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "keyword", configs });

      expect(results).toHaveLength(1);
      expect(results[0].snippet).toContain("keyword here");
      expect(results[0].snippet).toContain("another keyword");
    });

    it("TC-SC-007: 大文字キーワードで小文字ファイル内容にヒット", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      await writeFile(join(repoA, "memo.txt"), "memo content");

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "MEMO", configs });

      expect(results).toHaveLength(1);
      expect(results[0].snippet).toContain("memo content");
    });

    it("TC-SC-008: 小文字キーワードで大文字ファイル内容にヒット", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      await writeFile(join(repoA, "memo.txt"), "MEMOですよ");

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "memo", configs });

      expect(results).toHaveLength(1);
      expect(results[0].snippet).toContain("MEMOですよ");
    });

    it("TC-SC-006: リポジトリパスが存在しない場合スキップ", async () => {
      const repoA = join(baseDir, "repo-a");
      const repoB = join(baseDir, "repo-b");
      await mkdir(repoA, { recursive: true });
      await writeFile(join(repoA, "main.ts"), "keyword here");

      const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
      const results = await searchContent({ keyword: "keyword", configs });

      expect(results).toHaveLength(1);
      expect(results[0].repository_id).toBe("repo-a");
    });
  });

  describe("境界値", () => {
    it("TC-SC-B-001: ファイル先頭行（1行目）にヒット → 前3行なし、後3行のみ", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      const lines = ["TARGET_KEYWORD", "line2", "line3", "line4", "line5", "line6", "line7", "line8", "line9", "line10"];
      await writeFile(join(repoA, "file.ts"), lines.join("\n"));

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "TARGET_KEYWORD", configs });

      expect(results).toHaveLength(1);
      const snippet = results[0].snippet;
      expect(snippet).toContain("TARGET_KEYWORD");
      expect(snippet).toContain("line2");
      expect(snippet).toContain("line3");
      expect(snippet).toContain("line4");
      expect(snippet).not.toContain("line5");
    });

    it("TC-SC-B-002: ファイル末尾行（最終行）にヒット → 後3行なし、前3行のみ", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      const lines = ["line1", "line2", "line3", "line4", "line5", "line6", "line7", "line8", "line9", "TARGET_KEYWORD"];
      await writeFile(join(repoA, "file.ts"), lines.join("\n"));

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "TARGET_KEYWORD", configs });

      expect(results).toHaveLength(1);
      const snippet = results[0].snippet;
      expect(snippet).toContain("TARGET_KEYWORD");
      expect(snippet).toContain("line7");
      expect(snippet).toContain("line8");
      expect(snippet).toContain("line9");
      expect(snippet).not.toContain("line6");
    });

    it("TC-SC-B-003: ファイル中央行（4行目）にヒット → 前後3行含む", async () => {
      const repoA = join(baseDir, "repo-a");
      await mkdir(repoA, { recursive: true });
      const lines = ["line1", "line2", "line3", "TARGET_KEYWORD", "line5", "line6", "line7", "line8", "line9", "line10"];
      await writeFile(join(repoA, "file.ts"), lines.join("\n"));

      const configs = [makeConfig("repo-a", repoA)];
      const results = await searchContent({ keyword: "TARGET_KEYWORD", configs });

      expect(results).toHaveLength(1);
      const snippet = results[0].snippet;
      expect(snippet).toContain("line1");
      expect(snippet).toContain("line2");
      expect(snippet).toContain("line3");
      expect(snippet).toContain("TARGET_KEYWORD");
      expect(snippet).toContain("line5");
      expect(snippet).toContain("line6");
      expect(snippet).toContain("line7");
      expect(snippet).not.toContain("line8");
    });
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

  it("TC-F002-013: **/pattern がルート直下のファイルにマッチする", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    await writeFile(join(repoA, "memo.txt"), "root memo");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await searchFiles({ pattern: "**/memo.txt", configs });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("memo.txt");
  });

  it("TC-F002-014: **/pattern がネストしたファイルにもマッチする", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "sub", "deep"), { recursive: true });
    await writeFile(join(repoA, "memo.txt"), "root");
    await writeFile(join(repoA, "sub", "memo.txt"), "sub");
    await writeFile(join(repoA, "sub", "deep", "memo.txt"), "deep");

    const configs = [makeConfig("repo-a", repoA)];
    const result = await searchFiles({ pattern: "**/memo.txt", configs });

    expect(result).toHaveLength(3);
    const paths = result.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["memo.txt", "sub/memo.txt", "sub/deep/memo.txt"]));
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
