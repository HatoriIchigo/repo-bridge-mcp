---
name: create-rule
description: Use this skill when creating a new rule file under .claude/rules/.
---

## create-ruleスキルとは

`.claude/rules/` に新しいルールファイルを作成し、Claude Codeが特定のタスクを正しく実行できるよう指示書を整備するスキル。

## 実行手順

### 1. 目的の確認

ルール作成前に以下を明確にする。

- **対象**: 何のファイル・何のタスクに適用するルールか
- **スコープ**: 特定ファイルへのpathフィルタが必要か
- **既存ルール**: `.claude/rules/` の既存ファイルと重複しないか

```bash
ls .claude/rules/
```

### 2. ファイル作成

`.claude/rules/<rule-name>.md` を作成する。

**frontmatter（対象ファイルが限定される場合のみ）:**

```markdown
---
path: CLAUDE.md
---
```

**本文構成:**

```markdown
# <ルール名>

## <対象の>位置づけ
（1〜2行）

## 書くべき内容
（セクションごとの記載要件）

## 記載例
（markdownコードブロックで具体例）

## 注意事項
- [ ] チェック項目1
- [ ] チェック項目2
```

### 3. ルールの検証

作成後に `.claude/rules/create-rule.md` のチェックリストで確認する。

- [ ] frontmatterが必要な場合のみ付与されているか
- [ ] 位置づけが1〜2行か
- [ ] 記載例が具体的か
- [ ] 注意事項がチェックリスト形式か
- [ ] 曖昧な表現がないか
- [ ] 既存ルールと重複していないか

### 4. 対応するスキルの作成（任意）

ルールと対になるスキルが必要な場合、`.claude/skills/<rule-name>/SKILL.md` も作成する。
スキルはユーザーが `/create-rule` のように呼び出す実行手順書として機能する。
