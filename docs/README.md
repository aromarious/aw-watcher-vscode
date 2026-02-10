# aw-watcher-vscode 調査・改善ドキュメント

## 概要

このドキュメントは、aw-watcher-vscode（ActivityWatchのVSCode拡張機能）の現在の実装を調査し、改善案をまとめたものです。

## 調査日

2026年2月10日

## 調査結果サマリー

### 主な発見

1. **記録漏れが深刻**: 実測で約50%の作業時間が記録されていない
2. **イベント駆動のみの限界**: 他のwatcherはポーリングを使用しているのに、VSCode watcherだけが使っていない
3. **リポジトリが放置**: 3年以上メンテナンスされていない
4. **コミュニティの需要は高い**: Issueは活発に報告されているが、対応されていない

### 記録されない活動の例

- ❌ AIとチャット（Claude Code、GitHub Copilot Chat）
- ❌ スクロールしてコードを読んでいる
- ❌ ファイルを開いたまま読んでいる
- ❌ ターミナルで作業（PR #44で改善予定）
- ❌ デバッグパネルを見ている

## ドキュメント構成

### 1. [現在の実装の分析](./current-implementation-analysis.md)

- `_onEvent`関数の役割
- 記録される活動 vs 記録されない活動
- 実測データ（window watcherとの50%の差異）
- 技術的な原因

### 2. [他のWatcherとの比較](./other-watchers-comparison.md)

- aw-watcher-window（10秒ポーリング）
- aw-watcher-input（5秒ポーリング）
- なぜVSCode watcherだけポーリングが無いのか
- 他のwatcherの実装方式

### 3. [利用可能なVSCode APIイベント](./available-vscode-events.md)

- 現在使用中のイベント（2つのみ）
- 追加可能なイベント一覧
- 優先順位と実装フェーズ
- イベント駆動の限界

### 4. [バッテリー状態を考慮したポーリング](./battery-aware-polling.md)

- バッテリー検出の実装方法
- AC電源時のみポーリング
- 設定オプション
- 実装例とフロー図

### 5. [リポジトリのメンテナンス状況](./repository-status.md)

- 最終コミット: 2023年5月（2年8ヶ月前）
- 放置されているPR: 10個以上
- ActivityWatch組織は活発だが、VSCode watcherのみ放置
- 今後の選択肢

### 6. [配布方法ガイド](./distribution-guide.md)

- .vsixファイルでの配布方法
- GitHub Releasesでの自動化
- ユーザーのインストール方法
- 本家へのマージを目指す場合の注意点

### 7. [テストの現状と今後の方針](./testing-status.md)

- 現状: テストは実質的に存在しない
- 問題点とリスク
- 改善計画（単体テスト → 統合テスト → E2E）
- 新機能追加時のテストガイドライン

## 改善提案

### フェーズ1: イベントの追加（短期）

**実装の複雑さ: 低**

1. `window.onDidChangeWindowState` - ウィンドウフォーカス
2. `workspace.onDidChangeTextDocument` - テキスト変更
3. `workspace.onDidSaveTextDocument` - ファイル保存
4. PR #44のターミナルイベントをマージ

**期待される効果**:
- 記録率: 50% → 70-80%に改善
- AIチャット中の検知（フォーカス変更時のみ）

### フェーズ2: バッテリー対応ポーリング（中期）

**実装の複雑さ: 中**

1. `is-charging`パッケージを追加
2. AC電源時のみポーリング（10秒間隔）
3. 設定オプション追加
   - `polling.mode`: "always" / "never" / "onACPower"
   - `polling.interval`: 10秒（デフォルト）

**期待される効果**:
- 記録率: 70-80% → 95%以上に改善
- バッテリー駆動時は効率を維持
- AIチャット中も継続的に記録

### フェーズ3: 追加機能（長期）

**実装の複雑さ: 中〜高**

1. デバッグイベントの追加
2. より詳細なメタデータ
3. Webview検出（可能であれば）
4. パフォーマンス最適化

## 技術スタック

### 既存

- TypeScript
- VSCode Extension API
- aw-client-js
- axios

### 追加提案

- is-charging（バッテリー検出）
- node-power-info（バッテリー情報）

## 実装の優先順位

### 最優先（すぐに実装すべき）

1. ✅ `onDidChangeWindowState`の追加
2. ✅ `onDidChangeTextDocument`の追加
3. ✅ PR #44のターミナルイベントをマージ

**理由**: 実装が簡単で、大きな改善が期待できる

### 高優先（早期に実装）

4. ✅ バッテリー対応ポーリング
5. ✅ 設定オプションの追加

**理由**: ポーリングで記録漏れを大幅に削減

### 中優先（必要に応じて）

6. ファイル保存イベント
7. デバッグイベント
8. その他のエディタイベント

## テスト計画

### 単体テスト

- イベントハンドラーのテスト
- ハートビート作成のテスト
- バッテリー検出のテスト

### 統合テスト

- 実際にVSCodeで使用して記録を確認
- window watcherとの記録時間を比較
- バッテリー切り替え時の動作確認

### シナリオテスト

| シナリオ | 現在 | フェーズ1 | フェーズ2 |
|---------|------|----------|----------|
| コードを書く | ✅ | ✅ | ✅ |
| カーソル移動 | ✅ | ✅ | ✅ |
| AIチャット（フォーカス切替） | ❌ | ✅ | ✅ |
| AIチャット（継続的） | ❌ | ❌ | ✅ |
| スクロールして読む | ❌ | ❌ | ✅ |
| ターミナル操作 | ❌ | ✅ | ✅ |
| デバッグパネル | ❌ | ✅ | ✅ |

## 配布戦略

### 短期: .vsixファイルで配布

1. GitHub Releasesで.vsixを配布
2. READMEにインストール方法を記載
3. コミュニティに周知

**利点**:
- 本家への配慮
- すぐに配布可能

### 中期: 本家への貢献

1. ActivityWatch組織に連絡
2. メンテナンス状況を確認
3. 可能であればPRを送る

### 長期: コミュニティフォーク

1. 継続的なメンテナンス体制
2. ユーザーからのフィードバック収集
3. 本家が活動再開した場合は統合

## メンテナーへのメッセージ（将来的にPRを送る場合）

### 問題の説明

現在の実装では、実際の作業時間の約50%しか記録されていません（Issue #10）。特に以下の活動が記録されません：

- AIツール（Claude Code、GitHub Copilot Chat）との会話
- コードを読んでいる時間
- ターミナルでの作業
- デバッグパネルの使用

### 提案する解決策

1. **追加のイベントハンドラー**: より多くのVSCode APIイベントを監視
2. **バッテリー対応ポーリング**: AC電源時のみ軽量なポーリング（10秒間隔）
3. **設定可能**: ユーザーがポーリングのオン/オフを選択可能

この方式は、他のActivityWatch watcher（aw-watcher-window、aw-watcher-input）と同様のハイブリッドアプローチです。

### 既存コードとの互換性

- ✅ 既存のイベントハンドラーはそのまま
- ✅ 既存の設定との互換性維持
- ✅ データフォーマットは変更なし
- ✅ バッテリー検出の失敗時はフォールバック

### テスト結果

（実装後に記載予定）

## 参考リンク

### 関連Issue・PR

- [Issue #10 - Inconsistency in tracked times](https://github.com/ActivityWatch/aw-watcher-vscode/issues/10)
- [Issue #43 - track terminal and other tabs](https://github.com/ActivityWatch/aw-watcher-vscode/issues/43)
- [PR #44 - Terminal tracking support](https://github.com/ActivityWatch/aw-watcher-vscode/pull/44)
- [PR #95 - aw-watcher-window hybrid polling](https://github.com/ActivityWatch/aw-watcher-window/pull/95)

### 参考実装

- [vscode-battery-indicator](https://github.com/fbosch/vscode-battery-indicator) - バッテリー検出の実装例
- [aw-watcher-window](https://github.com/ActivityWatch/aw-watcher-window) - ポーリング方式の実装例

### ドキュメント

- [VSCode Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [ActivityWatch Documentation](https://docs.activitywatch.net/)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## ライセンス

このドキュメントは、元のaw-watcher-vscodeと同じライセンス（MPL-2.0）に従います。

## 貢献者

調査・ドキュメント作成: 2026年2月10日

## 次のステップ

1. [ ] フェーズ1の実装（イベント追加）
2. [ ] PR #44のマージ
3. [ ] フェーズ2の実装（バッテリー対応ポーリング）
4. [ ] テストとユーザーフィードバック
5. [ ] .vsixファイルでのリリース
6. [ ] ActivityWatch組織への連絡

---

**質問や提案がある場合は、Issueを開いてください。**
