import { readFile, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import type { CacheData, CacheFileEntry } from "./types.js";

const CHUNK_SIZE = 20;

/** ファイル内容を CHUNK_SIZE 行ごとに分割して文字列配列を返す。 */
function splitIntoChunks(content: string): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    chunks.push(lines.slice(i, i + CHUNK_SIZE).join("\n"));
  }
  return chunks.length > 0 ? chunks : [content];
}

/**
 * リポジトリ単位のディスクキャッシュを管理するクラス。
 * キャッシュファイルは `.repo-bridge/cache/{repository_id}.json` に保存される。
 */
export class CacheStore {
  private readonly cacheDir: string;
  private readonly enabled: boolean;
  private readonly memCache = new Map<string, CacheData>();

  /**
   * @param baseDir - `.repo-bridge/` を含む親ディレクトリ（process.cwd() 相当）
   * @param enabled - local_cache フラグ（false の場合はキャッシュ機能を無効化）
   */
  constructor(baseDir: string, enabled: boolean) {
    this.cacheDir = join(baseDir, ".repo-bridge", "cache");
    this.enabled = enabled;
  }

  /** キャッシュが有効かどうかを返す。 */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 指定リポジトリのキャッシュデータを読み込む。失敗時は null を返す。 */
  private async load(repositoryId: string): Promise<CacheData | null> {
    if (this.memCache.has(repositoryId)) {
      return this.memCache.get(repositoryId)!;
    }
    const filePath = join(this.cacheDir, `${repositoryId}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as CacheData;
      this.memCache.set(repositoryId, data);
      return data;
    } catch {
      return null;
    }
  }

  /** キャッシュデータをディスクに書き込む。失敗時はスキップ（例外を外へ伝播しない）。 */
  private async save(repositoryId: string, data: CacheData): Promise<void> {
    const filePath = join(this.cacheDir, `${repositoryId}.json`);
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
      this.memCache.set(repositoryId, data);
    } catch {
      // 書き込み失敗はスキップ
    }
  }

  /**
   * 指定リポジトリのキャッシュに登録されたファイルパス一覧を返す。
   * キャッシュが存在しない場合は null を返す（walkDir が必要なことを示す）。
   */
  async getFileList(repositoryId: string): Promise<string[] | null> {
    if (!this.enabled) return null;
    const data = await this.load(repositoryId);
    if (!data) return null;
    return Object.keys(data.files);
  }

  /**
   * 指定ファイルのキャッシュヒットを確認し、内容を結合して返す。
   * キャッシュが存在しない場合は null を返す。
   */
  async getFileContent(repositoryId: string, filePath: string): Promise<string | null> {
    if (!this.enabled) return null;
    const data = await this.load(repositoryId);
    if (!data) return null;
    const entry = data.files[filePath];
    if (!entry) return null;
    return entry.chunks.join("");
  }

  /**
   * ファイル内容をキャッシュに書き込む。
   * @param repositoryId - リポジトリID
   * @param repositoryName - リポジトリ名
   * @param filePath - リポジトリルートからの相対パス
   * @param content - ファイル全文
   */
  async setFileContent(
    repositoryId: string,
    repositoryName: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    if (!this.enabled) return;

    let data = await this.load(repositoryId);
    if (!data) {
      data = {
        repository_id: repositoryId,
        repository_name: repositoryName,
        created_at: new Date().toISOString(),
        files: {},
      };
    }

    const entry: CacheFileEntry = {
      chunks: splitIntoChunks(content),
      cached_at: new Date().toISOString(),
    };
    data.files[filePath] = entry;
    await this.save(repositoryId, data);
  }
}

/**
 * 起動時のキャッシュクリア処理。
 * cache_delete が true（または未設定）のとき `.repo-bridge/cache/` を削除する。
 * @param baseDir - `.repo-bridge/` を含む親ディレクトリ
 * @param cacheDelete - cache_delete フラグ（未設定時は true として扱う）
 */
export async function clearCacheIfNeeded(baseDir: string, cacheDelete: boolean | undefined): Promise<void> {
  const shouldDelete = cacheDelete !== false;
  if (!shouldDelete) return;

  const cacheDir = join(baseDir, ".repo-bridge", "cache");
  try {
    await rm(cacheDir, { recursive: true, force: true });
  } catch {
    // 存在しない場合はスキップ
  }
}
