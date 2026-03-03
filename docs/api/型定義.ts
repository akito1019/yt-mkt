/**
 * YouTube市場調査システム - 型定義
 *
 * このファイルはドキュメント用のリファレンスです。
 * 実装時は実際のプロジェクトに適切な場所（例: src/types/）に配置してください。
 */

// ============================================================================
// YouTube Data API レスポンス型
// ============================================================================

/**
 * YouTube チャンネル情報
 */
export interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    publishedAt: string; // ISO 8601
    thumbnails: YouTubeThumbnails;
    country?: string;
    localized?: {
      title: string;
      description: string;
    };
  };
  contentDetails?: {
    relatedPlaylists: {
      uploads: string; // アップロード動画のプレイリストID
      likes?: string;
    };
  };
  statistics: {
    viewCount: string; // 文字列型で返される
    subscriberCount: string;
    hiddenSubscriberCount: boolean;
    videoCount: string;
  };
  brandingSettings?: {
    channel?: {
      title: string;
      description: string;
      keywords?: string;
    };
    image?: {
      bannerExternalUrl: string;
    };
  };
}

/**
 * YouTube 動画情報
 */
export interface YouTubeVideo {
  id: string;
  snippet: {
    publishedAt: string; // ISO 8601
    channelId: string;
    title: string;
    description: string;
    thumbnails: YouTubeThumbnails;
    channelTitle: string;
    tags?: string[];
    categoryId: string;
    liveBroadcastContent: 'none' | 'upcoming' | 'live';
    localized?: {
      title: string;
      description: string;
    };
  };
  contentDetails: {
    duration: string; // ISO 8601 duration (PT1H2M3S)
    dimension: '2d' | '3d';
    definition: 'sd' | 'hd';
    caption: 'false' | 'true';
  };
  statistics: {
    viewCount: string;
    likeCount?: string; // いいね数を非表示にしている場合は undefined
    favoriteCount?: string;
    commentCount?: string;
  };
}

/**
 * YouTube サムネイル情報
 */
export interface YouTubeThumbnails {
  default: YouTubeThumbnail;
  medium: YouTubeThumbnail;
  high: YouTubeThumbnail;
  standard?: YouTubeThumbnail;
  maxres?: YouTubeThumbnail;
}

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

/**
 * YouTube 検索結果
 */
export interface YouTubeSearchResult {
  kind: 'youtube#searchResult';
  id: {
    kind: 'youtube#channel' | 'youtube#video' | 'youtube#playlist';
    channelId?: string;
    videoId?: string;
    playlistId?: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: YouTubeThumbnails;
    channelTitle: string;
  };
}

// ============================================================================
// アプリケーション内部の型定義
// ============================================================================

/**
 * チャンネル情報（アプリケーション内部）
 */
export interface Channel {
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
  addedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * チャンネル履歴（日次スナップショット）
 */
export interface ChannelHistory {
  youtubeId: string;
  date: string; // YYYY-MM-DD
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  fetchedAt: string; // ISO 8601
}

/**
 * 動画情報
 */
export interface Video {
  youtubeId: string;
  channelId: string;
  title: string;
  description: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt: string; // ISO 8601
  duration: string; // ISO 8601 duration
  thumbnailUrl: string;
  tags?: string[];
  categoryId?: string;
  fetchedAt: string; // ISO 8601
}

/**
 * ジャンル情報
 */
export interface Genre {
  name: string;
  channelCount: number;
  totalSubscribers: number;
  totalViews: number;
  avgSubscribers: number;
  avgViews: number;
  avgUploadFrequency?: number; // 週あたりの投稿数
  marketGrowthRate?: number; // 市場成長率（%）
  entryDifficultyScore?: number; // 参入難易度スコア (0-100)
  lastCalculatedAt: string; // ISO 8601
}

/**
 * 分析キャッシュ
 */
export interface AnalysisCache {
  cacheKey: string;
  cacheType: CacheType;
  resultJson: string; // JSON文字列
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
}

export type CacheType =
  | 'channel_analysis'
  | 'genre_analysis'
  | 'video_recommendations'
  | 'market_overview';

/**
 * クォータログ
 */
export interface QuotaLog {
  date: string; // YYYY-MM-DD
  operation: YouTubeOperation;
  cost: number;
  endpoint?: string;
  userEmail: string;
  timestamp: string; // ISO 8601
}

export type YouTubeOperation =
  | 'search.list'
  | 'channels.list'
  | 'videos.list'
  | 'playlistItems.list'
  | 'commentThreads.list';

/**
 * ユーザー設定
 */
export interface Settings {
  spreadsheetId?: string;
  autoUpdateEnabled?: boolean;
  updateIntervalHours?: number;
  defaultGenre?: string;
  quotaAlertThreshold?: number;
  preferredLanguage?: string;
}

// ============================================================================
// API リクエスト/レスポンス型
// ============================================================================

/**
 * チャンネル検索リクエスト
 */
export interface ChannelSearchRequest {
  query: string;
  maxResults?: number; // デフォルト: 25、最大: 50
  order?: 'relevance' | 'viewCount' | 'date';
}

/**
 * チャンネル検索レスポンス
 */
export interface ChannelSearchResponse {
  channels: ChannelSearchItem[];
  nextPageToken?: string;
  quotaUsed: number;
}

export interface ChannelSearchItem {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  customUrl?: string;
}

/**
 * チャンネル詳細レスポンス
 */
export interface ChannelDetailResponse extends Channel {
  stats: ChannelStats;
  cachedAt: string; // ISO 8601
}

export interface ChannelStats {
  avgViewsPerVideo: number;
  subscriberGrowth30d?: number; // 30日間の成長率（%）
  subscriberGrowth90d?: number; // 90日間の成長率（%）
  uploadFrequency?: number; // 週あたりの投稿数
}

/**
 * チャンネルトラッキング追加リクエスト
 */
export interface TrackChannelRequest {
  genre?: string;
}

/**
 * チャンネルトラッキング追加レスポンス
 */
export interface TrackChannelResponse {
  success: boolean;
  channelId: string;
  addedAt: string; // ISO 8601
}

/**
 * トラッキング中チャンネル一覧レスポンス
 */
export interface TrackedChannelsResponse {
  channels: TrackedChannel[];
  total: number;
}

export interface TrackedChannel {
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
}

/**
 * 一括更新リクエスト
 */
export interface BulkUpdateRequest {
  channelIds?: string[]; // 指定がなければ全チャンネル
  updateHistory?: boolean; // デフォルト: true
}

/**
 * 一括更新レスポンス
 */
export interface BulkUpdateResponse {
  success: boolean;
  updatedCount: number;
  failedIds: string[];
  quotaUsed: number;
}

/**
 * チャンネルの動画一覧レスポンス
 */
export interface ChannelVideosResponse {
  videos: VideoListItem[];
  nextPageToken?: string;
  quotaUsed: number;
}

export interface VideoListItem {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt: string; // ISO 8601
  duration: string; // ISO 8601 duration
}

/**
 * 動画分析リクエスト
 */
export interface VideoAnalysisRequest {
  videoIds: string[]; // 最大50件
  includeMetrics?: boolean; // デフォルト: true
}

/**
 * 動画分析レスポンス
 */
export interface VideoAnalysisResponse {
  videos: VideoAnalysisItem[];
  quotaUsed: number;
}

export interface VideoAnalysisItem extends Video {
  metrics?: VideoMetrics;
}

export interface VideoMetrics {
  engagementRate: number; // (いいね + コメント) / 再生数
  viewsPerDay: number; // 日割り再生数
  titleLength: number;
  titleKeywords: string[]; // 頻出キーワード
}

/**
 * ジャンル一覧レスポンス
 */
export interface GenresResponse {
  genres: GenreSummary[];
}

export interface GenreSummary {
  name: string;
  channelCount: number;
  totalSubscribers: number;
  totalViews: number;
}

/**
 * ジャンル分析レスポンス
 */
export interface GenreAnalysisResponse {
  genre: string;
  summary: GenreAnalysisSummary;
  entryDifficulty: EntryDifficulty;
  topChannels: TopChannel[];
}

export interface GenreAnalysisSummary {
  channelCount: number;
  totalSubscribers: number;
  totalViews: number;
  avgSubscribers: number;
  avgViews: number;
  avgVideosPerChannel: number;
}

export interface EntryDifficulty {
  score: number; // 0-100（低いほど参入しやすい）
  factors: {
    competitionDensity: number; // 競合密度
    marketGrowthRate: number; // 市場成長率（%）
    topChannelDominance: number; // 上位独占度（%）
    requiredUploadFrequency: number; // 必要投稿頻度（週）
  };
}

export interface TopChannel {
  youtubeId: string;
  title: string;
  subscriberCount: number;
  viewCount: number;
}

/**
 * クォータ状況レスポンス
 */
export interface QuotaStatusResponse {
  date: string; // YYYY-MM-DD
  used: number;
  limit: number; // 10,000
  remaining: number;
  percentage: number; // 使用率（%）
  estimatedResetAt: string; // ISO 8601
}

/**
 * クォータ予約リクエスト
 */
export interface QuotaReserveRequest {
  estimatedCost: number;
  operation: string;
}

/**
 * クォータ予約レスポンス
 */
export interface QuotaReserveResponse {
  allowed: boolean;
  remaining: number;
  message?: string;
}

/**
 * ヘルスチェックレスポンス
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  services: {
    youtube: 'ok' | 'error';
    sheets: 'ok' | 'error';
    auth: 'ok' | 'error';
  };
  timestamp: string; // ISO 8601
}

/**
 * キャッシュクリアリクエスト
 */
export interface CacheClearRequest {
  target?: 'all' | 'channels' | 'videos' | 'analysis';
}

/**
 * キャッシュクリアレスポンス
 */
export interface CacheClearResponse {
  success: boolean;
  clearedItems: number;
}

/**
 * スプレッドシート初期化レスポンス
 */
export interface SpreadsheetInitResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  created: boolean; // 新規作成かどうか
  sheets: string[]; // シート名のリスト
}

// ============================================================================
// エラー型
// ============================================================================

/**
 * API エラーレスポンス
 */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: any;
  };
  timestamp: string; // ISO 8601
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'YOUTUBE_API_ERROR'
  | 'SHEETS_API_ERROR'
  | 'INTERNAL_ERROR';

/**
 * カスタムエラークラス
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// ユーティリティ型
// ============================================================================

/**
 * ページネーション用の共通型
 */
export interface PaginatedRequest {
  pageToken?: string;
  maxResults?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults?: number;
}

/**
 * ソート用の共通型
 */
export interface SortableRequest {
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * フィルター用の共通型
 */
export interface FilterableRequest {
  filters?: Record<string, any>;
}

/**
 * 日付範囲指定
 */
export interface DateRangeFilter {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

// ============================================================================
// Google Sheets 型定義
// ============================================================================

/**
 * Sheets の行データ（型安全に扱うためのヘルパー）
 */
export type SheetRow<T> = {
  [K in keyof T]: T[K] extends number
    ? number | string // Sheets は数値も文字列で返すことがある
    : T[K] extends boolean
    ? boolean | string
    : string;
};

/**
 * Sheets API のレスポンス
 */
export interface SheetsValueRange {
  range: string;
  majorDimension: 'ROWS' | 'COLUMNS';
  values: any[][];
}

/**
 * Sheets API のバッチレスポンス
 */
export interface SheetsBatchGetResponse {
  spreadsheetId: string;
  valueRanges: SheetsValueRange[];
}

// ============================================================================
// NextAuth 型拡張
// ============================================================================

/**
 * NextAuth のセッション型を拡張
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string; // Google アクセストークン
    refreshToken?: string; // Google リフレッシュトークン
    spreadsheetId?: string; // ユーザー専用のスプレッドシートID
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    spreadsheetId?: string;
  }
}

// ============================================================================
// 環境変数型定義（型安全なアクセス用）
// ============================================================================

export interface EnvironmentVariables {
  // NextAuth
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;

  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // YouTube API
  YOUTUBE_API_KEY: string;

  // 開発用モック
  YOUTUBE_API_MOCK?: 'true' | 'false';
  SHEETS_API_MOCK?: 'true' | 'false';

  // その他
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * 型安全な環境変数アクセス
 */
export function getEnv<K extends keyof EnvironmentVariables>(
  key: K
): EnvironmentVariables[K] {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value as EnvironmentVariables[K];
}

// ============================================================================
// 定数定義
// ============================================================================

/**
 * YouTube API のクォータコスト
 */
export const QUOTA_COSTS = {
  'search.list': 100,
  'channels.list': 1,
  'videos.list': 1,
  'playlistItems.list': 1,
  'commentThreads.list': 1,
} as const;

/**
 * クォータの上限
 */
export const QUOTA_LIMITS = {
  DAILY: 10000,
  SAFE_THRESHOLD: 8000, // 80%
  CRITICAL_THRESHOLD: 9500, // 95%
} as const;

/**
 * キャッシュのTTL（秒）
 */
export const CACHE_TTL = {
  channels: 24 * 60 * 60, // 24時間
  videos: 12 * 60 * 60, // 12時間
  search: 6 * 60 * 60, // 6時間
  analysis: 1 * 60 * 60, // 1時間
} as const;

/**
 * API レート制限
 */
export const RATE_LIMITS = {
  PER_USER_PER_MINUTE: 100,
  PER_IP_PER_MINUTE: 200,
} as const;

/**
 * Sheets API の制限
 */
export const SHEETS_LIMITS = {
  READ_REQUESTS_PER_100_SECONDS: 100,
  WRITE_REQUESTS_PER_100_SECONDS: 100,
  MAX_BATCH_SIZE: 50,
} as const;

/**
 * シート名の定数
 */
export const SHEET_NAMES = {
  CHANNELS: 'channels',
  CHANNEL_HISTORY: 'channel_history',
  VIDEOS: 'videos',
  GENRES: 'genres',
  ANALYSIS_CACHE: 'analysis_cache',
  QUOTA_LOG: 'quota_log',
  SETTINGS: 'settings',
} as const;
