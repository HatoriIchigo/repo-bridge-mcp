# CLAUDE.md

## プロジェクト概要

複数リポジトリに分散したコード・ドキュメントを横断的に参照するMCPサーバ。
ローカルファイルシステム検索に加え、AWS S3経由のRAG（Retrieval-Augmented Generation）によるセマンティック検索を提供。
必要な情報のみを動的に取得し、ノイズを抑えつつ安全にプロジェクト全体の理解を補助する。

## ディレクトリ構成

| ディレクトリ | 説明 |
| -- | -- |
| .adr/ | ADR配置場所 |
| .context/ | コンテキストファイル配置場所 |
| .devcontainer/ | DevContainer配置場所 |
| .repo-bridge/ | 設定・キャッシュ・Embedding配置場所 |
| docs/design.md | 設計ドキュメント |
| src/ | ソースコード |
| src/test/ | テストコード |

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Node.js
- **MCPフレームワーク**: @modelcontextprotocol/sdk
- **形態素解析**: kuromoji
- **ベクトルDB**: Chroma / Qdrant（RAG機能）
- **クラウド**: AWS S3（Embedding同期）
- **パッケージ管理**: npm

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存パッケージインストール |
| `npm run build` | ビルド |
| `npm run dev` | 開発サーバ起動 |
| `npm test` | テスト実行 |

## 応答原則

- 回答は全て日本語
- 体言止め・用言止めを使い、敬語・丁寧語は消去
- 「えーと」、「まあ」などのクッション言葉は禁止
- 情報水増しを禁止し、聞かれたことだけを回答する

## 行動原則

- 3ステップ以上のタスクは`Context Engineering`を取り入れる（コンテキストファイルの作成は`context-analyzer`エージェントを使用する）
- コンテキストファイル作成後は停止する。勝手に実装に入らない。
- 変更は必要な個所のみ、影響範囲を最小化する
- タスクの内容に応じ、`.claude/agents/` のエージェントを可能な範囲で活用する
