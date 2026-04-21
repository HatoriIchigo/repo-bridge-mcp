# AI駆動開発テンプレート　アプリケーション版

## 概要

このレポジトリはAI駆動開発で使用するテンプレートのアプリケーション版です。

## 適用ガイド

### 1. CLAUDE.md の適用

CLAUDE.mdをコピーし、プロジェクトルートに配置してください。
Claudeはデフォルトで、プロジェクトルートのCLAUDE.mdを読み込みます。

続けてCLAUDE.mdを修正します。
`.claude/rules/claude.md`をコピーし、ClaudeにCLAUDE.mdの更新を指示してください。

#### AGENTS.mdへのコピー

Claude Code以外のAIツール（Gemini CLI、Codex CLIなど）も併用する場合は、CLAUDE.mdをAGENTS.mdにコピーしてください。
AGENTS.mdは複数のAIエージェントが共通で参照する規約ファイルとして機能します。

```bash
cp CLAUDE.md AGENTS.md
```

Claude Codeのみを使用する場合、この手順は不要です。

### 2. コンテキストエンジニアリング用のプロンプトを移動

`.claude/rules/context.md`及び`.claude/skills/context-engineering/SKILL.md`を同じディレクトリに移動

#### コンテキストエンジニアリングの進め方

1. claudeにコンテキストファイルを`.context`ディレクトリ配下に作成してもらう
2. コンテキストファイルを人間やAIがレビューする
3. Claudeで`/clear`後にコンテキストファイルに沿って実装してもらう

### 3. MCPの活用

MCPを導入します。
Claudeの場合、`/plugin`で導入が可能です。

個人的には以下のプラグインをお勧めします。

| プラグイン名 | 説明 |
| -- | -- |
| context7 | 最新のドキュメントを反映可能 |
| serena | コーディング時のコンテキスト削減が可能 |
| Github MCP Server（任意） | Githubと連携が可能になり、issueの取得やプルリクの自動化が可能 |
| 各種LSPサーバ | LSPとやりとりすることで、丁寧なコーディングが可能になる |

なお、入れすぎるとコンテキストを圧縮するため、必要最低限で入れることをお勧めします

### 4. Gitブランチ戦略、コミットメッセージの修正

`.claude/skills/git-branch-strategy.md`を同じディレクトリに移動

プロジェクトに応じて、Gitのブランチ戦略、コミットメッセージの書き方などを修正してください。

### 5. design.mdの作成

`.claude/rules/design.md`及び`.claude/skills/design/SKILL.md`を同じディレクトリに移動

Claudeに`/design`を実行させ、`docs/design.md`を作成してください。

#### design.mdの進め方

1. Claudeに`/design`を実行させ、`docs/design.md`を作成してもらう
2. design.mdを人間やAIがレビューする
3. Claudeで`/clear`後にdesign.mdに沿って実装してもらう

### 6. screen.mdの作成

`.claude/rules/screen.md`及び`.claude/skills/screen/SKILL.md`を同じディレクトリに移動

Claudeに`/screen`を実行させ、`docs/screen.md`を作成してください。

#### screen.mdの進め方

1. `docs/design.md`が作成済みであること（手順5が完了していること）
2. Claudeに`/screen`を実行させ、`docs/screen.md`を作成してもらう
3. screen.mdを人間やAIがレビューする
4. Claudeで`/clear`後にscreen.mdに沿って実装してもらう

## 今後追加していきたいもの

- 単体テスト自動作成
- エージェント関連
- コードレビュー
- モックサーバ(frontend/backend)作成
- bugfix
