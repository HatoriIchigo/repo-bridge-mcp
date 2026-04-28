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

参照対象リポジトリをプロジェクトルートの `.repo-bridge/` ディレクトリにJSONファイルとして配置する。

```jsonc
// .repo-bridge/my-repo.json
{
  "id": "my-repo",
  "name": "My Repository",
  "path": "/path/to/my-repo",
  "enabled": true,
  "exclude_patterns": ["node_modules", ".git"]
}
```

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
