# コンテキスト：F-005 ディスクキャッシュ実装

## 1. 目的・背景

### 実装目的

- `search_files`（`walkDir` 結果）および `read_file`（ファイル内容）をディスクに永続化し、MCP再起動後もキャッシュを再利用可能にする
- ディスクキャッシュにより、大規模リポジトリでの繰り返し呼び出し時のディスクIOを削減する

### ビジネス要件

- `settings.json` に `cache_delete` フラグを追加し、起動時の動作を制御する
  - `cache_delete: true`（デフォルト）: MCP起動時に `.repo-bridge/cache/` を削除してから使用
  - `cache_delete: false`: 起動時に削除しない（前回キャッシュを再利用）
- キャッシュは `.repo-bridge/cache/{repository_id}.json` に保存する

---

## 2. 機能要件

### 2.1 CacheStore の責務

- `.repo-bridge/cache/{repository_id}.json` にリポジトリ単位でキャッシュを保存・読み込む
- `files` のキー一覧から `walkDir` 結果（相対パス一覧）を復元できる
- `read_file` 呼び出し時にキャッシュから内容を返す（キャッシュヒット）
- キャッシュミス時のみ実ファイルを読み、読んだ内容を固定行数（20行）でチャンク分割してキャッシュJSONに書き込む（遅延キャッシュ）
- `read_file` のレスポンスは引き続き全文を返す（チャンクはキャッシュ書き込み用途のみ）
- `search_content` / `get_context` はキャッシュ対象外
- `RepositoryConfig` の `cache_exclude_patterns` に一致するファイルはキャッシュに書き込まない

### 2.2 キャッシュファイル構造

保存先: `.repo-bridge/cache/{repository_id}.json`

```json
{
  "repository_id": "my-repo",
  "repository_name": "My Repo",
  "created_at": "2026-04-28T00:00:00.000Z",
  "files": {
    "src/index.ts": {
      "chunks": ["行1\n行2\n...行20", "行21\n行22\n...行40"],
      "cached_at": "2026-04-28T12:00:00.000Z"
    },
    "README.md": {
      "chunks": ["行1\n行2\n...行20"],
      "cached_at": "2026-04-28T12:01:00.000Z"
    }
  }
}
```

- JSON形式（minifyなし、人間が読めるテキスト）
- `files` のキーは `walkDir` が返す相対パスと同一形式
- `chunks` は20行ごとに分割した文字列の配列
- `cached_at` は各ファイルを読み込んだ日時（ISO 8601形式）
- `cache_exclude_patterns` にマッチするファイルは `files` に書き込まない

### 2.3 settings.json 変更

グローバル設定に `cache_delete: boolean` を追加（省略時は `true` として扱う）。
リポジトリ設定に `cache_exclude_patterns: string[]` を追加（省略時は `[]` として扱い、全ファイルをキャッシュ対象にする）。

```json
{
  "repositories": [
    {
      "id": "my-repo",
      "name": "My Repo",
      "path": "/path/to/repo",
      "enabled": true,
      "exclude_patterns": ["node_modules", ".git"],
      "cache_exclude_patterns": ["src/**"]
    }
  ],
  "local_cache": true,
  "cache_delete": true
}
```

- `cache_exclude_patterns` は `exclude_patterns` と同じglobパターン形式
- `exclude_patterns` で除外されたファイルは `cache_exclude_patterns` の評価対象外（既に除外済みのため）

**フラグの関係**:
- `local_cache: false` の場合、`cache_delete` の値に関わらずキャッシュ機能は無効（ディスク読み書き・削除処理いずれも行わない）
- `local_cache: true` かつ `cache_delete: true` の場合、起動時に `cache/` を削除してからキャッシュを使用する
- `local_cache: true` かつ `cache_delete: false` の場合、起動時に `cache/` を削除せず前回キャッシュを再利用する

### 2.4 起動時の cache/ 削除処理

`index.ts` の `server.connect` 前に以下を実行する:
- `loadRepositories` から `cache_delete` フラグを読み込む
- `cache_delete` が `true`（またはフィールド未設定）のとき `.repo-bridge/cache/` ディレクトリを削除（存在しない場合はスキップ）

### 2.5 searchFiles との統合

`searchFiles` 内で `CacheStore` を参照し、キャッシュに `files` キー一覧が存在する場合は `walkDir` を呼ばずにキャッシュから復元した一覧を使用する。

### 2.6 readFileContent との統合

`readFileContent` 内で `CacheStore` を参照し、キャッシュにファイルエントリが存在する場合は `chunks` を結合して全文を返す。キャッシュにない場合は実ファイルを読み、全文をレスポンスとして返しつつ、`cache_exclude_patterns` に非該当のファイルのみ20行チャンクに分割して `CacheStore` に書き込む。

---

## 3. 非機能要件

| 項目 | 要件 |
|------|------|
| パフォーマンス | キャッシュヒット時は `walkDir`・`readFile` のディスクIOを0回にする |
| キャッシュ一貫性 | `cache_delete: true`（デフォルト）時は起動毎にキャッシュをリセットする。`cache_delete: false` 時は前回キャッシュを再利用し、ファイル変更は反映されない。変更を反映するには `cache_delete: true` で再起動するか、`.repo-bridge/cache/` を手動削除する |
| セキュリティ | `readFileContent` のパストラバーサル検証ロジックは変更しない |
| 堅牢性 | キャッシュJSONのパース失敗・書き込み失敗は個別にスキップし、実ファイルアクセスにフォールバックする |

---

## 4. 技術要件

- **言語**: TypeScript（strict モード）
- **ランタイム**: Node.js 22+
- **フレームワーク**: @modelcontextprotocol/sdk
- **テスト**: Jest（@jest/globals）
- **fs API**: `fs/promises`（`rm`, `mkdir`, `readFile`, `writeFile`）

---

## 5. 対象ファイル

| ファイルパス | 区分 | 変更内容 |
|------------|------|---------|
| `src/cache-store.ts` | 新規 | CacheStore クラス |
| `src/file-searcher.ts` | 修正 | `searchFiles`・`readFileContent` で CacheStore を参照 |
| `src/repository-manager.ts` | 修正 | `cache_delete` フラグの読み込みを追加 |
| `src/index.ts` | 修正 | 起動時に `cache_delete: false` なら `cache/` を削除 |
| `src/types.ts` | 修正 | `Settings` 型に `cache_delete?: boolean`、`RepositoryConfig` 型に `cache_exclude_patterns?: string[]` を追加 |
| `src/test/cache-store.test.ts` | 新規 | CacheStore の単体テスト |
| `docs/design.md` | 修正 | F-005説明・アーキテクチャ図・データモデルをディスクキャッシュ仕様に更新 |

---

## 6. テスト要件（TDD）

### 6.1 開発手法

- **TDD（テスト駆動開発）**: Red-Green-Refactor サイクル厳守
- **テストファースト**: `src/test/cache-store.test.ts` を先に書いてから実装する
- **カバレッジ目標**: 90%以上

### 6.2 コーディング規約

- `interface`・`type` の型定義を全て `src/types.ts` に集約する
- 全パブリック関数に JSDoc コメントを付与する（`/** */` 形式）
- 命名規則: `camelCase`（関数・変数）、`PascalCase`（クラス・インタフェース）、`UPPER_SNAKE_CASE`（定数）

### 6.3 テストケース

#### 正常系

1. キャッシュヒット: `search_files` でキャッシュから `walkDir` 結果を返す
    **given**:
        - `.repo-bridge/cache/my-repo.json` の `files` に `"src/index.ts": { "chunks": ["const x = 1;"], "cached_at": "2026-04-28T12:00:00.000Z" }` と `"README.md": { "chunks": ["# Title"], "cached_at": "2026-04-28T12:00:00.000Z" }` が存在する
        - `local_cache: true`
    **when**:
        - `searchFiles({ pattern: "*.ts", repository_id: "my-repo", configs })` を呼び出す
    **then**:
        - `walkDir` が呼ばれない
        - 返却値に `{ repository_id: "my-repo", path: "src/index.ts", type: "file" }` が含まれる

2. キャッシュヒット: `read_file` でキャッシュの `chunks` を結合して全文を返す
    **given**:
        - `.repo-bridge/cache/my-repo.json` の `files` に `"src/index.ts": { "chunks": ["const x = 1;\nconst y = 2;"], "cached_at": "2026-04-28T12:00:00.000Z" }` が存在する
        - `local_cache: true`
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/index.ts", configs })` を呼び出す
    **then**:
        - `readFile` が呼ばれない
        - 返却値が `"const x = 1;\nconst y = 2;"` である（chunks を結合した全文）

3. キャッシュミス: `read_file` で実ファイルを読んでチャンク分割してキャッシュに書き込む
    **given**:
        - `.repo-bridge/cache/my-repo.json` が存在しない（またはキーなし）
        - 実ファイル `src/utils.ts` の内容が `"export const a = 2;"` である
        - `local_cache: true`、`cache_exclude_patterns: []`
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/utils.ts", configs })` を呼び出す
    **then**:
        - `readFile` が1回呼ばれる
        - 返却値が `"export const a = 2;"` である（全文）
        - `.repo-bridge/cache/my-repo.json` の `files["src/utils.ts"]` が `{ "chunks": ["export const a = 2;"], "cached_at": "<書き込み時のISO 8601日時>" }` で書き込まれる

4. `cache_exclude_patterns` に一致するファイルはキャッシュに書き込まない
    **given**:
        - `cache_exclude_patterns: ["src/**"]`
        - 実ファイル `src/utils.ts` の内容が `"export const a = 2;"` である
        - `local_cache: true`
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/utils.ts", configs })` を呼び出す
    **then**:
        - 返却値が `"export const a = 2;"` である（全文）
        - `.repo-bridge/cache/my-repo.json` の `files["src/utils.ts"]` が書き込まれない

5. `cache_delete: true` 時の起動時キャッシュ削除
    **given**:
        - `.repo-bridge/cache/` ディレクトリに `my-repo.json` が存在する
        - `settings.json` の `cache_delete: true`
    **when**:
        - MCP起動処理（`index.ts` の初期化）を実行する
    **then**:
        - `.repo-bridge/cache/` ディレクトリが削除される

6. `cache_delete: false` 時の起動時キャッシュ保持
    **given**:
        - `.repo-bridge/cache/my-repo.json` が存在する
        - `settings.json` の `cache_delete: false`
    **when**:
        - MCP起動処理を実行する
    **then**:
        - `.repo-bridge/cache/my-repo.json` が削除されない

#### 異常系

7. キャッシュJSONのパース失敗時は実ファイルにフォールバック
    **given**:
        - `.repo-bridge/cache/my-repo.json` の内容が `"INVALID_JSON"` である
        - 実ファイル `src/index.ts` の内容が `"const z = 3;"` である
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/index.ts", configs })` を呼び出す
    **then**:
        - `readFile` が1回呼ばれる
        - 返却値が `"const z = 3;"` である

8. キャッシュ書き込み失敗時はエラーをスローせず正常終了
    **given**:
        - `.repo-bridge/cache/` が書き込み不可権限になっている
    **when**:
        - `readFileContent` を呼び出しキャッシュ書き込みを試みる
    **then**:
        - 呼び出し元にエラーがスローされない
        - 返却値は実ファイルの内容である

9. `cache/` ディレクトリが存在しない状態で `cache_delete: false` の削除処理を実行
    **given**:
        - `.repo-bridge/cache/` が存在しない
        - `settings.json` の `cache_delete: false`
    **when**:
        - 起動時の削除処理を実行する
    **then**:
        - エラーがスローされない

#### 境界値

10. `files` が空オブジェクト `{}` のキャッシュで `searchFiles` を呼び出す
    **given**:
        - `.repo-bridge/cache/my-repo.json` の `files` が `{}` である
    **when**:
        - `searchFiles({ pattern: "*.ts", repository_id: "my-repo", configs })` を呼び出す
    **then**:
        - `walkDir` が呼ばれない
        - 返却値が `[]` である

11. `cache_delete` フィールドが `settings.json` に存在しない場合は `true` として扱う
    **given**:
        - `settings.json` に `cache_delete` フィールドが存在しない
    **when**:
        - 起動時の削除処理を実行する
    **then**:
        - `.repo-bridge/cache/` が削除される（`true` 相当の動作）

12. `local_cache: false` 時は `cache_delete: true` でもキャッシュを使用しない
    **given**:
        - `settings.json` の `local_cache: false`、`cache_delete: true`
        - `.repo-bridge/cache/my-repo.json` の `files` に `"src/index.ts": { "chunks": ["const x = 1;"], "cached_at": "2026-04-28T12:00:00.000Z" }` が存在する
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/index.ts", configs })` を呼び出す
    **then**:
        - キャッシュを参照せず実ファイルを読む
        - `.repo-bridge/cache/` に書き込みを行わない

13. `cache_exclude_patterns` が未指定の場合は全ファイルをキャッシュ対象にする
    **given**:
        - `RepositoryConfig` に `cache_exclude_patterns` フィールドが存在しない
        - 実ファイル `src/index.ts` の内容が `"const x = 1;"` である
        - `local_cache: true`
    **when**:
        - `readFileContent({ repository_id: "my-repo", path: "src/index.ts", configs })` を呼び出す
    **then**:
        - `.repo-bridge/cache/my-repo.json` の `files["src/index.ts"]` が書き込まれる

---

## 7. 制約事項・前提条件

- `search_content` / `get_context` はキャッシュ対象外（本タスクのスコープ外）
- `local_cache` フィールドの削除・リネームは行わない（後方互換性を維持）
- パストラバーサル検証ロジック（`readFileContent` の `resolve` 比較）は変更しない
- キャッシュのTTL・自動無効化は実装しない

---

## 8. 実装方針

### 8.1 開発手法

- **TDD**: `src/test/cache-store.test.ts` を先に実装し、Red → Green → Refactor の順で進める

### 8.2 使用エージェント

- 利用可能エージェントを確認済み。以下を使用する:
  - `code-explorer`: 既存実装との整合性確認
  - `code-design-reviewer`: 実装後のレビュー支援

---

## 9. 終了条件

以下の全条件を満たした時点で完了とする:

- [ ] `src/test/cache-store.test.ts` の全テストケース（正常系・異常系・境界値）がパスする
- [ ] `npm test` が全件パスする
- [ ] `search_files` がキャッシュヒット時に `walkDir` を呼ばない
- [ ] `read_file` がキャッシュヒット時に `readFile` を呼ばない
- [ ] `read_file` がキャッシュミス時に実ファイルを読んでキャッシュを更新する
- [ ] `cache_delete: true` 時にMCP起動で `.repo-bridge/cache/` が削除される
- [ ] `docs/design.md` の F-005 説明・アーキテクチャ図・データモデルがディスクキャッシュ仕様に更新されている
- [ ] TypeScript コンパイルエラーが0件（`npm run build` 成功）
