# API Routes 設計

## 概要

Next.js App Router の Route Handlers を使用した API 設計。
すべてのエンドポイントは認証が必須（NextAuth.js セッション）。

---

## 認証エンドポイント

### POST `/api/auth/[...nextauth]`

NextAuth.js が自動生成する認証エンドポイント。

**提供機能:**
- Google OAuth ログイン/ログアウト
- セッション管理
- トークンリフレッシュ

**スコープ:**
```
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

---

## データ管理エンドポイント

### GET `/api/spreadsheet/init`

ユーザーのスプレッドシートを初期化/取得。

**処理フロー:**
1. ユーザーの Google Drive で既存のスプレッドシートを検索
2. 存在しない場合、テンプレートから新規作成
3. スプレッドシート ID をセッションに保存
4. シート構造を検証・修復

**レスポンス:**
```typescript
{
  spreadsheetId: string;
  spreadsheetUrl: string;
  created: boolean; // 新規作成かどうか
  sheets: string[]; // シート名のリスト
}
```

**エラー:**
- `401`: 未認証
- `403`: Google Drive API へのアクセス権限なし
- `500`: スプレッドシート作成失敗

---

## チャンネル分析エンドポイント

### POST `/api/channels/search`

YouTube チャンネルをキーワード検索。

**リクエストボディ:**
```typescript
{
  query: string; // 検索キーワード（必須）
  maxResults?: number; // 最大取得件数（デフォルト: 25、最大: 50）
  order?: 'relevance' | 'viewCount' | 'date'; // デフォルト: relevance
}
```

**レスポンス:**
```typescript
{
  channels: {
    youtubeId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    customUrl?: string;
  }[];
  nextPageToken?: string;
  quotaUsed: number; // 消費したクォータ
}
```

**クォータ消費:** 100 (search.list)

**エラー:**
- `400`: クエリパラメータ不正
- `401`: 未認証
- `429`: YouTube API クォータ超過
- `503`: YouTube API エラー

---

### GET `/api/channels/[channelId]`

特定チャンネルの詳細情報を取得。

**クエリパラメータ:**
- `forceRefresh?: boolean` - キャッシュを無視して再取得

**レスポンス:**
```typescript
{
  youtubeId: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl: string;
  bannerUrl?: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  publishedAt: string; // ISO 8601
  country?: string;
  genre?: string; // ユーザーが設定したジャンル
  // 統計情報
  stats: {
    avgViewsPerVideo: number;
    subscriberGrowth30d?: number; // 30日間の成長率
    subscriberGrowth90d?: number; // 90日間の成長率
    uploadFrequency?: number; // 週あたりの投稿数
  };
  cachedAt: string; // キャッシュ日時
}
```

**クォータ消費:** 1 (channels.list) ※キャッシュがない場合のみ

**エラー:**
- `404`: チャンネルが存在しない
- `401`: 未認証
- `429`: YouTube API クォータ超過

---

### POST `/api/channels/[channelId]/track`

チャンネルをトラッキングリストに追加（Google Sheets へ保存）。

**リクエストボディ:**
```typescript
{
  genre?: string; // ジャンル（オプション）
}
```

**処理フロー:**
1. YouTube API でチャンネル情報を取得
2. Google Sheets の `channels` シートに追加
3. `channel_history` シートに初回レコード追加

**レスポンス:**
```typescript
{
  success: boolean;
  channelId: string;
  addedAt: string; // ISO 8601
}
```

**エラー:**
- `409`: 既にトラッキング中
- `401`: 未認証
- `429`: YouTube API クォータ超過
- `500`: Sheets への書き込み失敗

---

### DELETE `/api/channels/[channelId]/track`

チャンネルをトラッキングリストから削除。

**レスポンス:**
```typescript
{
  success: boolean;
  deletedCount: number; // 削除された行数
}
```

**エラー:**
- `404`: トラッキングされていない
- `401`: 未認証

---

### GET `/api/channels/tracked`

トラッキング中のチャンネル一覧を取得。

**クエリパラメータ:**
- `genre?: string` - ジャンルでフィルタ
- `sortBy?: 'subscribers' | 'views' | 'addedAt' | 'growth'` - ソート基準
- `order?: 'asc' | 'desc'` - ソート順（デフォルト: desc）

**レスポンス:**
```typescript
{
  channels: {
    youtubeId: string;
    title: string;
    thumbnailUrl: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    genre?: string;
    addedAt: string;
    updatedAt: string;
    growth30d?: number; // 過去30日の成長率（%）
  }[];
  total: number;
}
```

**エラー:**
- `401`: 未認証
- `500`: Sheets 読み込みエラー

---

### POST `/api/channels/bulk-update`

トラッキング中のチャンネルを一括更新（日次バッチ処理用）。

**リクエストボディ:**
```typescript
{
  channelIds?: string[]; // 指定がなければ全チャンネル
  updateHistory?: boolean; // channel_history にレコード追加（デフォルト: true）
}
```

**処理フロー:**
1. channels シートから対象チャンネルを取得
2. YouTube API で最新情報を一括取得（最大50件ずつ）
3. channels シートを更新
4. channel_history シートに履歴追加

**レスポンス:**
```typescript
{
  success: boolean;
  updatedCount: number;
  failedIds: string[]; // 更新失敗したチャンネルID
  quotaUsed: number;
}
```

**クォータ消費:** Math.ceil(チャンネル数 / 50) × 1

**エラー:**
- `401`: 未認証
- `429`: YouTube API クォータ超過

---

## 動画分析エンドポイント

### GET `/api/channels/[channelId]/videos`

チャンネルの動画一覧を取得。

**クエリパラメータ:**
- `maxResults?: number` - 最大取得件数（デフォルト: 25、最大: 50）
- `order?: 'date' | 'viewCount' | 'rating'` - ソート順（デフォルト: date）
- `pageToken?: string` - ページネーション用トークン

**レスポンス:**
```typescript
{
  videos: {
    youtubeId: string;
    title: string;
    thumbnailUrl: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
    duration: string; // ISO 8601 duration (PT1H2M3S)
  }[];
  nextPageToken?: string;
  quotaUsed: number;
}
```

**クォータ消費:** 1 (playlistItems.list) + 1 (videos.list)

**エラー:**
- `404`: チャンネルが存在しない
- `401`: 未認証
- `429`: YouTube API クォータ超過

---

### POST `/api/videos/analyze`

複数動画の分析（タイトル、サムネイル、パフォーマンス）。

**リクエストボディ:**
```typescript
{
  videoIds: string[]; // 最大50件
  includeMetrics?: boolean; // 詳細メトリクスを含める（デフォルト: true）
}
```

**レスポンス:**
```typescript
{
  videos: {
    youtubeId: string;
    channelId: string;
    title: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
    thumbnailUrl: string;
    duration: string;
    // 分析結果
    metrics?: {
      engagementRate: number; // (いいね + コメント) / 再生数
      viewsPerDay: number; // 日割り再生数
      titleLength: number;
      titleKeywords: string[]; // 頻出キーワード（簡易抽出）
    };
  }[];
  quotaUsed: number;
}
```

**クォータ消費:** Math.ceil(videoIds.length / 50) × 1

**エラー:**
- `400`: videoIds が不正（空、または51件以上）
- `401`: 未認証
- `429`: YouTube API クォータ超過

---

## ジャンル/市場分析エンドポイント

### GET `/api/genres`

登録されているジャンル一覧を取得。

**レスポンス:**
```typescript
{
  genres: {
    name: string;
    channelCount: number; // このジャンルのチャンネル数
    totalSubscribers: number; // 合計登録者数
    totalViews: number; // 合計再生数
  }[];
}
```

**エラー:**
- `401`: 未認証
- `500`: Sheets 読み込みエラー

---

### GET `/api/genres/[genreName]/analysis`

特定ジャンルの市場分析。

**レスポンス:**
```typescript
{
  genre: string;
  summary: {
    channelCount: number;
    totalSubscribers: number;
    totalViews: number;
    avgSubscribers: number;
    avgViews: number;
    avgVideosPerChannel: number;
  };
  // 参入難易度スコア
  entryDifficulty: {
    score: number; // 0-100（低いほど参入しやすい）
    factors: {
      competitionDensity: number; // 競合密度
      marketGrowthRate: number; // 市場成長率（%）
      topChannelDominance: number; // 上位独占度（%）
      requiredUploadFrequency: number; // 必要投稿頻度（週）
    };
  };
  // トップチャンネル
  topChannels: {
    youtubeId: string;
    title: string;
    subscriberCount: number;
    viewCount: number;
  }[];
}
```

**計算ロジック:**
```typescript
// 参入難易度スコア = 加重平均
score = (
  competitionDensity * 0.3 +
  (100 - marketGrowthRate) * 0.3 +
  topChannelDominance * 0.2 +
  (requiredUploadFrequency / 10) * 100 * 0.2
);

// competitionDensity: チャンネル数 / (月間総再生数 / 1M)
// marketGrowthRate: 直近6ヶ月の再生数成長率（%）
// topChannelDominance: 上位10チャンネルの再生数シェア（%）
// requiredUploadFrequency: 成功チャンネルの中央値
```

**エラー:**
- `404`: ジャンルが存在しない
- `401`: 未認証
- `500`: 計算エラー

---

## クォータ管理エンドポイント

### GET `/api/quota/status`

YouTube API クォータの使用状況を取得。

**レスポンス:**
```typescript
{
  date: string; // YYYY-MM-DD
  used: number; // 当日の消費クォータ
  limit: number; // 日次上限（10,000）
  remaining: number; // 残りクォータ
  percentage: number; // 使用率（%）
  estimatedResetAt: string; // リセット予定時刻（ISO 8601）
}
```

**データソース:** Google Sheets の `quota_log` シート

**エラー:**
- `401`: 未認証
- `500`: Sheets 読み込みエラー

---

### POST `/api/quota/reserve`

クォータを事前予約（バッチ処理前のチェック）。

**リクエストボディ:**
```typescript
{
  estimatedCost: number; // 予想消費クォータ
  operation: string; // 操作名（ログ用）
}
```

**レスポンス:**
```typescript
{
  allowed: boolean; // 実行可否
  remaining: number; // 残りクォータ
  message?: string; // エラーメッセージ
}
```

**判定ロジック:**
```typescript
// 安全マージン: 残り20%は緊急用に確保
const safeLimit = limit * 0.8;
allowed = (used + estimatedCost) <= safeLimit;
```

**エラー:**
- `401`: 未認証

---

## ユーティリティエンドポイント

### GET `/api/health`

API の健全性チェック。

**レスポンス:**
```typescript
{
  status: 'ok' | 'degraded' | 'down';
  services: {
    youtube: 'ok' | 'error';
    sheets: 'ok' | 'error';
    auth: 'ok' | 'error';
  };
  timestamp: string; // ISO 8601
}
```

**エラーハンドリング:** 常に 200 OK を返す（status で状態を判定）

---

### POST `/api/cache/clear`

キャッシュを手動クリア。

**リクエストボディ:**
```typescript
{
  target?: 'all' | 'channels' | 'videos' | 'analysis'; // デフォルト: all
}
```

**レスポンス:**
```typescript
{
  success: boolean;
  clearedItems: number;
}
```

**エラー:**
- `401`: 未認証

---

## エラーレスポンス標準化

すべてのエラーは以下の形式で返す:

```typescript
{
  error: {
    code: string; // エラーコード（例: 'QUOTA_EXCEEDED'）
    message: string; // ユーザー向けメッセージ
    details?: any; // 詳細情報（開発用）
  };
  timestamp: string; // ISO 8601
}
```

**共通エラーコード:**
- `UNAUTHORIZED`: 未認証
- `FORBIDDEN`: 権限不足
- `NOT_FOUND`: リソースが存在しない
- `VALIDATION_ERROR`: 入力バリデーションエラー
- `QUOTA_EXCEEDED`: YouTube API クォータ超過
- `YOUTUBE_API_ERROR`: YouTube API エラー
- `SHEETS_API_ERROR`: Google Sheets API エラー
- `INTERNAL_ERROR`: 内部エラー

---

## レート制限

### クライアント側制限

Next.js ミドルウェアで実装:
- 同一ユーザー: 100 リクエスト/分
- 同一 IP: 200 リクエスト/分

### YouTube API 制限

クォータ管理エンドポイントで監視:
- 日次上限: 10,000 クォータ/日
- 安全マージン: 上限の 80% まで使用可能

---

## キャッシュ戦略

### チャンネル情報
- TTL: 24時間
- ストレージ: Google Sheets (`channels` シート)
- 更新条件: `forceRefresh=true` または TTL 経過

### 動画情報
- TTL: 12時間
- ストレージ: Google Sheets (`videos` シート)
- 更新条件: `forceRefresh=true` または TTL 経過

### 分析結果
- TTL: 1時間
- ストレージ: Google Sheets (`analysis_cache` シート)
- 更新条件: 元データ更新時に自動削除

---

## 認証フロー

すべてのエンドポイント（`/api/auth/*` と `/api/health` を除く）:

```typescript
1. Next.js ミドルウェアで JWT セッションを検証
2. セッションから Google アクセストークンを取得
3. トークン有効期限をチェック
4. 期限切れの場合、リフレッシュトークンで更新
5. リフレッシュ失敗の場合、401 Unauthorized を返す
```

---

## セキュリティ考慮事項

### CSRF 対策
- NextAuth.js の組み込み CSRF 保護を使用
- すべての POST/PUT/DELETE リクエストに CSRF トークンが必要

### XSS 対策
- すべての出力は自動エスケープ（Next.js デフォルト）
- YouTube API から取得したデータも信用せず、サニタイズ

### アクセス制御
- ユーザーは自分のスプレッドシートにのみアクセス可能
- スプレッドシート ID はセッションに紐づける
- 他ユーザーのスプレッドシート ID を指定しても拒否

### シークレット管理
- YouTube API キーは環境変数
- Google OAuth クライアントシークレットは環境変数
- NextAuth シークレットは環境変数
- `.env.local` は `.gitignore` で除外

---

## パフォーマンス最適化

### バッチ処理
- YouTube API: 最大50件の ID をまとめて取得
- Google Sheets: batchUpdate API で複数行を一括更新

### 並列処理
- 独立した API 呼び出しは Promise.all で並列実行
- YouTube API と Sheets API は並列実行可能

### ストリーミングレスポンス
- 大量データ取得時は Server-Sent Events でストリーミング
- `/api/channels/bulk-update` で進捗をリアルタイム通知

### ISR（Incremental Static Regeneration）
- 統計ページは ISR で事前生成
- revalidate: 3600 秒（1時間）

---

## 監視・ロギング

### ログ出力項目
- リクエスト ID（トレース用）
- ユーザー ID（セッション）
- エンドポイント
- ステータスコード
- レスポンスタイム
- YouTube API クォータ消費量
- エラー詳細（スタックトレース）

### ログレベル
- `INFO`: 正常なリクエスト
- `WARN`: クォータ使用率 80% 超過、リトライ発生
- `ERROR`: API エラー、予期しない例外

### メトリクス
- YouTube API クォータ使用率
- エンドポイント別レスポンスタイム
- エラー発生率
- キャッシュヒット率

---

## 開発時のモック対応

### YouTube API モック
- `NODE_ENV=development` 時、ローカルの JSON ファイルからレスポンス
- クォータを消費せずに開発可能

### Google Sheets モック
- `NODE_ENV=development` 時、メモリ内 Map で代用
- 実際の Sheets API を呼ばずにテスト可能

### 環境変数
```bash
# .env.local
YOUTUBE_API_MOCK=true
SHEETS_API_MOCK=true
```
