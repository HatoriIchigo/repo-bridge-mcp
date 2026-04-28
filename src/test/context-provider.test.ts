import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { RepositoryConfig, ContextResult } from "../types.js";

let baseDir: string;

const makeConfig = (id: string, repoPath: string, excludePatterns: string[] = []): RepositoryConfig => ({
  id,
  name: id,
  path: repoPath,
  enabled: true,
  exclude_patterns: excludePatterns,
});

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "context-provider-test-"));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

async function callGetContext(
  args: { context: string; repository_id?: string },
  configs: RepositoryConfig[],
  cwd: string,
): Promise<ContextResult[]> {
  jest.spyOn(process, "cwd").mockReturnValue(cwd);
  const { getContext } = await import("../context-provider.js");
  return getContext({ ...args, configs });
}

// 正常系

describe("正常系", () => {
  it("TC-N-001: CWDが登録リポジトリのパスと完全一致", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src"), { recursive: true });
    await writeFile(join(repoA, "src", "auth.ts"), [
      "line1",
      "line2",
      "line3",
      "authentication logic here",
      "line5",
      "line6",
      "line7",
    ].join("\n"));

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "authentication" }, configs, repoA);

    expect(results).toHaveLength(1);
    expect(results[0].repository_id).toBe("repo-a");
    expect(results[0].path).toBe("src/auth.ts");
    expect(results[0].snippet).toContain("authentication logic here");
  });

  it("TC-N-002: CWDが登録リポジトリのサブディレクトリ", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(join(repoA, "src", "components"), { recursive: true });
    await writeFile(join(repoA, "src", "components", "Button.ts"), "export const Button = () => {};");

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "Button" }, configs, join(repoA, "src", "components"));

    expect(results).toHaveLength(1);
    expect(results[0].repository_id).toBe("repo-a");
    expect(results[0].path).toBe("src/components/Button.ts");
  });

  it("TC-N-003: CWDが登録リポジトリ外 → 全リポジトリ検索", async () => {
    const repoA = join(baseDir, "repo-a");
    const repoB = join(baseDir, "repo-b");
    await mkdir(repoA, { recursive: true });
    await mkdir(repoB, { recursive: true });
    await writeFile(join(repoA, "config.ts"), "config setting");
    await writeFile(join(repoB, "settings.ts"), "config option");

    const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
    const results = await callGetContext({ context: "config" }, configs, join(baseDir, "other-dir"));

    expect(results).toHaveLength(2);
    const repoIds = results.map((r) => r.repository_id);
    expect(repoIds).toEqual(expect.arrayContaining(["repo-a", "repo-b"]));
  });

  it("TC-N-004: repository_id指定あり（CWDはリポジトリ外） → 指定リポジトリのみ", async () => {
    const repoA = join(baseDir, "repo-a");
    const repoB = join(baseDir, "repo-b");
    await mkdir(repoA, { recursive: true });
    await mkdir(repoB, { recursive: true });
    await writeFile(join(repoA, "config.ts"), "config setting");
    await writeFile(join(repoB, "settings.ts"), "config option");

    const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
    const results = await callGetContext({ context: "config", repository_id: "repo-b" }, configs, join(baseDir, "other-dir"));

    expect(results).toHaveLength(1);
    expect(results[0].repository_id).toBe("repo-b");
  });

  it("TC-N-005: repository_id指定あり（CWDは別リポジトリ内） → 指定リポジトリが優先", async () => {
    const repoA = join(baseDir, "repo-a");
    const repoB = join(baseDir, "repo-b");
    await mkdir(repoA, { recursive: true });
    await mkdir(repoB, { recursive: true });
    await writeFile(join(repoA, "config.ts"), "config in repo-a");
    await writeFile(join(repoB, "settings.ts"), "config in repo-b");

    const configs = [makeConfig("repo-a", repoA), makeConfig("repo-b", repoB)];
    const results = await callGetContext({ context: "config", repository_id: "repo-b" }, configs, repoA);

    expect(results).toHaveLength(1);
    expect(results[0].repository_id).toBe("repo-b");
  });

  it("TC-N-006: マッチするファイルなし → 空配列返却", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    await writeFile(join(repoA, "main.ts"), "hello world");

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "zzz_no_match_keyword_xyz" }, configs, repoA);

    expect(results).toEqual([]);
  });

  it("TC-N-007: 複数リポジトリがCWDに前方一致 → 最長一致採用", async () => {
    const repoParent = join(baseDir, "repo");
    const repoChild = join(baseDir, "repo", "child");
    await mkdir(join(repoParent, "src"), { recursive: true });
    await mkdir(join(repoChild, "src"), { recursive: true });
    await writeFile(join(repoParent, "main.ts"), "feature in parent");
    await writeFile(join(repoChild, "feature.ts"), "feature in child");

    const configs = [
      makeConfig("repo-parent", repoParent),
      makeConfig("repo-child", repoChild),
    ];
    const results = await callGetContext({ context: "feature" }, configs, join(repoChild, "src"));

    const repoIds = results.map((r) => r.repository_id);
    expect(repoIds).not.toContain("repo-parent");
    expect(repoIds).toContain("repo-child");
  });
});

// 異常系

describe("異常系", () => {
  it("TC-E-001: 存在しないrepository_idの指定", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });

    const configs = [makeConfig("repo-a", repoA)];
    await expect(callGetContext({ context: "keyword", repository_id: "repo-nonexistent" }, configs, repoA))
      .rejects.toThrow("Repository not found: repo-nonexistent");
  });

  it("TC-E-002: contextに空文字", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });

    const configs = [makeConfig("repo-a", repoA)];
    await expect(callGetContext({ context: "" }, configs, repoA))
      .rejects.toThrow("context is required");
  });
});

// 境界値

describe("境界値", () => {
  it("TC-B-001: スニペット — ファイル先頭行（1行目）にヒット", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    const lines = ["TARGET_KEYWORD", "line2", "line3", "line4", "line5", "line6", "line7", "line8", "line9", "line10"];
    await writeFile(join(repoA, "file.ts"), lines.join("\n"));

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "TARGET_KEYWORD" }, configs, repoA);

    expect(results).toHaveLength(1);
    const snippet = results[0].snippet;
    expect(snippet).toContain("TARGET_KEYWORD");
    expect(snippet).toContain("line2");
    expect(snippet).toContain("line3");
    expect(snippet).toContain("line4");
    expect(snippet).not.toContain("line5");
  });

  it("TC-B-002: スニペット — ファイル末尾行（最終行）にヒット", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    const lines = ["line1", "line2", "line3", "line4", "line5", "line6", "line7", "line8", "line9", "TARGET_KEYWORD"];
    await writeFile(join(repoA, "file.ts"), lines.join("\n"));

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "TARGET_KEYWORD" }, configs, repoA);

    expect(results).toHaveLength(1);
    const snippet = results[0].snippet;
    expect(snippet).toContain("TARGET_KEYWORD");
    expect(snippet).toContain("line7");
    expect(snippet).toContain("line8");
    expect(snippet).toContain("line9");
    expect(snippet).not.toContain("line6");
  });

  it("TC-B-003: スニペット — ファイル中央行（4行目）にヒット", async () => {
    const repoA = join(baseDir, "repo-a");
    await mkdir(repoA, { recursive: true });
    const lines = ["line1", "line2", "line3", "TARGET_KEYWORD", "line5", "line6", "line7", "line8", "line9", "line10"];
    await writeFile(join(repoA, "file.ts"), lines.join("\n"));

    const configs = [makeConfig("repo-a", repoA)];
    const results = await callGetContext({ context: "TARGET_KEYWORD" }, configs, repoA);

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
