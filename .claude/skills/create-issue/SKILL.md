---
name: create-issue
description: GitHub Issueを作成する
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[issue-title]"
---

# GitHub Issueを作成する

## 手順

### 1. リモートリポジトリを確認する

現在のリポジトリのリモート設定を確認し、フォークリポジトリに Issue を作成することを確認する。

```bash
git remote -v
```

- `origin`: フォークリポジトリ（aromarious/aw-watcher-vscode）
- `upstream`: 本家リポジトリ（ActivityWatch/aw-watcher-vscode）

**重要**: このプロジェクトはフォークなので、Issue は必ず `origin`（フォークリポジトリ）に作成する。

### 2. Issue のタイトルと本文を準備する

ユーザーの要求に基づいて、以下を準備する：

- **タイトル**: 簡潔でわかりやすい日本語のタイトル
- **本文**:
  - 現状の問題
  - 原因分析
  - 提案内容
  - 実装案（コード例を含む場合）
  - 期待される効果
  - 検討事項

**注意**: すべて日本語で記述する（CLAUDE.md のグローバルポリシーに従う）

### 3. ユーザーに内容を確認する

Issue の内容をユーザーに提示し、確認を得る。

- タイトル
- 本文の概要

### 4. フォークリポジトリに Issue を作成する

`gh` コマンドを使用して、**フォークリポジトリ**（origin）に Issue を作成する。

```bash
gh issue create --repo aromarious/aw-watcher-vscode --title "<ISSUE_TITLE>" --body "$(cat <<'EOF'
<ISSUE_BODY>
EOF
)"
```

**重要**: `--repo` オプションで必ずフォークリポジトリを指定する。

### 5. 作成完了をユーザーに報告する

- 作成された Issue の番号と URL を伝える
- 本家リポジトリに誤って作成していないことを確認する

## エラーハンドリング

### 本家リポジトリに誤って作成した場合

以下の手順で対応する：

1. 本家の Issue を閉じる
   ```bash
   gh issue close <ISSUE_NUMBER> --repo ActivityWatch/aw-watcher-vscode --comment "Sorry, wrong repository. This issue should be created in the fork repository."
   ```

2. フォークリポジトリに Issue を作り直す

## 注意事項

- このプロジェクトはフォークなので、本家（upstream）ではなくフォーク（origin）に Issue を作成する
- 本家への PR が必要な場合は、別途 `upstream-pr/*` ブランチを作成して対応する
- すべてのコメントとドキュメントは日本語で記述する
