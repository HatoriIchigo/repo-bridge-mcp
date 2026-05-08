import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
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

// path変数展開

describe("path変数展開 正常系", () => {
  const originalHome = process.env["HOME"];
  let cwdSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    process.env["HOME"] = "/home/testuser";
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env["HOME"];
    } else {
      process.env["HOME"] = originalHome;
    }
    if (cwdSpy) cwdSpy.mockRestore();
  });

  it("TC10: ${HOME} を含む path が process.env.HOME の値に展開されること", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}/repos/my-repo", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/home/testuser/repos/my-repo");
  });

  it("TC11: ${CUR} を含む path が process.cwd() の値に展開されること", async () => {
    cwdSpy = jest.spyOn(process, "cwd").mockReturnValue("/workspace");
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${CUR}/repos/my-repo", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/workspace/repos/my-repo");
  });

  it("TC12: ${HOME} と ${CUR} を含まない path は変更されないこと", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "/absolute/path/to/repo", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/absolute/path/to/repo");
  });

  it("TC13: path 内に ${HOME} と ${CUR} が両方含まれる場合、両方展開されること", async () => {
    cwdSpy = jest.spyOn(process, "cwd").mockReturnValue("/workspace");
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}/base/${CUR}/sub", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/home/testuser/base//workspace/sub");
  });

  it("TC14: path 内に ${HOME} が複数回現れる場合、全て展開されること", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}/${HOME}", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/home/testuser//home/testuser");
  });
});

describe("path変数展開 異常系", () => {
  const originalHome = process.env["HOME"];
  let cwdSpy: ReturnType<typeof jest.spyOn>;

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env["HOME"];
    } else {
      process.env["HOME"] = originalHome;
    }
    if (cwdSpy) cwdSpy.mockRestore();
  });

  it("TC15: ${HOME} を含む path で process.env.HOME が undefined の場合、エラーをスローすること", async () => {
    delete process.env["HOME"];
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}/repos/my-repo", enabled: true, exclude_patterns: [] },
    ]);

    await expect(loadRepositories(baseDir)).rejects.toThrow("Variable ${HOME} is not defined");
  });

  it("TC16: ${HOME} を含む path で process.env.HOME が空文字の場合、エラーをスローすること", async () => {
    process.env["HOME"] = "";
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}/repos/my-repo", enabled: true, exclude_patterns: [] },
    ]);

    await expect(loadRepositories(baseDir)).rejects.toThrow("Variable ${HOME} is not defined");
  });

  it("TC17: ${CUR} を含む path で process.cwd() が空文字を返す場合、エラーをスローすること", async () => {
    process.env["HOME"] = "/home/testuser";
    cwdSpy = jest.spyOn(process, "cwd").mockReturnValue("");
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${CUR}/repos/my-repo", enabled: true, exclude_patterns: [] },
    ]);

    await expect(loadRepositories(baseDir)).rejects.toThrow("Variable ${CUR} is not defined");
  });
});

describe("path変数展開 境界値", () => {
  const originalHome = process.env["HOME"];

  beforeEach(() => {
    process.env["HOME"] = "/home/testuser";
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env["HOME"];
    } else {
      process.env["HOME"] = originalHome;
    }
  });

  it("TC18: path が ${HOME} のみの場合、ホームディレクトリそのものに展開されること", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "${HOME}", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("/home/testuser");
  });

  it("TC19: path が空文字の場合、展開処理が行われず空文字のまま返ること", async () => {
    await mkdir(repoBridgeDir(baseDir));
    await writeSettings(baseDir, [
      { id: "my-repo", name: "My Repository", path: "", enabled: true, exclude_patterns: [] },
    ]);

    const result = await loadRepositories(baseDir);

    expect(result[0].path).toBe("");
  });
});
