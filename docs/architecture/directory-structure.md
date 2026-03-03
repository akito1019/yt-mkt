# ディレクトリ構成設計

## アーキテクチャパターン

**選定パターン**: Feature-Sliced Design (FSD) をベースに、Next.js App Routerの規約に適合させた構造

### 選定理由

1. **スケーラビリティ**: 機能ごとの分離により、段階的な機能追加（Phase 1-4）に対応
2. **関心の分離**: ビジネスロジック、UI、データアクセスを明確に分離
3. **テスタビリティ**: 各レイヤーが独立してテスト可能
4. **チーム協働**: 機能単位での並行開発が容易

## プロジェクトルート構成

```
yt-mkt/
├── src/
│   ├── app/                    # Next.js App Router (Routing + Pages)
│   ├── features/               # Feature-Sliced Design: 機能単位
│   ├── entities/               # Feature-Sliced Design: ドメインエンティティ
│   ├── shared/                 # Feature-Sliced Design: 共通コード
│   └── lib/                    # ライブラリラッパー・設定
├── public/                     # 静的ファイル
├── docs/                       # ドキュメント
│   ├── architecture/           # アーキテクチャ設計
│   └── api/                    # API仕様
├── biome.json                  # Biome設定
├── .env.local                  # 環境変数（Git除外）
├── next.config.js              # Next.js設定
├── tsconfig.json               # TypeScript設定
└── package.json
```

## 詳細ディレクトリ構成

### 1. `src/app/` - Next.js App Router (ルーティング層)

```
src/app/
├── (auth)/                     # Route Group: 認証関連
│   ├── login/
│   │   └── page.tsx            # ログインページ
│   └── callback/
│       └── page.tsx            # OAuth callback
├── (dashboard)/                # Route Group: 認証後のメイン画面
│   ├── layout.tsx              # ダッシュボードレイアウト
│   ├── page.tsx                # ダッシュボードトップ
│   ├── channels/
│   │   ├── page.tsx            # チャンネル一覧
│   │   └── [id]/
│   │       └── page.tsx        # チャンネル詳細
│   ├── genres/
│   │   ├── page.tsx            # ジャンル分析一覧
│   │   └── [slug]/
│   │       └── page.tsx        # ジャンル詳細
│   ├── niches/
│   │   └── page.tsx            # ニッチ発見
│   └── settings/
│       └── page.tsx            # 設定
├── api/                        # API Routes
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts        # NextAuth.js handler
│   ├── youtube/
│   │   ├── channels/
│   │   │   └── route.ts        # GET /api/youtube/channels?id=xxx
│   │   ├── videos/
│   │   │   └── route.ts        # GET /api/youtube/videos?channelId=xxx
│   │   └── search/
│   │       └── route.ts        # GET /api/youtube/search?q=xxx
│   ├── sheets/
│   │   ├── channels/
│   │   │   └── route.ts        # GET/POST /api/sheets/channels
│   │   ├── history/
│   │   │   └── route.ts        # POST /api/sheets/history
│   │   └── init/
│   │       └── route.ts        # POST /api/sheets/init (スプレッドシート初期化)
│   └── analysis/
│       ├── difficulty-score/
│       │   └── route.ts        # POST /api/analysis/difficulty-score
│       └── growth-rate/
│           └── route.ts        # POST /api/analysis/growth-rate
├── layout.tsx                  # Root Layout
├── page.tsx                    # Landing Page
├── loading.tsx                 # Global Loading
└── error.tsx                   # Global Error
```

### 2. `src/features/` - 機能層（ビジネスロジック）

```
src/features/
├── channel-analysis/           # チャンネル分析機能
│   ├── ui/
│   │   ├── ChannelCard.tsx     # チャンネル表示カード
│   │   ├── ChannelSearchForm.tsx
│   │   ├── GrowthChart.tsx     # 成長率グラフ
│   │   └── MetricsPanel.tsx    # 指標パネル
│   ├── model/
│   │   ├── useChannelAnalysis.ts  # チャンネル分析ロジック
│   │   ├── calculateGrowthRate.ts # 成長率計算
│   │   └── types.ts
│   └── api/
│       └── fetchChannelData.ts # チャンネルデータ取得
├── genre-analysis/             # ジャンル分析機能
│   ├── ui/
│   │   ├── GenreCard.tsx
│   │   ├── MarketSizeChart.tsx
│   │   └── CompetitionHeatmap.tsx
│   ├── model/
│   │   ├── useGenreAnalysis.ts
│   │   ├── calculateMarketSize.ts
│   │   └── types.ts
│   └── api/
│       └── fetchGenreData.ts
├── difficulty-score/           # 参入難易度スコア機能
│   ├── ui/
│   │   ├── DifficultyScoreCard.tsx
│   │   └── ScoreBreakdown.tsx  # スコア内訳
│   ├── model/
│   │   ├── useDifficultyScore.ts
│   │   ├── calculateDifficultyScore.ts  # スコア計算アルゴリズム
│   │   └── types.ts
│   └── api/
│       └── fetchScoreData.ts
├── niche-discovery/            # ニッチ発見機能 (Phase 3)
│   ├── ui/
│   │   ├── NicheList.tsx
│   │   └── KeywordGapChart.tsx
│   ├── model/
│   │   ├── useNicheDiscovery.ts
│   │   └── types.ts
│   └── api/
│       └── fetchNicheData.ts
└── auth/                       # 認証機能
    ├── ui/
    │   ├── LoginButton.tsx
    │   └── UserMenu.tsx
    └── model/
        └── useAuth.ts
```

### 3. `src/entities/` - エンティティ層（ドメインモデル）

```
src/entities/
├── channel/
│   ├── model/
│   │   ├── types.ts            # Channel型定義
│   │   └── schema.ts           # Zodスキーマ
│   ├── ui/
│   │   └── ChannelAvatar.tsx   # 再利用可能なUI
│   └── lib/
│       └── formatters.ts       # チャンネルデータフォーマッター
├── video/
│   ├── model/
│   │   ├── types.ts            # Video型定義
│   │   └── schema.ts
│   ├── ui/
│   │   └── VideoThumbnail.tsx
│   └── lib/
│       └── formatters.ts
├── genre/
│   ├── model/
│   │   ├── types.ts            # Genre型定義
│   │   └── constants.ts        # ジャンル定義リスト
│   └── lib/
│       └── validators.ts
└── user/
    ├── model/
    │   ├── types.ts            # User型定義
    │   └── schema.ts
    └── lib/
        └── permissions.ts
```

### 4. `src/shared/` - 共通層

```
src/shared/
├── ui/                         # 共通UIコンポーネント (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── table.tsx
│   ├── chart.tsx               # Recharts wrapper
│   └── ... (shadcn/uiコンポーネント)
├── hooks/
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── useAsync.ts
├── lib/
│   ├── utils.ts                # 汎用ユーティリティ (cn等)
│   ├── date.ts                 # 日付処理
│   ├── number.ts               # 数値フォーマット
│   └── validation.ts           # バリデーション
├── config/
│   ├── constants.ts            # グローバル定数
│   └── env.ts                  # 環境変数型定義
└── types/
    ├── api.ts                  # API共通型
    └── common.ts               # 汎用型
```

### 5. `src/lib/` - 外部ライブラリラッパー

```
src/lib/
├── youtube/
│   ├── client.ts               # YouTube Data API v3 クライアント
│   ├── types.ts                # YouTube API型定義
│   ├── quota.ts                # クォータ管理
│   └── cache.ts                # API応答キャッシュ
├── sheets/
│   ├── client.ts               # Google Sheets API v4 クライアント
│   ├── types.ts                # Sheets API型定義
│   ├── schema.ts               # シート構造定義
│   └── repository/
│       ├── channels.ts         # channelsシート操作
│       ├── history.ts          # channel_historyシート操作
│       ├── videos.ts           # videosシート操作
│       └── init.ts             # スプレッドシート初期化
├── auth/
│   ├── nextauth.ts             # NextAuth.js設定
│   └── middleware.ts           # 認証ミドルウェア
└── analytics/
    └── tracking.ts             # 分析トラッキング (将来用)
```

## 依存関係ルール

### Feature-Sliced Design レイヤー依存

```
app/ (Pages)
  ↓ 依存可能
features/ (Features)
  ↓ 依存可能
entities/ (Entities)
  ↓ 依存可能
shared/ (Shared)
  ↓ 依存可能
lib/ (External Libraries)
```

**重要原則**:
- 上位レイヤーは下位レイヤーに依存可能
- 下位レイヤーは上位レイヤーに依存禁止
- 同一レイヤー内の横断的依存は原則禁止（公開APIを経由）

### モジュール境界

```typescript
// ✅ 良い例: 上位 → 下位
// app/page.tsx
import { ChannelSearchForm } from '@/features/channel-analysis/ui/ChannelSearchForm'
import { Button } from '@/shared/ui/button'

// ✅ 良い例: feature → entity
// features/channel-analysis/model/useChannelAnalysis.ts
import { Channel } from '@/entities/channel/model/types'

// ❌ 悪い例: 下位 → 上位
// entities/channel/model/types.ts
import { useChannelAnalysis } from '@/features/channel-analysis' // 禁止!

// ❌ 悪い例: feature 間の直接依存
// features/genre-analysis/model/index.ts
import { calculateGrowthRate } from '@/features/channel-analysis/model' // 禁止!
// → shared/lib に移動するか、entities に抽出
```

## API Routes 設計

### RESTful 原則

```
GET    /api/youtube/channels?id=xxx          # チャンネル情報取得
GET    /api/youtube/videos?channelId=xxx     # チャンネルの動画一覧
GET    /api/youtube/search?q=xxx             # チャンネル検索

GET    /api/sheets/channels                  # 保存済みチャンネル一覧
POST   /api/sheets/channels                  # チャンネル保存
DELETE /api/sheets/channels?id=xxx           # チャンネル削除

POST   /api/sheets/history                   # 履歴データ追加
POST   /api/sheets/init                      # スプレッドシート初期化

POST   /api/analysis/difficulty-score        # 参入難易度計算
POST   /api/analysis/growth-rate             # 成長率計算
```

### API Routes 実装パターン

```typescript
// app/api/youtube/channels/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { youtubeClient } from '@/lib/youtube/client'
import { ChannelSchema } from '@/entities/channel/model/schema'

export async function GET(request: NextRequest) {
  // 1. 認証チェック
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. パラメータ検証
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('id')
  if (!channelId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // 3. 外部API呼び出し (lib層)
  const channelData = await youtubeClient.getChannel(channelId)

  // 4. スキーマ検証
  const validated = ChannelSchema.parse(channelData)

  // 5. レスポンス
  return NextResponse.json(validated)
}
```

## データフロー

### クライアント → API → 外部サービス

```
1. Client Side (RSC/Client Component)
   ↓
2. App Router Page (src/app/channels/[id]/page.tsx)
   ↓ Server Component で直接データ取得、または
   ↓ Client Component で fetch
3. API Route (src/app/api/youtube/channels/route.ts)
   ↓
4. Library Wrapper (src/lib/youtube/client.ts)
   ↓
5. External API (YouTube Data API / Google Sheets API)
```

### キャッシュ戦略

```
Level 1: ブラウザキャッシュ (localStorage)
  - ユーザー設定
  - 最近の検索履歴

Level 2: Next.js ISR/Cache
  - fetch() 自動キャッシュ (App Router)
  - revalidate: 24時間

Level 3: API レスポンスキャッシュ
  - YouTube API応答: 24時間
  - Sheets データ: 5分

Level 4: Google Sheets (永続化)
  - マスターデータ
  - 履歴データ
```

## 状態管理戦略

### Server State (データ取得)

- **Next.js App Router RSC** (サーバーコンポーネントで直接fetch)
- **React Server Actions** (Mutation用)
- **TanStack Query (React Query)** - 将来的にクライアント側で必要な場合

### Client State (UIステート)

- **React useState/useReducer** - ローカルステート
- **URL Search Params** - フィルタ・ページネーション
- **Context API** - テーマ、ユーザー設定 (最小限)

### Form State

- **React Hook Form** - フォームバリデーション
- **Zod** - スキーマ検証

## 型安全性

### 型の伝播

```typescript
// 1. API型定義 (lib層)
// lib/youtube/types.ts
export type YouTubeChannel = {
  id: string
  snippet: {
    title: string
    description: string
  }
  statistics: {
    subscriberCount: string
    viewCount: string
  }
}

// 2. エンティティ型 (entities層)
// entities/channel/model/types.ts
export type Channel = {
  youtubeId: string
  title: string
  description: string
  subscriberCount: number
  viewCount: number
  genre?: string
}

// 3. ビジネスロジック型 (features層)
// features/channel-analysis/model/types.ts
export type ChannelAnalysis = {
  channel: Channel
  growthRate: number
  avgViewsPerVideo: number
  postingFrequency: number
}

// 4. UI Props型 (features/ui)
// features/channel-analysis/ui/ChannelCard.tsx
type ChannelCardProps = {
  analysis: ChannelAnalysis
  onSelect?: (channelId: string) => void
}
```

## エラーハンドリング戦略

### レイヤー別エラー処理

```
API Routes:
  - try/catch でエラーをキャッチ
  - HTTPステータスコードで返す
  - エラーログ記録

Client Components:
  - Error Boundary でキャッチ
  - ユーザーフレンドリーなメッセージ表示
  - リトライ機能提供

External API呼び出し:
  - クォータ超過検出
  - レートリミット対応
  - フォールバック処理
```

## パフォーマンス最適化

### 初期表示最適化

```
1. App Router SSR/SSG活用
2. 重要なデータのみ初期ロード
3. 画像の遅延読み込み (next/image)
4. コンポーネントの動的インポート
```

### ビルド最適化

```
1. Tree Shaking (未使用コード削除)
2. Code Splitting (Route-based)
3. 動的インポート (features/niche-discovery等、Phase 3以降)
```

## セキュリティ境界

```
Public Routes:
  - / (ランディングページ)
  - /login

Protected Routes (認証必須):
  - /dashboard/*
  - /channels/*
  - /genres/*
  - /niches/*
  - /settings

API Routes:
  - すべて認証チェック必須
  - CSRF対策 (Next.js標準)
  - Rate Limiting (将来実装)
```

## テスト戦略

### テストディレクトリ構成

```
src/
├── features/
│   └── channel-analysis/
│       ├── model/
│       │   ├── calculateGrowthRate.ts
│       │   └── calculateGrowthRate.test.ts  # ユニットテスト
│       └── ui/
│           ├── ChannelCard.tsx
│           └── ChannelCard.test.tsx         # コンポーネントテスト
└── __tests__/
    ├── integration/                         # 統合テスト
    │   └── api/
    │       └── youtube.test.ts
    └── e2e/                                 # E2Eテスト (Playwright)
        └── channel-search.spec.ts
```

### テスト種別

1. **Unit Tests**: ビジネスロジック (features/*/model, shared/lib)
2. **Component Tests**: UI (features/*/ui, entities/*/ui)
3. **Integration Tests**: API Routes
4. **E2E Tests**: ユーザーフロー

## 開発フェーズ別構成

### Phase 1 (MVP) - 実装必須

```
app/
├── (auth)/login
├── (dashboard)/
│   ├── page.tsx (簡易ダッシュボード)
│   └── channels/
api/
├── auth/[...nextauth]
├── youtube/channels
└── sheets/init
features/
├── auth/
└── channel-analysis/
lib/
├── youtube/
├── sheets/
└── auth/
```

### Phase 2 (分析強化) - 追加

```
app/(dashboard)/
└── genres/
api/
└── analysis/difficulty-score
features/
├── genre-analysis/
└── difficulty-score/
```

### Phase 3 (ニッチ発見) - 追加

```
app/(dashboard)/
└── niches/
features/
└── niche-discovery/
```

### Phase 4 (高度分析) - 追加

```
lib/
├── puppeteer/ (サムネイル解析)
└── nlp/ (タイトル分析)
features/
├── thumbnail-analysis/
└── title-analysis/
```

## 環境変数管理

```bash
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

YOUTUBE_API_KEY=xxx

# Optional
NEXT_PUBLIC_APP_NAME="yt-mkt"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## まとめ

この構成により以下を実現:

1. **段階的開発**: Phase 1-4に対応した拡張性
2. **関心の分離**: app (Routing) / features (Logic) / entities (Domain) / shared (Common)
3. **型安全性**: TypeScript + Zod によるエンドツーエンド型検証
4. **テスタビリティ**: 各レイヤーの独立性
5. **パフォーマンス**: Next.js App Router の最適化機能活用
6. **保守性**: Feature-Sliced Design による明確な依存関係
