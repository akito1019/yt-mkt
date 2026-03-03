# YouTube市場調査システム 開発計画

## 概要

YouTubeで稼ぐための市場調査システム。
データに基づいて「どの市場で戦うか」を判断できるようにする。

## 目的

- 伸びている市場（ジャンル）を発見する
- 競合が少ないニッチを見つける
- 成功しているチャンネルのパターンを分析する
- 参入すべき市場をデータで決断する

---

## 必要な機能

### 1. チャンネル分析

| 機能 | 詳細 | データソース |
|------|------|-------------|
| 登録者数・再生数の取得 | 基本指標 | YouTube Data API |
| 成長率の計算 | 直近30日/90日の伸び | API + DB蓄積 |
| 投稿頻度の分析 | 週何本投稿しているか | API |
| 動画あたりの平均再生数 | チャンネルの実力値 | API |

### 2. 動画分析

| 機能 | 詳細 | データソース |
|------|------|-------------|
| タイトルのパターン分析 | よく使われるキーワード・構文 | API + NLP |
| サムネイル分析 | 色使い、テキスト有無、顔の有無 | スクレイピング + 画像解析 |
| 再生数と投稿日の相関 | 動画の寿命、初速の重要性 | API |
| 人気動画の共通点 | 上位10%の動画の特徴 | API + 分析 |

### 3. 市場（ジャンル）分析

| 機能 | 詳細 | データソース |
|------|------|-------------|
| ジャンル別の市場規模 | 総再生数、チャンネル数 | API + 集計 |
| 市場の成長率 | 前年比、トレンド | API + 時系列分析 |
| 競合密度 | チャンネル数 vs 視聴者数 | API + 計算 |
| 参入難易度スコア | 独自指標（後述） | 複合分析 |

### 4. ニッチ発見

| 機能 | 詳細 | データソース |
|------|------|-------------|
| キーワードギャップ分析 | 検索需要 vs 供給 | API + スクレイピング |
| 新興チャンネルの発見 | 急成長中の小規模チャンネル | API + アルゴリズム |
| 未開拓トピックの発見 | 需要はあるが動画が少ない領域 | 検索データ分析 |

---

## 技術スタック

### フロントエンド + バックエンド

```
フレームワーク: Next.js 16 (App Router)
言語: TypeScript
UI: Tailwind CSS + shadcn/ui
グラフ: Recharts
API Routes: Next.js Route Handlers
Linter/Formatter: Biome
Git Hooks: Husky + lint-staged
```

### 認証

```
ライブラリ: NextAuth.js (Auth.js)
プロバイダ: Google OAuth 2.0
セッション: JWT
```

### データストレージ

```
メイン: Google Spreadsheet (Google Sheets API v4)
キャッシュ: ブラウザローカルストレージ + Next.js ISR
```

### 外部API

```
YouTube Data API v3: メインデータソース
Google Sheets API v4: データ保存・取得
Puppeteer/Playwright: サムネイル取得、補完データ
```

### インフラ

```
ホスティング: Vercel
認証/DB: Google Cloud Platform (OAuth + Sheets)
```

### Google連携のメリット

1. **ワンクリック認証**: Googleアカウントでログイン
2. **データのポータビリティ**: スプレッドシートで自由に閲覧・編集可能
3. **無料**: Google Sheets APIは無料枠が十分（500リクエスト/100秒）
4. **バックアップ不要**: Googleドライブに自動保存
5. **共有が簡単**: スプレッドシートを共有するだけ

---

## 参入難易度スコア（独自指標）

```
参入難易度 = f(競合密度, 市場成長率, 上位独占度, 必要投稿頻度)

低スコア = 参入しやすい
高スコア = 参入困難
```

### 計算要素

1. **競合密度**: チャンネル数 / 月間総再生数
2. **市場成長率**: 直近6ヶ月の再生数成長率
3. **上位独占度**: 上位10チャンネルの再生数シェア
4. **必要投稿頻度**: 成功チャンネルの平均投稿頻度

---

## 開発フェーズ

### Phase 1: MVP

- [ ] Next.jsプロジェクトセットアップ
- [ ] Google OAuth認証（NextAuth.js）
- [ ] Google Sheets API連携
- [ ] YouTube Data API連携
- [ ] 基本的なチャンネル検索・分析
- [ ] シンプルなダッシュボードUI

### Phase 2: 分析機能強化

- [ ] ジャンル別市場分析
- [ ] 参入難易度スコアの実装
- [ ] 時系列データの蓄積開始
- [ ] グラフ・可視化の充実

### Phase 3: ニッチ発見

- [ ] キーワード分析機能
- [ ] 急成長チャンネル検出
- [ ] アラート機能（新興市場の通知）

### Phase 4: 高度な分析

- [ ] サムネイル画像解析
- [ ] タイトルのNLP分析
- [ ] 競合比較レポート生成

---

## API制限への対策

YouTube Data API の無料枠: **10,000クォータ/日**

### クォータ消費の目安

| 操作 | コスト |
|------|--------|
| search.list | 100 |
| videos.list | 1 |
| channels.list | 1 |
| playlistItems.list | 1 |

### 対策

1. **キャッシュ**: 同じリクエストは24時間キャッシュ
2. **バッチ処理**: 複数IDをまとめて取得（最大50件）
3. **優先度制御**: 重要なデータを優先的に取得
4. **スクレイピング併用**: API制限を超えそうな場合の補完

---

## スプレッドシート設計（概要）

Googleアカウントでログイン時、ユーザーのGoogleドライブに専用スプレッドシートを自動作成。

### シート構成

```
📊 YouTube市場調査データ（スプレッドシート名）
├── 📋 channels        # チャンネル情報
├── 📋 channel_history # チャンネルの日次推移
├── 📋 videos          # 動画情報
├── 📋 genres          # ジャンル定義
├── 📋 analysis_cache  # 分析結果のキャッシュ
└── 📋 settings        # ユーザー設定
```

### シート: channels

| 列 | 内容 |
|----|------|
| A: youtube_id | チャンネルID |
| B: title | チャンネル名 |
| C: description | 説明 |
| D: subscriber_count | 登録者数 |
| E: video_count | 動画数 |
| F: view_count | 総再生数 |
| G: genre | ジャンル |
| H: added_at | 追加日時 |
| I: updated_at | 更新日時 |

### シート: channel_history

| 列 | 内容 |
|----|------|
| A: youtube_id | チャンネルID |
| B: date | 日付 |
| C: subscriber_count | 登録者数 |
| D: view_count | 総再生数 |
| E: video_count | 動画数 |

### シート: videos

| 列 | 内容 |
|----|------|
| A: youtube_id | 動画ID |
| B: channel_id | チャンネルID |
| C: title | タイトル |
| D: view_count | 再生数 |
| E: like_count | いいね数 |
| F: comment_count | コメント数 |
| G: published_at | 公開日 |
| H: thumbnail_url | サムネイルURL |
| I: fetched_at | 取得日時 |

---

## Google Cloud Platform 設定

### 必要なAPI

1. **YouTube Data API v3** - YouTube情報の取得
2. **Google Sheets API v4** - スプレッドシートの読み書き
3. **Google Drive API v3** - スプレッドシートの作成・管理

### OAuth 2.0 スコープ

```
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

### セットアップ手順

1. Google Cloud Console でプロジェクト作成
2. 上記3つのAPIを有効化
3. OAuth 2.0 クライアントIDを作成（Webアプリケーション）
4. 承認済みリダイレクトURIを設定
5. クライアントID/シークレットを環境変数に設定

---

## 次のアクション

1. このドキュメントのレビュー・修正
2. Google Cloud Platformでプロジェクト作成
3. Next.jsプロジェクト初期セットアップ
4. NextAuth.js + Google認証の実装
5. Google Sheets API連携の実装

---

## 備考

- 「パパ系」は候補の一つだが、データで最適な市場を選ぶ
- システム開発自体がYouTubeコンテンツになる可能性もある
- 将来的にはこのツール自体をSaaSとして提供する可能性も視野に
