import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { loadRepositories } from "../repository-manager.js";

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "repo-bridge-test-"));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

const repoBridgeDir = (base: string) => join(base, ".repo-bridge");

const writeSettings = async (base: string, repositories: object[]) => {
  await writeFile(join(repoBridgeDir(base), "settings.json"), JSON.stringify({ repositories }));
};

// 正常系

describe("正常系", () => {
  it("TC1: repositories が1件・enabled: true の場合に1件返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "/repos/my-repo", enabled: true, exclude_patterns: ["node_modules"] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([{ id: "my-repo", name: "My Repository", path: "/repos/my-repo", enabled: true, exclude_patterns: ["node_modules"] }]);
  });

  it("TC2: repositories が複数件・全て enabled: true の場合に全件返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "repo-a", name: "Repo A", path: "/repos/a", enabled: true, exclude_patterns: [] },
      { id: "repo-b", name: "Repo B", path: "/repos/b", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["repo-a", "repo-b"]));
  });

  it("TC3: enabled: false のエントリを除外する", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "enabled", name: "Enabled", path: "/repos/enabled", enabled: true, exclude_patterns: [] },
      { id: "disabled", name: "Disabled", path: "/repos/disabled", enabled: false, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("enabled");
  });
});

// 異常系

describe("異常系", () => {
  it("TC4: .repo-bridge/settings.json が存在しない場合に空配列を返す", async () => {
    const result = await loadRepositories(baseDir);
    expect(result).toEqual([]);
  });

  it("TC5: .repo-bridge/ ディレクトリが存在しない場合に空配列を返す", async () => {
    const result = await loadRepositories(baseDir);
    expect(result).toEqual([]);
  });

  it("TC6: JSONパースエラーの場合に空配列を返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeFile(join(repoBridgeDir(baseDir), "settings.json"), "{invalid json}");

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });

  it("TC7: repositories フィールドが存在しない場合に空配列を返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeFile(join(repoBridgeDir(baseDir), "settings.json"), JSON.stringify({ other: [] }));

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });

  it("TC8: 必須フィールドが欠落したエントリをスキップして残りを返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "incomplete", name: "Incomplete" },
      { id: "complete", name: "Complete", path: "/repos/complete", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("complete");
  });
});

// 境界値

describe("境界値", () => {
  it("TC9: repositories が空配列の場合に空配列を返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, []);

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });
});
