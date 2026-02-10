# 配布方法ガイド

## 概要

本家のパブリッシャー権限なしで改善版を配布する方法を説明します。VS Code Marketplaceに公開せず、.vsixファイルで配布します。

## なぜ.vsixファイルなのか？

### 理由

1. **本家への配慮**
   - パブリッシャー名「activitywatch」は使えない
   - 勝手に別名で公開するのは混乱を招く

2. **柔軟性**
   - ユーザーが手動でインストール
   - GitHub Releasesで簡単に配布
   - 将来的に本家にマージ可能性を残す

3. **シンプル**
   - マーケットプレイスのアカウント不要
   - 審査プロセス不要
   - 即座に配布可能

## .vsixファイルの作成

### 前提条件

```bash
# vsceツールをインストール
npm install -g @vscode/vsce
```

### ビルド手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/aw-watcher-vscode
cd aw-watcher-vscode

# 2. サブモジュールを初期化（aw-client-js）
git submodule update --init --recursive

# 3. 依存関係をインストール
npm install

# 4. TypeScriptをコンパイル
npm run compile

# 5. .vsixファイルを作成
npx vsce package

# 出力: aw-watcher-vscode-0.5.0.vsix
```

### トラブルシューティング

#### エラー: "This extension consists of X files, out of which Y are JavaScript files..."

大量のファイルが含まれている場合の警告。`.vscodeignore`で不要なファイルを除外：

```
# .vscodeignore
.vscode/**
.vscode-test/**
out/test/**
out/**/*.map
src/**
.gitignore
tsconfig.json
tslint.json
node_modules/**
docs/**
.git/**
.github/**
*.vsix
```

#### エラー: "Cannot find module 'aw-client-js'"

サブモジュールが正しく初期化されていない：

```bash
git submodule update --init --recursive
cd aw-client-js
npm install
cd ..
```

## ユーザーがインストールする方法

### 方法1: コマンドライン

```bash
# .vsixファイルをダウンロード後
code --install-extension aw-watcher-vscode-0.5.0.vsix
```

### 方法2: VSCode UI

1. VSCodeを開く
2. 拡張機能パネル（Cmd/Ctrl+Shift+X）を開く
3. 右上の`...`メニューをクリック
4. "VSIXからのインストール..."を選択
5. ダウンロードした`.vsix`ファイルを選択

### 方法3: Cursorの場合

Cursorでも同じ方法で動作します：

```bash
cursor --install-extension aw-watcher-vscode-0.5.0.vsix
```

## GitHub Releasesでの配布

### GitHub Actionsの設定

`.github/workflows/release.yml`を作成：

```yaml
name: Create Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          submodules: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          npm install -g @vscode/vsce

      - name: Install aw-client-js dependencies
        run: |
          cd aw-client-js
          npm install
          cd ..

      - name: Compile
        run: npm run compile

      - name: Package extension
        run: vsce package

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: '*.vsix'
          generate_release_notes: true
          body: |
            ## Installation

            Download the `.vsix` file below and install it in VSCode:

            ```bash
            code --install-extension aw-watcher-vscode-*.vsix
            ```

            Or use VSCode UI: Extensions panel → `...` → "Install from VSIX..."
```

### リリースの作成方法

```bash
# 1. バージョンを更新（package.json）
# "version": "0.5.1"

# 2. 変更をコミット
git add package.json
git commit -m "chore: bump version to 0.5.1"

# 3. タグを作成
git tag v0.5.1

# 4. プッシュ
git push origin master
git push origin v0.5.1

# GitHub Actionsが自動的に:
# - .vsixファイルをビルド
# - リリースを作成
# - .vsixファイルを添付
```

### 手動でリリースを作成

GitHub Actionsを使わない場合：

```bash
# 1. ローカルでビルド
npx vsce package

# 2. GitHubのReleasesページで新しいリリースを作成
# 3. .vsixファイルをアップロード
```

## README.mdの更新

ユーザー向けの説明を追加：

```markdown
## Installation

### Option 1: From GitHub Releases (Recommended)

1. Go to [Releases](https://github.com/YOUR_USERNAME/aw-watcher-vscode/releases)
2. Download the latest `.vsix` file
3. Install in VSCode:
   ```bash
   code --install-extension aw-watcher-vscode-*.vsix
   ```
   Or: Extensions panel → `...` → "Install from VSIX..."

### Option 2: Build from source

```bash
git clone https://github.com/YOUR_USERNAME/aw-watcher-vscode
cd aw-watcher-vscode
git submodule update --init --recursive
npm install
npm run compile
npx vsce package
code --install-extension aw-watcher-vscode-*.vsix
```

## What's different from the official version?

This fork includes improvements to activity tracking:

- ✅ Battery-aware polling (only on AC power)
- ✅ Window focus tracking
- ✅ Terminal tracking (from PR #44)
- ✅ Additional VSCode events
- ✅ Better detection of AI chat and reading activities

See [CHANGELOG.md](CHANGELOG.md) for details.
```

## バージョン管理

### セマンティックバージョニング

```
MAJOR.MINOR.PATCH

例: 0.5.1
  ↑  ↑  ↑
  │  │  └─ パッチ: バグ修正
  │  └──── マイナー: 新機能追加（互換性あり）
  └────── メジャー: 破壊的変更
```

### 本家との区別

フォーク版であることを明示：

```json
{
  "name": "aw-watcher-vscode",
  "displayName": "aw-watcher-vscode (Community Fork)",
  "version": "0.5.1",
  "description": "Editor watcher for ActivityWatch with improved tracking (Community Fork)"
}
```

または、リリースノートで明記：

```markdown
## Note

This is an unofficial community fork with improvements.
See upstream: https://github.com/ActivityWatch/aw-watcher-vscode
```

## アップデート方法

ユーザーが新しいバージョンに更新する場合：

```bash
# 1. 新しい.vsixをダウンロード
# 2. インストール（上書きされる）
code --install-extension aw-watcher-vscode-0.5.2.vsix
```

VSCodeは古いバージョンを自動的にアンインストールしてから新しいバージョンをインストールします。

## 本家へのマージを目指す場合

将来的に本家にマージされる可能性を考慮：

1. **変更履歴を明確に**
   - 各機能ごとにコミットを分ける
   - PRとして送りやすい形式を保つ

2. **ドキュメント整備**
   - 変更内容を詳細に記録
   - テスト結果を文書化

3. **互換性維持**
   - 既存の設定との互換性
   - 既存のデータフォーマットを変更しない

4. **定期的に本家をチェック**
   - 本家に活動が戻った場合、すぐにPRを送れるように準備

## セキュリティ

### .vsixファイルの検証

ユーザーが安全性を確認できるように：

```bash
# .vsixファイルはZIPファイル
unzip -l aw-watcher-vscode-0.5.0.vsix

# または
code --list-extensions --show-versions
```

### チェックサムの提供

リリース時にSHA256を記載：

```bash
# チェックサムを生成
shasum -a 256 aw-watcher-vscode-0.5.0.vsix

# リリースノートに記載
SHA256: abc123...
```

## まとめ

.vsixファイルでの配布は：
- ✅ 本家への配慮
- ✅ 簡単なインストール
- ✅ GitHub Releasesで自動化
- ✅ 将来的な統合の可能性

この方法で、コミュニティ主導の改善を進めながら、本家との統合の道も残せます。
