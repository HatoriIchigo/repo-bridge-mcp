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

const writeConfig = async (base: string, filename: string, content: object) => {
  await writeFile(join(repoBridgeDir(base), filename), JSON.stringify(content));
};

// 正常系

describe("正常系", () => {
  it("TC1: JSONファイルが1件・enabled: true の場合に1件返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeConfig(baseDir, "my-repo.json", {
      id: "my-repo",
      name: "My Repository",
      path: "/repos/my-repo",
      enabled: true,
      exclude_patterns: ["node_modules"],
    });

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([{ id: "my-repo", name: "My Repository", path: "/repos/my-repo" }]);
  });

  it("TC2: JSONファイルが複数件・全て enabled: true の場合に全件返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeConfig(baseDir, "repo-a.json", {
      id: "repo-a", name: "Repo A", path: "/repos/a", enabled: true, exclude_patterns: [],
    });
    await writeConfig(baseDir, "repo-b.json", {
      id: "repo-b", name: "Repo B", path: "/repos/b", enabled: true, exclude_patterns: [],
    });

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["repo-a", "repo-b"]));
  });

  it("TC3: enabled: false のエントリを除外する", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeConfig(baseDir, "enabled.json", {
      id: "enabled", name: "Enabled", path: "/repos/enabled", enabled: true, exclude_patterns: [],
    });
    await writeConfig(baseDir, "disabled.json", {
      id: "disabled", name: "Disabled", path: "/repos/disabled", enabled: false, exclude_patterns: [],
    });

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("enabled");
  });
});

// 異常系

describe("異常系", () => {
  it("TC4: .repo-bridge/ ディレクトリが存在しない場合に空配列を返す", async () => {
    const result = await loadRepositories(baseDir);
    expect(result).toEqual([]);
  });

  it("TC5: JSONパースエラーのファイルをスキップして残りを返す", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeFile(join(repoBridgeDir(baseDir), "broken.json"), "{invalid json}");
    await writeConfig(baseDir, "valid.json", {
      id: "valid", name: "Valid", path: "/repos/valid", enabled: true, exclude_patterns: [],
    });

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("valid");
  });

  it("TC6: 必須フィールドが欠落したJSONをスキップする", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeConfig(baseDir, "incomplete.json", { id: "incomplete", name: "Incomplete" });
    await writeConfig(baseDir, "complete.json", {
      id: "complete", name: "Complete", path: "/repos/complete", enabled: true, exclude_patterns: [],
    });

    const result = await loadRepositories(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("complete");
  });
});

// 境界値

describe("境界値", () => {
  it("TC7: .repo-bridge/ が空ディレクトリの場合に空配列を返す", async () => {
    await mkdir(repoBridgeDir(baseDir));

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });

  it("TC8: サブディレクトリ内のJSONを対象外とする", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await mkdir(join(repoBridgeDir(baseDir), "sub"));
    await writeFile(
      join(repoBridgeDir(baseDir), "sub", "repo.json"),
      JSON.stringify({ id: "sub-repo", name: "Sub", path: "/repos/sub", enabled: true, exclude_patterns: [] })
    );

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });

  it("TC9: .json 以外のファイルを無視する", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeFile(join(repoBridgeDir(baseDir), "config.yaml"), "id: yaml-repo");
    await writeFile(join(repoBridgeDir(baseDir), "notes.txt"), "some text");

    const result = await loadRepositories(baseDir);

    expect(result).toEqual([]);
  });
});
