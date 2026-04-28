# repo-bridge-mcp

## 概要

複数リポジトリに分散したコード・ドキュメントを、現在の作業コンテキストに応じて横断的に参照するMCPサーバ。
必要な情報のみを動的に取得することで、ノイズを抑えつつ安全にプロジェクト全体の理解を補助する。

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Node.js
- **MCPフレームワーク**: @modelcontextprotocol/sdk
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
  "cache_delete": true
}
```

**グローバルフィールド**

| フィールド | 型 | 省略時 | 説明 |
|---|---|---|---|
| `local_cache` | boolean | `true` | `true` でディスクキャッシュを有効化 |
| `cache_delete` | boolean | `true` | `true` でMCP起動時に `.repo-bridge/cache/` を削除して初期化 |

**リポジトリフィールド**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ○ | リポジトリの一意識別子 |
| `name` | string | ○ | 表示名 |
| `path` | string | ○ | ローカルFS上の絶対パス |
| `enabled` | boolean | ○ | `false` にすると参照対象から除外 |
| `exclude_patterns` | string[] | ○ | 検索除外パターン（空配列可） |
| `cache_exclude_patterns` | string[] | - | キャッシュ対象外パターン（globパターン形式、省略時は全ファイルをキャッシュ） |

詳細は `docs/design.md` 参照。

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存パッケージインストール |
| `npm run build` | ビルド |
| `npm run dev` | 開発サーバ起動 |
| `npm test` | テスト実行 |

## ドキュメント

- [設計書](docs/design.md)
