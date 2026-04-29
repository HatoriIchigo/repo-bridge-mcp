# repo-bridge-mcp

## 概要

複数リポジトリに分散したコード・ドキュメントを横断的に参照するMCPサーバ。

**主な機能:**

- リポジトリ横断のファイル検索・コンテンツ検索
- 作業コンテキストに応じた関連ファイルの自動取得
- **RAG（Retrieval-Augmented Generation）によるセマンティック検索**
  - AWS S3からEmbedding DBを同期
  - ドキュメント（`.md`, `.txt`）に対するベクトル検索
  - `/rag-search` スラッシュコマンドで明示的に呼び出し

必要な情報のみを動的に取得し、ノイズを抑えつつ安全にプロジェクト全体の理解を補助する。

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Node.js
- **MCPフレームワーク**: @modelcontextprotocol/sdk
- **形態素解析**: kuromoji
- **ベクトルDB**: Chroma / Qdrant（RAG機能）
- **クラウド**: AWS S3（Embedding同期）
- **パッケージ管理**: npm

## セットアップ

```bash
npm install
npm run build
```

## 使い方

### Claude Codeへの登録

`claude mcp add` でstdioサーバとして登録する。

```bash
claude mcp add repo-bridge -- node /path/to/repo-bridge-mcp/dist/index.js
```

### 設定

参照対象リポジトリをプロジェクトルートの `.repo-bridge/settings.json` に配列形式で記述する。

#### ディレクトリ構成

```
<project-root>/
└── .repo-bridge/
    └── settings.json   ← 唯一の設定ファイル
```

#### settings.json の形式

```jsonc
// .repo-bridge/settings.json
{
  "repositories": [
    {
      "id": "my-repo",
      "name": "My Repository",
      "path": "/path/to/my-repo",
      "enabled": true,
      "exclude_patterns": ["node_modules", ".git"],
      "cache_exclude_patterns": ["src/**"]
    },
    {
      "id": "another-repo",
      "name": "Another Repository",
      "path": "/path/to/another-repo",
      "enabled": false,
      "exclude_patterns": ["dist"]
    }
  ],
  "local_cache": true,
  "cache_delete": true,
  "rag": {
    "enabled": true,
    "aws_profile": "default",
    "s3_bucket": "my-embeddings-bucket",
    "s3_prefix": "embeddings/"
  }
}
```

**グローバルフィールド**

| フィールド | 型 | 省略時 | 説明 |
| --- | --- | --- | --- |
| `local_cache` | boolean | `true` | `true` でディスクキャッシュを有効化 |
| `cache_delete` | boolean | `true` | `true` でMCP起動時に `.repo-bridge/cache/` を削除して初期化 |
| `rag` | object | - | RAG機能設定（省略時はRAG無効） |
| `rag.enabled` | boolean | `false` | `true` でRAG機能を有効化 |
| `rag.aws_profile` | string | - | `~/.aws/credentials` のプロファイル名 |
| `rag.s3_bucket` | string | - | Embedding DBのS3バケット名 |
| `rag.s3_prefix` | string | - | S3プレフィクス（例: `embeddings/`） |

**リポジトリフィールド**

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | ○ | リポジトリの一意識別子 |
| `name` | string | ○ | 表示名 |
| `path` | string | ○ | ローカルFS上の絶対パス |
| `enabled` | boolean | ○ | `false` にすると参照対象から除外 |
| `exclude_patterns` | string[] | ○ | 検索除外パターン（空配列可） |
| `cache_exclude_patterns` | string[] | - | キャッシュ対象外パターン（globパターン形式、省略時は全ファイルをキャッシュ） |

詳細は `docs/design.md` 参照。

### RAG機能の使用

#### 前提条件

- AWS S3にEmbedding DB（`all.db`）がアップロード済み
- `~/.aws/credentials` にプロファイル設定済み
- ローカルストレージに500MB以上の空き容量

#### 利用手順

1. `settings.json` で `rag.enabled: true` を設定
2. MCP起動時に自動でS3から `.repo-bridge/embeddings/all.db` をダウンロード
3. Claude Codeで `/rag-search <検索クエリ>` を実行

#### 同期動作

- ローカルに `all.db` が存在する場合はそれを使用
- S3の `LastModified` がローカルより新しい場合は再ダウンロード
- ダウンロード失敗時は既存ファイルを使用して警告ログ出力

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存パッケージインストール |
| `npm run build` | ビルド |
| `npm run dev` | 開発サーバ起動 |
| `npm test` | テスト実行 |

## ドキュメント

- [設計書](docs/design.md)
