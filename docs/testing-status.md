# テストの現状と今後の方針

## 現状

### ❌ テストは実質的に存在しない

#### ファイル構成

```
src/test/
├── extension.test.ts  # 全てコメントアウト（104行）
└── index.ts          # テストランナー設定のみ
```

#### テストスクリプト

```json
{
  "scripts": {
    "test": "npm run compile && node ./node_modules/vscode/bin/test",
    "test:mocha": "npm run compile && node ./node_modules/mocha/bin/mocha ./out/test/extension.test.js"
  }
}
```

#### 実行結果

```bash
$ npm run test:mocha
Error: No test files found: "./out/test/extension.test.js"
```

**原因**: テストファイルが全てコメントアウトされているため、コンパイルされない

### 過去に存在したテスト（全てコメントアウト）

[src/test/extension.test.ts](../src/test/extension.test.ts)より：

```typescript
describe('AW-Client Bucket', function () {
    describe('bucket', () => {
        it('should create bucket without error')
        it('should retrieve bucket information')
        it('should delete bucket without error')
    })

    describe('events', () => {
        it('should send event without errors')
        it('should get previously created event')
    })

    describe('heartbeat', () => {
        it('should send heartbeat without errors')
    })
})
```

**これらのテストは**:
- aw-client-jsのAPI呼び出しのみをテスト
- 拡張機能本体のロジックはテストされていない
- ActivityWatchサーバーが必要（統合テスト）

## 問題点

### 1. カバレッジが無い

テストが無いため、以下の重要なロジックが検証されていません：

- ❌ `_onEvent`のハートビート送信ロジック
- ❌ イベント発火時の条件分岐
- ❌ レート制限（`maxHeartbeatsPerSec`）
- ❌ ファイルパス、ブランチ名の取得
- ❌ エラーハンドリング

### 2. リグレッションのリスク

改善を行う際に：
- 既存の動作が壊れても気づけない
- 意図しない副作用を検出できない
- 安全にリファクタリングできない

### 3. 統合テストの難しさ

過去のテストはActivityWatchサーバーへの接続が必要：
- CIで実行しにくい
- ローカル環境依存
- テストの実行が遅い

## 今後の方針

### フェーズ1: 単体テストの追加

#### 対象

コアロジックの単体テスト（サーバー接続不要）

#### テスト対象の例

**1. ハートビート作成のロジック**

```typescript
describe('_createHeartbeat', () => {
    it('should create heartbeat with correct structure', () => {
        const heartbeat = activityWatch._createHeartbeat();

        assert.ok(heartbeat.timestamp instanceof Date);
        assert.equal(heartbeat.duration, 0);
        assert.ok(heartbeat.data);
        assert.ok(heartbeat.data.language);
        assert.ok(heartbeat.data.project);
        assert.ok(heartbeat.data.file);
    });

    it('should include branch name when available', () => {
        // Git APIをモック
        const heartbeat = activityWatch._createHeartbeat();
        assert.ok(heartbeat.data.branch);
    });
});
```

**2. レート制限のロジック**

```typescript
describe('Rate limiting', () => {
    it('should respect maxHeartbeatsPerSec setting', () => {
        // 連続してイベントを発火
        // 指定された秒あたりの送信数を超えないことを確認
    });

    it('should send immediately when file changes', () => {
        // ファイル変更時は即座に送信されることを確認
    });
});
```

**3. ファイルパス取得**

```typescript
describe('_getFilePath', () => {
    it('should return active editor file path', () => {
        // activeTextEditorをモック
        const filePath = activityWatch._getFilePath();
        assert.equal(filePath, '/path/to/file.ts');
    });

    it('should return undefined when no active editor', () => {
        // activeTextEditor = undefined
        const filePath = activityWatch._getFilePath();
        assert.equal(filePath, undefined);
    });
});
```

**4. イベント発火条件**

```typescript
describe('_onEvent', () => {
    it('should send heartbeat when file changes', () => {
        // ファイル変更をシミュレート
        // ハートビートが送信されることを確認
    });

    it('should send heartbeat when time elapsed', () => {
        // 時間経過をシミュレート
        // ハートビートが送信されることを確認
    });

    it('should not send when bucket not created', () => {
        // bucketCreated = false
        // ハートビートが送信されないことを確認
    });
});
```

#### テストフレームワーク

**既存の構成を維持**:
- Mocha (テストランナー)
- `@types/node` (Node.js型定義)
- VSCode Extension Test API

**追加提案**:
```json
{
  "devDependencies": {
    "mocha": "^8.2.1",
    "@types/mocha": "^2.2.42",
    "sinon": "^15.0.0",           // モック・スタブ
    "@types/sinon": "^10.0.0"
  }
}
```

#### モックの戦略

VSCode APIをモックする：

```typescript
import * as sinon from 'sinon';
import * as vscode from 'vscode';

// 例: window.activeTextEditorをモック
const mockEditor = {
    document: {
        fileName: '/path/to/test.ts',
        languageId: 'typescript'
    }
};

sinon.stub(vscode.window, 'activeTextEditor').value(mockEditor);
```

### フェーズ2: 統合テストの整備

#### 対象

ActivityWatchサーバーとの統合テスト

#### 環境

**ローカル開発**:
- Docker ComposeでActivityWatchサーバーを起動
- テスト実行前にサーバーを準備

```yaml
# docker-compose.test.yml
version: '3'
services:
  aw-server:
    image: activitywatch/aw-server:latest
    ports:
      - "5600:5600"
```

**CI/CD**:
- GitHub ActionsでActivityWatchサーバーをサービスとして起動
- テスト実行後にクリーンアップ

```yaml
# .github/workflows/test.yml
jobs:
  test:
    services:
      aw-server:
        image: activitywatch/aw-server:latest
        ports:
          - 5600:5600
```

#### テスト対象

```typescript
describe('Integration with ActivityWatch Server', () => {
    before(async () => {
        // サーバーが起動するまで待機
        await waitForServer('http://localhost:5600');
    });

    it('should create bucket on server', async () => {
        await activityWatch.init();
        // サーバーにバケットが作成されたことを確認
    });

    it('should send heartbeat to server', async () => {
        // ハートビート送信
        // サーバーからイベントを取得して確認
    });

    after(async () => {
        // テストデータのクリーンアップ
    });
});
```

### フェーズ3: E2Eテスト（将来的に）

#### 対象

実際のVSCode環境での動作テスト

#### ツール

- [VSCode Extension Test Runner](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- 実際のVSCodeインスタンスを起動してテスト

#### テストシナリオ

```typescript
describe('E2E Tests', () => {
    it('should track activity when editing file', async () => {
        // 1. ファイルを開く
        await vscode.commands.executeCommand('vscode.open', uri);

        // 2. テキストを編集
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), 'test');
        });

        // 3. ハートビートが送信されたことを確認
        // （サーバーまたはモックで確認）
    });
});
```

## テストの実行方法

### 単体テスト

```bash
# 全てのテストを実行
npm test

# 特定のテストファイルのみ
npm run test:mocha -- out/test/extension.test.js

# watchモード
npm run test:watch
```

### 統合テスト（将来）

```bash
# ActivityWatchサーバーを起動
docker-compose -f docker-compose.test.yml up -d

# テスト実行
npm run test:integration

# クリーンアップ
docker-compose -f docker-compose.test.yml down
```

## CI/CDへの統合

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      aw-server:
        image: activitywatch/aw-server:latest
        ports:
          - 5600:5600
        options: >-
          --health-cmd "curl -f http://localhost:5600/api/0/info || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration
        env:
          AW_SERVER_URL: http://localhost:5600

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

## カバレッジ目標

### 短期目標（フェーズ1）

- **コアロジック**: 80%以上
  - `_createHeartbeat`
  - `_onEvent`
  - ファイルパス取得系のメソッド

### 中期目標（フェーズ2）

- **統合テスト**: 主要フローをカバー
  - バケット作成
  - ハートビート送信
  - エラーハンドリング

### 長期目標（フェーズ3）

- **E2Eテスト**: 実際のユースケースをカバー
  - コーディング中の追跡
  - ターミナル使用中の追跡
  - デバッグ中の追跡

## 改善提案時のテスト

新機能を追加する際のテストガイドライン：

### 例: バッテリー対応ポーリングの追加

```typescript
describe('Battery-aware polling', () => {
    describe('setupBatteryAwarePolling', () => {
        it('should enable polling when on AC power', async () => {
            // isCharging() が true を返すようにモック
            const isChargingStub = sinon.stub().resolves(true);

            await activityWatch.setupBatteryAwarePolling();

            assert.equal(activityWatch._pollingEnabled, true);
        });

        it('should disable polling when on battery', async () => {
            // isCharging() が false を返すようにモック
            const isChargingStub = sinon.stub().resolves(false);

            await activityWatch.setupBatteryAwarePolling();

            assert.equal(activityWatch._pollingEnabled, false);
        });

        it('should respect "always" mode setting', async () => {
            // 設定を "always" にモック
            const config = {
                get: sinon.stub().returns('always')
            };

            await activityWatch.setupBatteryAwarePolling();

            assert.equal(activityWatch._pollingEnabled, true);
        });
    });

    describe('checkBatteryStatus', () => {
        it('should start polling when AC power connected', async () => {
            activityWatch._isCharging = false;

            // isCharging() が true に変わったとシミュレート
            const isChargingStub = sinon.stub().resolves(true);

            await activityWatch.checkBatteryStatus(10000);

            assert.ok(activityWatch._pollingInterval);
        });

        it('should stop polling when switched to battery', async () => {
            activityWatch._isCharging = true;
            activityWatch.startPolling(10000);

            // isCharging() が false に変わったとシミュレート
            const isChargingStub = sinon.stub().resolves(false);

            await activityWatch.checkBatteryStatus(10000);

            assert.equal(activityWatch._pollingInterval, undefined);
        });
    });
});
```

### 例: ウィンドウフォーカスイベントの追加

```typescript
describe('onDidChangeWindowState', () => {
    it('should send heartbeat when window gains focus', () => {
        const windowState = { focused: true };

        activityWatch._onWindowStateChange(windowState);

        // ハートビートが送信されたことを確認
        assert.ok(sendHeartbeatStub.called);
    });

    it('should not send when window loses focus', () => {
        const windowState = { focused: false };

        activityWatch._onWindowStateChange(windowState);

        // ハートビートが送信されていないことを確認
        assert.ok(sendHeartbeatStub.notCalled);
    });

    it('should respect rate limiting', () => {
        const windowState = { focused: true };

        // 短時間に複数回フォーカス変更
        activityWatch._onWindowStateChange(windowState);
        activityWatch._onWindowStateChange(windowState);

        // レート制限により1回のみ送信
        assert.equal(sendHeartbeatStub.callCount, 1);
    });
});
```

## まとめ

### 現状

- ❌ テストが実質的に存在しない
- ❌ コードカバレッジ: 0%
- ❌ リグレッションのリスクが高い

### 改善計画

1. **フェーズ1**: 単体テストの追加（優先度: 高）
   - コアロジックのテスト
   - モックを使用してVSCode APIをテスト

2. **フェーズ2**: 統合テストの整備（優先度: 中）
   - ActivityWatchサーバーとの通信テスト
   - Docker Composeで環境構築

3. **フェーズ3**: E2Eテスト（優先度: 低）
   - 実際のVSCode環境でのテスト
   - 主要ユースケースのカバー

### 次のステップ

- [ ] 単体テストフレームワークの再構築
- [ ] コアロジックのテストを優先的に追加
- [ ] CI/CDパイプラインの構築
- [ ] カバレッジレポートの設定
- [ ] 新機能追加時はテストも同時に追加

テストを整備することで、**安全に改善を進められる**環境を構築します。
