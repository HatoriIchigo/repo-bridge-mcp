---
name: git-branch-strategy
description: Use this skill when deciding git branch names or branch strategy. Covers branch types, naming conventions, and branching workflow.
---

## ブランチ戦略

### ブランチ種別と役割

| ブランチ | 役割 | マージ先 |
|---------|------|---------|
| `main` | 商用リリース用。直接コミット禁止 | - |
| `staging` | リリース前の検証用 | `main` |
| `develop` | 開発統合ブランチ | `staging` |
| `feature/<機能名>` | 新機能追加 | `develop` |
| `fix/<バグ名>` | 通常バグ修正 | `develop` |
| `hotfix/<バグ名>` | 本番緊急バグ修正 | `main` + `develop` |
| `chore/<作業名>` | 依存更新・設定変更など機能に影響しない作業 | `develop` |
| `refactor/<対象名>` | リファクタリング | `develop` |
| `docs/<対象名>` | ドキュメントのみの変更 | `develop` |

### 命名規則

- 英小文字・数字・ハイフンのみ使用（アンダースコア不可）
- 単語はハイフン区切り
- 機能名・バグ名は具体的かつ簡潔に（20文字以内推奨）
- チケットIDがある場合は末尾に付与: `feature/login-page-PROJ-123`

### 命名例

```
feature/user-login
feature/payment-csv-export
fix/null-pointer-on-signup
hotfix/crash-on-startup
refactor/auth-service
chore/upgrade-spring-boot-3
docs/update-api-spec
```

### ブランチ運用フロー

```mermaid
gitGraph
  commit id: "initial"
  branch develop
  checkout develop
  branch feature/login
  checkout feature/login
  commit id: "add: ログイン機能"
  checkout develop
  merge feature/login
  branch staging
  checkout staging
  merge develop
  checkout main
  merge staging tag: "v1.0.0"
```

### ルール

- `main`・`staging` への直接プッシュ禁止
- `feature` / `fix` ブランチはマージ後に削除
- `hotfix` は `main` マージ後、必ず `develop` にも反映
- PRレビュー必須（最低1名のApprove）

## 注意事項

- [ ] ブランチ種別が上記テーブルのいずれかと一致しているか
- [ ] 英小文字・ハイフンのみで構成されているか
- [ ] 機能名・バグ名が具体的か（`fix/bug` のような曖昧な名前は不可）
- [ ] `hotfix` の場合、`main` と `develop` 両方へのマージ計画があるか
