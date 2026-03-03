# Google Sheets スキーマ設計

## 概要

各ユーザーの Google Drive に専用スプレッドシートを自動作成。
スプレッドシート名: `YouTube市場調査データ - {ユーザー名}`

---

## シート構成

```
📊 YouTube市場調査データ - {ユーザー名}
├── 📋 channels         # チャンネル基本情報
├── 📋 channel_history  # チャンネルの日次推移データ
├── 📋 videos           # 動画詳細情報
├── 📋 genres           # ジャンル定義・集計
├── 📋 analysis_cache   # 分析結果のキャッシュ
├── 📋 quota_log        # YouTube API クォータ使用ログ
└── 📋 settings         # ユーザー設定
```

---

## シート詳細

### 1. channels

チャンネルの基本情報とトラッキング状態を保存。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | youtube_id | string | YouTube チャンネル ID | ○ | PRIMARY |
| B | title | string | チャンネル名 | ○ | - |
| C | description | string | チャンネル説明 | - | - |
| D | custom_url | string | カスタム URL (@username) | - | - |
| E | thumbnail_url | string | サムネイル画像 URL | ○ | - |
| F | banner_url | string | バナー画像 URL | - | - |
| G | subscriber_count | number | 登録者数 | ○ | SORT |
| H | video_count | number | 動画数 | ○ | - |
| I | view_count | number | 総再生数 | ○ | SORT |
| J | published_at | datetime | チャンネル開設日 | ○ | - |
| K | country | string | 国コード (JP, US, etc.) | - | - |
| L | genre | string | ジャンル（ユーザー設定） | - | FILTER |
| M | added_at | datetime | トラッキング追加日時 | ○ | SORT |
| N | updated_at | datetime | 最終更新日時 | ○ | SORT |

**データ例:**
```
UCxyz123... | テック解説チャンネル | 最新のテクノロジーを... | @tech-channel | https://... | https://... | 150000 | 320 | 5000000 | 2020-05-15T10:00:00Z | JP | テクノロジー | 2026-01-10T14:30:00Z | 2026-03-01T09:15:00Z
```

**検証ルール:**
- `youtube_id`: 24文字の英数字（UC で始まる）
- `subscriber_count`, `video_count`, `view_count`: 0 以上の整数
- `published_at`, `added_at`, `updated_at`: ISO 8601 形式

**クエリパターン:**
```sql
-- ジャンル別取得
SELECT * WHERE L = 'テクノロジー' ORDER BY G DESC

-- 最近追加されたチャンネル
SELECT * ORDER BY M DESC LIMIT 10

-- 成長率計算用（後述の channel_history と結合）
SELECT A, B, G FROM channels WHERE M >= '2026-03-01'
```

---

### 2. channel_history

チャンネルの日次スナップショットを保存（時系列分析用）。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | youtube_id | string | YouTube チャンネル ID | ○ | COMPOSITE |
| B | date | date | 記録日（YYYY-MM-DD） | ○ | COMPOSITE |
| C | subscriber_count | number | 登録者数 | ○ | - |
| D | view_count | number | 総再生数 | ○ | - |
| E | video_count | number | 動画数 | ○ | - |
| F | fetched_at | datetime | 取得日時 | ○ | - |

**複合キー:** (`youtube_id`, `date`)

**データ例:**
```
UCxyz123... | 2026-03-01 | 150000 | 5000000 | 320 | 2026-03-01T09:15:00Z
UCxyz123... | 2026-03-02 | 150250 | 5025000 | 321 | 2026-03-02T09:20:00Z
UCxyz123... | 2026-03-03 | 150500 | 5050000 | 322 | 2026-03-03T09:18:00Z
```

**検証ルール:**
- 1チャンネルにつき1日1レコードまで
- `date` は過去のみ（未来日不可）
- 同一チャンネル・日付の重複はスキップ

**成長率計算クエリ:**
```sql
-- 30日間の登録者数成長率
WITH latest AS (
  SELECT youtube_id, subscriber_count AS current
  FROM channel_history
  WHERE date = '2026-03-03'
),
past AS (
  SELECT youtube_id, subscriber_count AS previous
  FROM channel_history
  WHERE date = '2026-02-01'
)
SELECT
  latest.youtube_id,
  ((current - previous) / previous * 100) AS growth_rate_30d
FROM latest JOIN past ON latest.youtube_id = past.youtube_id
```

**データ保持期間:**
- 全期間保持（削除しない）
- 将来的にアーカイブ機能を検討（1年以上前のデータを別シートに移動）

---

### 3. videos

動画の詳細情報を保存（分析・キャッシュ用）。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | youtube_id | string | YouTube 動画 ID | ○ | PRIMARY |
| B | channel_id | string | チャンネル ID | ○ | FILTER |
| C | title | string | 動画タイトル | ○ | - |
| D | description | string | 動画説明 | - | - |
| E | view_count | number | 再生数 | ○ | SORT |
| F | like_count | number | いいね数 | - | - |
| G | comment_count | number | コメント数 | - | - |
| H | published_at | datetime | 公開日時 | ○ | SORT |
| I | duration | string | 動画時間 (ISO 8601) | ○ | - |
| J | thumbnail_url | string | サムネイル URL | ○ | - |
| K | tags | string | タグ（カンマ区切り） | - | - |
| L | category_id | string | YouTube カテゴリ ID | - | - |
| M | fetched_at | datetime | 取得日時 | ○ | - |

**データ例:**
```
abc123xyz | UCxyz123... | 最新AI技術を解説！ | この動画では... | 125000 | 3500 | 450 | 2026-02-28T15:00:00Z | PT10M30S | https://... | AI,機械学習,解説 | 28 | 2026-03-01T10:00:00Z
```

**検証ルール:**
- `youtube_id`: 11文字の英数字・記号
- `duration`: ISO 8601 Duration 形式（例: PT1H2M3S）
- `view_count`, `like_count`, `comment_count`: 0 以上の整数

**分析クエリ例:**
```sql
-- チャンネル内の人気動画トップ10
SELECT A, C, E FROM videos
WHERE B = 'UCxyz123...'
ORDER BY E DESC
LIMIT 10

-- 平均エンゲージメント率
SELECT
  B AS channel_id,
  AVG((F + G) / E * 100) AS avg_engagement_rate
FROM videos
WHERE E > 0
GROUP BY B

-- タイトルに特定キーワードを含む動画
SELECT A, C, E FROM videos
WHERE C LIKE '%AI%'
ORDER BY E DESC
```

**キャッシュ戦略:**
- TTL: 12時間
- `fetched_at` から12時間経過後は再取得
- ユーザーが明示的に削除するまで保持

---

### 4. genres

ジャンル定義と集計結果のキャッシュ。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | name | string | ジャンル名 | ○ | PRIMARY |
| B | channel_count | number | このジャンルのチャンネル数 | ○ | - |
| C | total_subscribers | number | 合計登録者数 | ○ | - |
| D | total_views | number | 合計再生数 | ○ | - |
| E | avg_subscribers | number | 平均登録者数 | ○ | - |
| F | avg_views | number | 平均再生数 | ○ | - |
| G | avg_upload_frequency | number | 平均投稿頻度（週） | - | - |
| H | market_growth_rate | number | 市場成長率（%） | - | - |
| I | entry_difficulty_score | number | 参入難易度スコア (0-100) | - | - |
| J | last_calculated_at | datetime | 最終計算日時 | ○ | - |

**データ例:**
```
テクノロジー | 45 | 6750000 | 202500000 | 150000 | 4500000 | 2.5 | 15.3 | 42.5 | 2026-03-03T08:00:00Z
料理 | 68 | 10200000 | 456000000 | 150000 | 6705882 | 3.2 | 8.7 | 58.2 | 2026-03-03T08:00:00Z
```

**自動更新タイミング:**
- channels シートの更新時
- ユーザーがジャンル分析ページを表示した時（TTL: 1時間）

**計算ロジック:**
```typescript
// channels シートから集計
channel_count = COUNT(channels WHERE genre = name)
total_subscribers = SUM(subscriber_count WHERE genre = name)
total_views = SUM(view_count WHERE genre = name)
avg_subscribers = total_subscribers / channel_count
avg_views = total_views / channel_count

// channel_history から成長率を計算
market_growth_rate = (今月の総再生数 - 先月の総再生数) / 先月の総再生数 * 100

// 参入難易度スコア（詳細は後述）
entry_difficulty_score = calculate_entry_difficulty(name)
```

---

### 5. analysis_cache

重い分析結果をキャッシュ（API レスポンス高速化）。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | cache_key | string | キャッシュキー（ユニーク） | ○ | PRIMARY |
| B | cache_type | string | キャッシュの種類 | ○ | FILTER |
| C | result_json | string | JSON形式の分析結果 | ○ | - |
| D | created_at | datetime | 作成日時 | ○ | - |
| E | expires_at | datetime | 有効期限 | ○ | - |

**キャッシュキーの形式:**
```
{cache_type}:{identifier}:{params_hash}

例:
channel_analysis:UCxyz123:a7f3d2
genre_analysis:テクノロジー:b2c4e1
video_recommendations:UCxyz123:sort=views&limit=10:9e3f1a
```

**cache_type の種類:**
- `channel_analysis`: チャンネル分析結果
- `genre_analysis`: ジャンル分析結果
- `video_recommendations`: 動画推薦
- `market_overview`: 市場全体の概要

**データ例:**
```
channel_analysis:UCxyz123:a7f3d2 | channel_analysis | {"avgViewsPerVideo":15625,"growth30d":12.5,...} | 2026-03-03T10:00:00Z | 2026-03-03T11:00:00Z
```

**キャッシュ戦略:**
- TTL: cache_type によって異なる（1時間〜24時間）
- `expires_at` を過ぎたレコードは自動削除（定期バッチ）
- 元データ更新時に関連キャッシュを削除

**自動削除条件:**
```typescript
// channels 更新時 → そのチャンネルの analysis を削除
DELETE FROM analysis_cache
WHERE cache_key LIKE 'channel_analysis:{channel_id}%'

// genres 更新時 → そのジャンルの analysis を削除
DELETE FROM analysis_cache
WHERE cache_key LIKE 'genre_analysis:{genre_name}%'
```

---

### 6. quota_log

YouTube API クォータの使用ログ（日次リセット監視）。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | date | date | 日付（YYYY-MM-DD） | ○ | PRIMARY |
| B | operation | string | 操作名 | ○ | - |
| C | cost | number | 消費クォータ | ○ | - |
| D | endpoint | string | API エンドポイント | - | - |
| E | user_email | string | ユーザーメールアドレス | ○ | - |
| F | timestamp | datetime | 実行日時 | ○ | - |

**データ例:**
```
2026-03-03 | search.list | 100 | /api/channels/search | user@example.com | 2026-03-03T10:15:23Z
2026-03-03 | channels.list | 1 | /api/channels/UCxyz123 | user@example.com | 2026-03-03T10:16:05Z
2026-03-03 | videos.list | 1 | /api/videos/analyze | user@example.com | 2026-03-03T10:17:42Z
```

**日次集計クエリ:**
```sql
-- 当日の総消費クォータ
SELECT SUM(cost) AS total_used
FROM quota_log
WHERE date = '2026-03-03'

-- 操作別の消費内訳
SELECT operation, SUM(cost) AS total, COUNT(*) AS count
FROM quota_log
WHERE date = '2026-03-03'
GROUP BY operation
ORDER BY total DESC
```

**アラート条件:**
```typescript
// 日次上限の80%に達したら警告
if (total_used >= 8000) {
  // Slack通知 or メール通知
  alert('YouTube API クォータが80%を超えました');
}

// 上限に達したらAPI呼び出しを制限
if (total_used >= 10000) {
  throw new Error('QUOTA_EXCEEDED');
}
```

**データ保持期間:**
- 過去30日分を保持
- 31日以前のレコードは定期削除（日次バッチ）

---

### 7. settings

ユーザー設定・アプリケーション設定。

| 列 | 列名 | 型 | 説明 | 必須 | インデックス |
|----|------|----|----|------|------------|
| A | key | string | 設定キー | ○ | PRIMARY |
| B | value | string | 設定値（JSON文字列） | ○ | - |
| C | description | string | 説明 | - | - |
| D | updated_at | datetime | 最終更新日時 | ○ | - |

**設定項目例:**
```
spreadsheet_id | "1abc...xyz" | このアプリ専用のスプレッドシートID | 2026-03-01T10:00:00Z
auto_update_enabled | "true" | 自動更新の有効/無効 | 2026-03-01T10:00:00Z
update_interval_hours | "24" | 自動更新間隔（時間） | 2026-03-01T10:00:00Z
default_genre | "テクノロジー" | デフォルトジャンル | 2026-03-02T14:30:00Z
quota_alert_threshold | "8000" | クォータアラート閾値 | 2026-03-01T10:00:00Z
preferred_language | "ja" | 表示言語 | 2026-03-01T10:00:00Z
```

**型安全なアクセス:**
```typescript
// 設定取得ヘルパー
async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const row = await sheets.values.get({
    spreadsheetId,
    range: `settings!A:B`,
  });
  const setting = row.data.values?.find(r => r[0] === key);
  if (!setting) return defaultValue;
  return JSON.parse(setting[1]) as T;
}

// 使用例
const autoUpdateEnabled = await getSetting('auto_update_enabled', true);
const updateInterval = await getSetting('update_interval_hours', 24);
```

---

## 初期化処理

### スプレッドシート作成フロー

```typescript
1. Google Drive API で既存のスプレッドシートを検索
   - 検索クエリ: `name contains 'YouTube市場調査データ' and mimeType = 'application/vnd.google-apps.spreadsheet'`

2. 存在しない場合、新規作成
   - タイトル: `YouTube市場調査データ - {user.name}`
   - シート: 上記7つを自動作成

3. 各シートにヘッダー行を設定
   - フォーマット: 太字、背景色 #4285F4、文字色 #FFFFFF

4. データ検証ルールを設定
   - genre 列: ドロップダウンリスト
   - 日付列: 日付形式の強制

5. settings シートに初期値を書き込み
   - spreadsheet_id: 作成したスプレッドシートのID
   - その他デフォルト設定

6. スプレッドシートIDをユーザーセッションに保存
```

### ヘッダー行の定義

```typescript
const SHEET_HEADERS = {
  channels: [
    'youtube_id',
    'title',
    'description',
    'custom_url',
    'thumbnail_url',
    'banner_url',
    'subscriber_count',
    'video_count',
    'view_count',
    'published_at',
    'country',
    'genre',
    'added_at',
    'updated_at',
  ],
  channel_history: [
    'youtube_id',
    'date',
    'subscriber_count',
    'view_count',
    'video_count',
    'fetched_at',
  ],
  videos: [
    'youtube_id',
    'channel_id',
    'title',
    'description',
    'view_count',
    'like_count',
    'comment_count',
    'published_at',
    'duration',
    'thumbnail_url',
    'tags',
    'category_id',
    'fetched_at',
  ],
  genres: [
    'name',
    'channel_count',
    'total_subscribers',
    'total_views',
    'avg_subscribers',
    'avg_views',
    'avg_upload_frequency',
    'market_growth_rate',
    'entry_difficulty_score',
    'last_calculated_at',
  ],
  analysis_cache: [
    'cache_key',
    'cache_type',
    'result_json',
    'created_at',
    'expires_at',
  ],
  quota_log: [
    'date',
    'operation',
    'cost',
    'endpoint',
    'user_email',
    'timestamp',
  ],
  settings: [
    'key',
    'value',
    'description',
    'updated_at',
  ],
};
```

---

## データアクセスパターン

### 読み込み最適化

```typescript
// 1. 範囲指定で必要な列のみ取得
const response = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: 'channels!A:C', // youtube_id, title, description のみ
});

// 2. バッチ取得で複数範囲を一度に取得
const response = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: [
    'channels!A:N',
    'genres!A:J',
  ],
});

// 3. フィルタリングはアプリケーション層で実行
const channels = response.data.values.filter(row => row[11] === 'テクノロジー');
```

### 書き込み最適化

```typescript
// 1. batchUpdate で複数行を一括追加
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: 'RAW',
    data: [
      {
        range: 'channels!A2:N2',
        values: [channelData1],
      },
      {
        range: 'channel_history!A2:F2',
        values: [historyData1],
      },
    ],
  },
});

// 2. append で末尾に追加（重複チェック不要な場合）
await sheets.spreadsheets.values.append({
  spreadsheetId,
  range: 'quota_log!A:F',
  valueInputOption: 'RAW',
  requestBody: {
    values: [quotaLogData],
  },
});
```

---

## インデックス戦略

Google Sheets にはデータベースのような物理インデックスはないが、以下の戦略でパフォーマンスを改善:

### 1. ソート順の維持
- `channels` シート: `added_at` 降順（最新が上）
- `channel_history` シート: `youtube_id` 昇順、`date` 降順
- `quota_log` シート: `date` 降順、`timestamp` 降順

### 2. データ量の制限
- `videos` シート: チャンネルあたり最大100件まで（古い動画は削除）
- `analysis_cache` シート: 有効期限切れは即時削除
- `quota_log` シート: 過去30日分のみ保持

### 3. メモリキャッシュ
- アプリケーション側で頻繁にアクセスするデータをメモリに保持
- `channels` 全データ: 起動時にロード、30分ごとに再読み込み
- `genres` 集計: 1時間キャッシュ

---

## データ整合性

### トランザクション代替手段

Google Sheets API にはトランザクションがないため、以下の戦略で整合性を保証:

### 1. 楽観的ロック
```typescript
// 更新前に updated_at をチェック
const currentData = await getChannel(channelId);
if (currentData.updated_at !== expectedUpdatedAt) {
  throw new Error('CONFLICT: Data was modified by another request');
}

// 更新
await updateChannel(channelId, newData);
```

### 2. べき等性の保証
```typescript
// 重複チェック後に追加
const exists = await checkChannelExists(channelId);
if (exists) {
  return { success: false, reason: 'ALREADY_EXISTS' };
}
await addChannel(channelData);
```

### 3. リトライ戦略
```typescript
// 指数バックオフでリトライ
async function updateWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
    }
  }
}
```

---

## バックアップ・リカバリ

### 自動バックアップ
- Google Drive の自動バージョン管理を活用
- 削除したデータは Google Drive のゴミ箱から復元可能（30日間）

### 手動エクスポート機能
```typescript
// スプレッドシート全体をJSON形式でエクスポート
GET /api/export/all
→ channels.json, videos.json, genres.json, ... をZIP圧縮

// インポート機能
POST /api/import/all
→ ZIPファイルをアップロードして復元
```

---

## パフォーマンス考慮事項

### Sheets API のレート制限
- 読み取り: 100リクエスト/100秒/ユーザー
- 書き込み: 100リクエスト/100秒/ユーザー

### 最適化手法
1. **バッチ処理**: 複数操作を1リクエストにまとめる
2. **キャッシュ**: 頻繁に読むデータはメモリに保持
3. **遅延書き込み**: 複数の更新をまとめて書き込む
4. **並列実行制限**: 同時リクエストを5件以下に抑える

---

## 将来的な拡張

### データベース移行の検討
- データ量が1万行を超えたら PostgreSQL/MySQL への移行を検討
- Sheets API のレート制限に頻繁に達する場合も移行を検討

### シャーディング戦略
- ユーザーごとに別スプレッドシート（現在の設計）
- ジャンルごとに別シート（将来的な拡張案）

### 読み取り専用レプリカ
- 分析用に別スプレッドシートをコピー
- 定期的に本体から同期
