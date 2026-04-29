# RAG設計の課題一覧

## 1. Embedding生成プロセスが未定義

[design.md:229](design.md#L229) で「AWS側で事前生成したものを使用」とあるが、以下が不明確

- Embedding生成のトリガー（手動 or 自動）
- 生成対象リポジトリの選定方法
- ドキュメント更新時の再生成フロー
- Embedding生成コストの見積もり
- 複数リポジトリのEmbeddingをどう統合するか

## 2. ベクトルDB選定が曖昧

[design.md:24](design.md#L24) および [design.md:237](design.md#L237) で「Chroma / Qdrant」と両論併記だが、選定基準が不明

- どちらを採用するか未決定
- 両方サポートするのか片方に絞るのか不明
- [design.md:359](design.md#L359) で「ネイティブ形式（`.db`）」を推奨しているが、ChromaとQdrantで形式が異なる可能性

## 3. Embedding対象の定義が不完全

[design.md:207](design.md#L207) で「`**/*.md`, `**/*.txt` のみ」とあるが、以下が未定義

- リポジトリ配下の全ドキュメント対象か、特定ディレクトリのみか
- `exclude_patterns` がEmbedding生成時に適用されるか不明
- ドキュメントサイズの上限（例: 10MB超のMarkdownファイル）
- Embeddingのチャンク分割戦略（行数 or トークン数 or セマンティック境界）

## 4. S3パス設計が不明瞭

[design.md:210](design.md#L210) で元ドキュメントのS3パスを定義しているが、Embedding DBのパスと不整合

- Embedding DB: `{s3_bucket}/{s3_prefix}/all.db`
- 元ドキュメント: `{s3_bucket}/{s3_prefix}/documents/{repository_id}/{file_path}`

「`all.db`」が全リポジトリ統合だが、元ドキュメントは `repository_id` で分離されている。`all.db` 内でリポジトリIDをどう識別するかが不明

## 5. TTL管理の実装方法が未定義

[design.md:210](design.md#L210) で「TTL 24時間」とあるが、実装詳細が不明

- TTL管理は `document-fetcher.ts` が行うのか、別途cron的な仕組みが必要か
- ファイルのメタデータ（最終アクセス日時）をどこに保存するか
- 古いキャッシュの削除タイミング（起動時 or 定期実行）

## 6. エラーハンドリングが不完全

[design.md:261-281](design.md#L261-L281) のフローチャートに以下のケースが欠落

- S3接続エラー（ネットワーク断 or 認証失敗）時の挙動
- `LastModified` 取得失敗時のフォールバック処理
- ローカル `all.db` が破損している場合の対応
- Embedding検索中にDBアクセスエラーが発生した場合

## 7. パフォーマンス要件の根拠不明

[design.md:199](design.md#L199) で「セマンティック検索は500ms以内」とあるが、根拠が不明

- Embedding DBのサイズ（50〜200MB）から算出した値か
- ベクトル検索のアルゴリズム（HNSW or Flat）は何を想定しているか
- `top_k` の値による性能変化を考慮しているか

## 8. Skills（スラッシュコマンド）の設計が抽象的

[design.md:285-353](design.md#L285-L353) のSkills設計が実装に不十分

- Skills実装ファイル（`.claude/skills/rag-*.md`）の配置場所が未定義
- MCPツールとSkillsの呼び出しフローが不明瞭（SkillsがMCPツールを呼ぶのか、直接 `rag-provider.ts` を呼ぶのか）
- `/rag-fetch` の `<path>` がリポジトリID込みか、単一パスか不明

## 9. 同期処理の競合制御が未定義

[design.md:206](design.md#L206) で「起動時にS3と比較してダウンロード」とあるが、並列起動時の制御が不明

- 複数MCPプロセスが同時起動した場合の排他制御
- ダウンロード中に別プロセスが `all.db` を読み込もうとした場合

## 10. データモデルの不整合

[design.md:149-174](design.md#L149-L174) のER図に以下の問題

- `VectorEntry.document_path` と `FileEntry.path` の関係が不明（外部キー制約なし）
- `SemanticResult.repository_id` がどこから取得されるか不明（`VectorEntry` にリポジトリID情報がない）
- `EmbeddingDB.synced_at` と `s3_last_modified` の更新タイミングが未定義

## 11. ストレージ容量見積もりの根拠不明

[design.md:208](design.md#L208) で「50〜200MB」とあるが、算出根拠が不明

- 何リポジトリ・何ドキュメント分を想定しているか
- Embeddingの次元数（例: 1536次元 for OpenAI）による容量変化
- ドキュメント追加時の容量増加率

## 12. 機能一覧とツール一覧の不整合

[design.md:65](design.md#L65) の機能F-007「Skills経由で明示的に呼び出し」と、[design.md:83](design.md#L83) の `semantic_search` ツールが矛盾

- Skillsが `semantic_search` ツールを呼ぶなら、ツール自体はMCPに登録される必要がある
- Skills専用でツールを隠蔽するのか、ツールも直接呼び出し可能にするのか不明

---

## 影響度分析

| 問題カテゴリ | 影響度 | 実装への影響 |
|-------------|--------|------------|
| Embedding生成プロセス未定義 | **致命的** | AWS側の実装方針が決まらない |
| ベクトルDB選定が曖昧 | **致命的** | 依存パッケージ・DB形式が確定しない |
| S3パス設計不明瞭 | 高 | AWS側のディレクトリ構成が決まらない |
| データモデル不整合 | 高 | `repository_id` の伝播方法が実装できない |
| Embedding対象未定義 | 中 | チャンク分割・除外ロジックが実装できない |
| エラーハンドリング不完全 | 中 | エッジケースの実装漏れリスク |
| TTL管理未定義 | 中 | キャッシュクリーンアップ機構が実装できない |
| Skills設計抽象的 | 中 | Skillsファイルの記述方法が不明 |
| 同期競合制御未定義 | 低 | 通常は単一プロセスで問題ないが、本番環境でリスク |
| パフォーマンス根拠不明 | 低 | 性能テストの基準が曖昧 |
| ストレージ見積もり不明 | 低 | 容量計画が曖昧 |
| 機能一覧とツール一覧不整合 | 低 | ドキュメント内の矛盾 |

---

## 結論

RAG設計は概念レベルで、実装可能な詳細度に達していない。特にEmbedding生成フロー・ベクトルDB選定・データモデルの整合性が最優先で解決が必要。
