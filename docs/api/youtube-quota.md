# YouTube API クォータ管理戦略

## 概要

YouTube Data API v3 の無料枠は **10,000クォータ/日**。
効率的なクォータ管理により、1日あたり最大100チャンネルの分析が可能。

---

## クォータコスト一覧

### 検索・リスト系

| API メソッド | コスト | 説明 |
|-------------|-------|------|
| search.list | 100 | チャンネル・動画の検索 |
| channels.list | 1 | チャンネル情報の取得 |
| videos.list | 1 | 動画情報の取得 |
| playlistItems.list | 1 | プレイリスト内の動画一覧 |
| commentThreads.list | 1 | コメント一覧の取得 |

### 書き込み系（当面使用しない）

| API メソッド | コスト | 説明 |
|-------------|-------|------|
| videos.insert | 1600 | 動画のアップロード |
| playlists.insert | 50 | プレイリスト作成 |
| subscriptions.insert | 50 | チャンネル登録 |

**備考:** 書き込み系APIは市場調査には不要のため使用しない。

---

## 主要ユースケースのクォータ消費

### 1. チャンネル検索・追加

```typescript
// キーワード検索 → チャンネル詳細取得 → トラッキング追加
POST /api/channels/search (query: "テクノロジー解説")
→ search.list: 100クォータ
→ 25件のチャンネルIDを取得

GET /api/channels/[channelId] × 5件
→ channels.list × 5: 5クォータ

POST /api/channels/[channelId]/track × 5件
→ すでに取得済みなのでクォータ消費なし（キャッシュ活用）

合計: 105クォータ
```

**最適化:**
- `search.list` のレスポンスに含まれる基本情報で済む場合は `channels.list` を省略
- 複数チャンネルの詳細情報は `channels.list` で一括取得（最大50件）

---

### 2. トラッキング中のチャンネル一括更新

```typescript
// 100チャンネルのデータを更新
POST /api/channels/bulk-update

// バッチ処理: 50件ずつに分割
channels.list (id: ch1,ch2,...,ch50): 1クォータ
channels.list (id: ch51,ch52,...,ch100): 1クォータ

合計: 2クォータ
```

**最適化:**
- 1リクエストで最大50件のチャンネルIDを指定
- 100チャンネル = 2クォータで更新可能

---

### 3. チャンネルの動画一覧取得

```typescript
// チャンネルの最新動画50件を取得
GET /api/channels/[channelId]/videos

// ステップ1: プレイリストID取得（uploads playlist）
channels.list (part: contentDetails): 1クォータ

// ステップ2: 動画IDリスト取得
playlistItems.list (maxResults: 50): 1クォータ

// ステップ3: 動画詳細情報取得
videos.list (id: vid1,vid2,...,vid50): 1クォータ

合計: 3クォータ
```

**最適化:**
- `channels.list` のレスポンスをキャッシュ（uploads playlist ID は変わらない）
- 初回のみ3クォータ、2回目以降は2クォータ

---

### 4. 動画の詳細分析

```typescript
// 50本の動画を分析
POST /api/videos/analyze (videoIds: [vid1, vid2, ..., vid50])

videos.list (id: vid1,vid2,...,vid50, part: snippet,statistics): 1クォータ

合計: 1クォータ
```

**最適化:**
- 最大50件まで1クォータで取得可能
- 51件以上の場合は複数リクエストに分割

---

## 日次クォータ配分戦略

### 基本方針

10,000クォータを以下のように配分:

| 用途 | 割り当て | 説明 |
|------|---------|------|
| 定期更新 | 2,000 (20%) | トラッキング中チャンネルの自動更新 |
| ユーザー検索 | 5,000 (50%) | チャンネル検索・動画分析 |
| 分析処理 | 1,000 (10%) | ジャンル分析・統計計算 |
| 予備 | 2,000 (20%) | 緊急時・ピーク時用 |

### 配分ルール

```typescript
// 時間帯別の割り当て
const QUOTA_ALLOCATION = {
  // 深夜バッチ（00:00-06:00）
  batch: {
    maxQuota: 2000,
    operations: ['bulk-update', 'genre-analysis'],
  },
  // 日中（06:00-24:00）
  interactive: {
    maxQuota: 6000,
    operations: ['search', 'channel-detail', 'video-analysis'],
  },
  // 予備枠
  reserve: {
    maxQuota: 2000,
    condition: 'emergency or peak usage',
  },
};
```

---

## クォータ監視・制御

### 1. リアルタイム監視

```typescript
// 毎回のAPI呼び出し後にログ記録
async function logQuotaUsage(operation: string, cost: number) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'quota_log!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        new Date().toISOString().split('T')[0], // date
        operation,
        cost,
        request.url,
        user.email,
        new Date().toISOString(), // timestamp
      ]],
    },
  });
}

// 現在の使用量を取得
async function getCurrentQuotaUsage(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'quota_log!A:C',
  });

  const todayLogs = response.data.values?.filter(row => row[0] === today) || [];
  return todayLogs.reduce((sum, row) => sum + parseInt(row[2]), 0);
}
```

### 2. 使用制限

```typescript
// クォータ残量チェック
async function checkQuotaAvailable(estimatedCost: number): Promise<boolean> {
  const used = await getCurrentQuotaUsage();
  const limit = 10000;
  const safeThreshold = limit * 0.8; // 80%まで

  return (used + estimatedCost) <= safeThreshold;
}

// APIリクエスト前のガード
async function guardedApiCall<T>(
  operation: string,
  cost: number,
  fn: () => Promise<T>
): Promise<T> {
  // クォータチェック
  const allowed = await checkQuotaAvailable(cost);
  if (!allowed) {
    throw new Error('QUOTA_EXCEEDED: Daily limit reached');
  }

  // API実行
  const result = await fn();

  // ログ記録
  await logQuotaUsage(operation, cost);

  return result;
}
```

### 3. アラート機能

```typescript
// クォータ使用率のチェック
async function checkQuotaAlerts() {
  const used = await getCurrentQuotaUsage();
  const limit = 10000;
  const percentage = (used / limit) * 100;

  if (percentage >= 80) {
    // Slack通知 / メール通知
    await sendAlert({
      level: 'warning',
      message: `YouTube API クォータ使用率: ${percentage.toFixed(1)}%`,
      details: { used, limit, remaining: limit - used },
    });
  }

  if (percentage >= 95) {
    // 緊急通知 + 自動制限モード
    await sendAlert({
      level: 'critical',
      message: 'YouTube API クォータが95%を超えました。自動制限モードを有効化します。',
    });
    await enableQuotaLimitMode();
  }
}

// 定期実行（15分ごと）
setInterval(checkQuotaAlerts, 15 * 60 * 1000);
```

---

## キャッシュ戦略

### 1. レスポンスキャッシュ

```typescript
// チャンネル情報のキャッシュ
const CACHE_TTL = {
  channels: 24 * 60 * 60, // 24時間
  videos: 12 * 60 * 60, // 12時間
  search: 6 * 60 * 60, // 6時間
};

async function getCachedChannel(channelId: string, forceRefresh = false) {
  // キャッシュチェック
  if (!forceRefresh) {
    const cached = await getCachedData('channels', channelId);
    if (cached && !isCacheExpired(cached.updated_at, CACHE_TTL.channels)) {
      return cached;
    }
  }

  // YouTube APIから取得（1クォータ）
  const channel = await guardedApiCall(
    'channels.list',
    1,
    () => youtube.channels.list({ part: 'snippet,statistics', id: channelId })
  );

  // キャッシュに保存
  await saveCachedData('channels', channelId, channel);

  return channel;
}
```

### 2. バッチ処理の最適化

```typescript
// 悪い例: 100チャンネルを1件ずつ取得 → 100クォータ
for (const channelId of channelIds) {
  await youtube.channels.list({ id: channelId }); // 1クォータ × 100
}

// 良い例: 50件ずつバッチ取得 → 2クォータ
const batches = chunk(channelIds, 50);
for (const batch of batches) {
  await youtube.channels.list({ id: batch.join(',') }); // 1クォータ × 2
}
```

### 3. 段階的なデータ取得

```typescript
// search.list のレスポンスには基本情報が含まれる
// 詳細情報が不要な場合は channels.list を省略

// ステップ1: 検索（100クォータ）
const searchResult = await youtube.search.list({
  q: 'テクノロジー',
  type: 'channel',
  part: 'snippet', // snippet には title, description, thumbnails が含まれる
  maxResults: 25,
});

// ステップ2: 統計情報が必要な場合のみ channels.list（1クォータ）
const channelIds = searchResult.items.map(item => item.id.channelId);
const detailsResult = await youtube.channels.list({
  id: channelIds.join(','),
  part: 'statistics', // 統計情報のみ取得
});

// 合計: 101クォータ（search.list の基本情報を活用）
```

---

## リトライ・フォールバック戦略

### 1. 指数バックオフリトライ

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // クォータエラーはリトライしない
      if (error.code === 429 || error.message.includes('quota')) {
        throw error;
      }

      // 最後の試行で失敗したら例外をスロー
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 指数バックオフで待機
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}
```

### 2. クォータ超過時のフォールバック

```typescript
// クォータ超過時はキャッシュデータを返す
async function getChannelWithFallback(channelId: string) {
  try {
    return await getCachedChannel(channelId, false);
  } catch (error) {
    if (error.message.includes('QUOTA_EXCEEDED')) {
      // キャッシュが期限切れでも返す
      const staleCache = await getCachedData('channels', channelId);
      if (staleCache) {
        return {
          ...staleCache,
          _warning: 'Using stale cache due to quota limit',
        };
      }
    }
    throw error;
  }
}
```

### 3. 優先度ベースのリクエスト制御

```typescript
// リクエストに優先度を付与
enum RequestPriority {
  HIGH = 1, // ユーザー操作
  MEDIUM = 2, // バックグラウンド更新
  LOW = 3, // 分析・統計
}

// キューで管理
class QuotaAwareQueue {
  private queue: Array<{ priority: RequestPriority; fn: () => Promise<any> }> = [];

  async enqueue(priority: RequestPriority, fn: () => Promise<any>) {
    this.queue.push({ priority, fn });
    this.queue.sort((a, b) => a.priority - b.priority); // 優先度順にソート
  }

  async processNext() {
    const quotaAvailable = await checkQuotaAvailable(100); // 最大コストを仮定
    if (!quotaAvailable) {
      throw new Error('QUOTA_EXCEEDED');
    }

    const item = this.queue.shift();
    if (item) {
      return await item.fn();
    }
  }
}
```

---

## スクレイピング併用戦略（緊急時）

### 使用条件
- YouTube API のクォータが95%を超えた場合
- 公開情報のみ取得（チャンネル名、登録者数など）
- YouTube の利用規約に違反しない範囲

### 実装方針
```typescript
// Puppeteer / Playwright でチャンネルページをスクレイピング
async function scrapeChannelBasicInfo(channelId: string) {
  const url = `https://www.youtube.com/channel/${channelId}`;

  // ヘッドレスブラウザで取得
  const page = await browser.newPage();
  await page.goto(url);

  const channelInfo = await page.evaluate(() => {
    // DOM から情報を抽出
    const title = document.querySelector('ytd-channel-name')?.textContent;
    const subscriberText = document.querySelector('#subscriber-count')?.textContent;

    return { title, subscriberText };
  });

  await page.close();

  return channelInfo;
}
```

**注意事項:**
- スクレイピングは最終手段（通常はAPIを使用）
- レート制限を自主的に設ける（1リクエスト/秒）
- User-Agent を適切に設定
- robots.txt を尊重

---

## クォータ最適化チェックリスト

### 実装前
- [ ] 同じデータを複数回取得していないか確認
- [ ] バッチ処理可能なリクエストを個別に実行していないか確認
- [ ] キャッシュ可能なデータをキャッシュしているか確認
- [ ] 不要な `part` パラメータを指定していないか確認

### 実装後
- [ ] クォータ消費をログに記録
- [ ] 日次・週次でクォータ使用量をレビュー
- [ ] 使用率が80%を超えたらアラート
- [ ] 定期的にキャッシュヒット率を測定

### 運用時
- [ ] ユーザー数増加に応じてクォータ配分を調整
- [ ] ピーク時間帯を分析し、バッチ処理時刻を最適化
- [ ] 有料枠への移行を検討（1日10,000クォータで不足する場合）

---

## クォータ増加オプション

### 無料枠の拡張申請
- Google Cloud Console から申請可能
- 審査が必要（通常1-2週間）
- 承認されれば1日あたり100万クォータまで増加可能

### 有料プラン
YouTube Data API は基本無料だが、Google Cloud の課金を有効にすることで以下が可能:
- クォータ超過後も従量課金で継続使用
- 料金: 100クォータあたり $0.00（実質無料だが課金設定が必要）

**参考:** YouTube API のクォータ超過は Google Cloud の課金とは別のため、実質的に無料枠の拡張申請が現実的。

---

## シミュレーション: 1日の使用例

### ケース1: 軽量ユーザー（20チャンネル監視）

```
00:00 - 自動更新バッチ
  - channels.list (20チャンネル): 1クォータ
  - channel_history 記録: 0クォータ（Sheets API）
  合計: 1クォータ

10:00 - ユーザー操作（新規チャンネル検索）
  - search.list: 100クォータ
  - channels.list (3チャンネル): 1クォータ
  合計: 101クォータ

15:00 - 動画分析
  - playlistItems.list: 1クォータ
  - videos.list (50動画): 1クォータ
  合計: 2クォータ

20:00 - ジャンル分析
  - キャッシュ活用: 0クォータ

日次合計: 104クォータ（1.04%）
```

### ケース2: ヘビーユーザー（200チャンネル監視）

```
00:00 - 自動更新バッチ
  - channels.list (200チャンネル, 50件ずつ): 4クォータ
  - channel_history 記録: 0クォータ
  合計: 4クォータ

09:00-18:00 - 複数回の検索・分析
  - search.list × 5回: 500クォータ
  - channels.list × 10回: 10クォータ
  - videos.list × 20回: 20クォータ
  合計: 530クォータ

日次合計: 534クォータ（5.34%）
```

### ケース3: 上限ギリギリ（複数ユーザー・大規模分析）

```
00:00 - 大規模バッチ更新
  - 1,000チャンネル更新: 20クォータ
  合計: 20クォータ

06:00-24:00 - 積極的な検索・分析
  - search.list × 60回: 6,000クォータ
  - channels.list × 100回: 100クォータ
  - videos.list × 200回: 200クォータ
  合計: 6,300クォータ

日次合計: 6,320クォータ（63.2%）
```

**結論:** 適切なキャッシュ戦略により、200チャンネルの監視 + 活発な分析でも10,000クォータの半分程度で運用可能。

---

## まとめ

### 重要ポイント
1. **バッチ処理**: 最大50件を1リクエストで取得
2. **キャッシュ活用**: 24時間以内は再取得しない
3. **優先度制御**: ユーザー操作を優先、バッチは深夜実行
4. **監視**: 80%超過でアラート、95%超過で制限モード
5. **フォールバック**: クォータ超過時は古いキャッシュを返す

### クォータ削減効果
- バッチ処理: 50倍の効率化（50クォータ → 1クォータ）
- キャッシュ: 80%削減（5回リクエスト → 1回リクエスト）
- 段階的取得: 50%削減（search + channels → search のみ）

### 運用目標
- 通常時: 5,000クォータ/日以下（50%以下）
- ピーク時: 8,000クォータ/日以下（80%以下）
- 予備枠: 2,000クォータ（緊急時・障害復旧用）
