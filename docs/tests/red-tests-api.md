# REDテスト仕様: API連携 (YouTube & Google Sheets)

## 概要

YouTube Data API v3とGoogle Sheets API v4の連携機能に対するREDテスト仕様。チャンネル検索、詳細取得、スプレッドシートへのデータ保存・読み込みを検証します。

**重要**: これらはREDテストです。実装前に書かれ、全て失敗することが期待されます。

## テスト対象範囲

```yaml
YouTube Data API:
  - チャンネル検索 (search.list)
  - チャンネル詳細取得 (channels.list)
  - エラーハンドリング (API制限、無効なID、ネットワークエラー)
  - クォータ管理

Google Sheets API:
  - スプレッドシート作成
  - シート追加
  - データ書き込み (append, update)
  - データ読み込み (get range)
  - エラーハンドリング (権限エラー、存在しないシート)

技術スタック:
  - Next.js API Routes
  - YouTube Data API v3
  - Google Sheets API v4
  - MSW (API モック)
```

## テストファイル構成

```
tests/
├── e2e/
│   ├── youtube-api.spec.ts       # E2E: YouTube検索〜表示
│   └── sheets-api.spec.ts        # E2E: スプレッドシート操作
├── integration/
│   ├── youtube-api.test.ts       # 結合: YouTube API呼び出し
│   ├── sheets-api.test.ts        # 結合: Sheets API呼び出し
│   └── api-error-handling.test.ts # 結合: エラーハンドリング
└── unit/
    ├── youtube-api-utils.test.ts # 単体: YouTubeデータ処理
    ├── sheets-api-utils.test.ts  # 単体: Sheetsデータ処理
    └── quota-manager.test.ts     # 単体: クォータ管理
```

## モックデータ定義

### YouTube APIレスポンス

```yaml
# search.list (チャンネル検索)
YouTube_SearchResponse_Success:
  kind: "youtube#searchListResponse"
  items:
    - kind: "youtube#searchResult"
      id:
        kind: "youtube#channel"
        channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
      snippet:
        title: "Google Developers"
        description: "Official Google Developers channel"
        thumbnails:
          default:
            url: "https://yt3.ggpht.com/default.jpg"
        publishedAt: "2007-08-23T00:34:43Z"
    - kind: "youtube#searchResult"
      id:
        channelId: "UCK8sQmJBp8GCxrOtXWBpyEA"
      snippet:
        title: "Google"
        description: "Official Google channel"
        thumbnails:
          default:
            url: "https://yt3.ggpht.com/google.jpg"
        publishedAt: "2005-09-18T21:13:37Z"
  pageInfo:
    totalResults: 2
    resultsPerPage: 2

YouTube_SearchResponse_Empty:
  kind: "youtube#searchListResponse"
  items: []
  pageInfo:
    totalResults: 0
    resultsPerPage: 0

# channels.list (チャンネル詳細)
YouTube_ChannelResponse_Success:
  kind: "youtube#channelListResponse"
  items:
    - kind: "youtube#channel"
      id: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
      snippet:
        title: "Google Developers"
        description: "Official channel..."
        customUrl: "@googledevelopers"
        publishedAt: "2007-08-23T00:34:43Z"
        thumbnails:
          default:
            url: "https://yt3.ggpht.com/default.jpg"
      statistics:
        viewCount: "234567890"
        subscriberCount: "1234567"
        videoCount: "5678"
      contentDetails:
        relatedPlaylists:
          uploads: "UU_x5XG1OV2P6uZZ5FSM9Ttw"

YouTube_ChannelResponse_NotFound:
  kind: "youtube#channelListResponse"
  items: []

# エラーレスポンス
YouTube_ErrorResponse_QuotaExceeded:
  error:
    code: 429
    message: "The request cannot be completed because you have exceeded your quota."
    errors:
      - domain: "youtube.quota"
        reason: "quotaExceeded"

YouTube_ErrorResponse_InvalidApiKey:
  error:
    code: 400
    message: "API key not valid."
    errors:
      - domain: "usageLimits"
        reason: "keyInvalid"
```

### Google Sheets APIレスポンス

```yaml
# spreadsheets.create
Sheets_CreateResponse_Success:
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  properties:
    title: "YouTube市場調査データ"
    locale: "ja_JP"
    timeZone: "Asia/Tokyo"
  sheets:
    - properties:
        sheetId: 0
        title: "channels"
        index: 0
        gridProperties:
          rowCount: 1000
          columnCount: 10

# spreadsheets.values.append
Sheets_AppendResponse_Success:
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  tableRange: "channels!A1:I1"
  updates:
    spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    updatedRange: "channels!A2:I2"
    updatedRows: 1
    updatedColumns: 9
    updatedCells: 9

# spreadsheets.values.get
Sheets_GetResponse_Success:
  range: "channels!A1:I10"
  majorDimension: "ROWS"
  values:
    - ["youtube_id", "title", "description", "subscriber_count", "video_count", "view_count", "genre", "added_at", "updated_at"]
    - ["UC_x5XG1OV2P6uZZ5FSM9Ttw", "Google Developers", "Official...", "1234567", "5678", "234567890", "Tech", "2026-03-01", "2026-03-03"]

Sheets_GetResponse_Empty:
  range: "channels!A1:I1"
  majorDimension: "ROWS"
  values:
    - ["youtube_id", "title", "description", "subscriber_count", "video_count", "view_count", "genre", "added_at", "updated_at"]

# エラーレスポンス
Sheets_ErrorResponse_PermissionDenied:
  error:
    code: 403
    message: "The caller does not have permission"
    status: "PERMISSION_DENIED"

Sheets_ErrorResponse_NotFound:
  error:
    code: 404
    message: "Requested entity was not found."
    status: "NOT_FOUND"
```

---

## E2Eテスト仕様: YouTube API

### ファイル: `tests/e2e/youtube-api.spec.ts`

#### E2E-YT-001: チャンネル検索から詳細表示まで (P0)

```yaml
テスト名:
  should search YouTube channels and display results

前提条件:
  - ユーザーはログイン済み
  - チャンネル検索ページにアクセス
  - MSWでYouTube API をモック

操作:
  1. 検索フォームにキーワード "Google" を入力
  2. "検索" ボタンをクリック
  3. ローディング表示を確認
  4. 検索結果一覧が表示されるまで待機
  5. 最初のチャンネルカードをクリック

期待結果:
  - 検索結果に2件のチャンネルが表示される
  - 各カードにチャンネル名、サムネイル、登録者数が表示される
  - クリック後、チャンネル詳細ページに遷移
  - 詳細ページにチャンネル統計が表示される (登録者数、動画数、総再生数)

失敗条件:
  - API連携未実装のため、検索結果が表示されない
```

#### E2E-YT-002: 検索結果が0件の場合 (P1)

```yaml
テスト名:
  should display empty state when no channels are found

前提条件:
  - MSWで空レスポンスを返すよう設定
  - キーワード: "xyzabc123nonexistent"

操作:
  1. 検索フォームにキーワードを入力
  2. "検索" ボタンをクリック

期待結果:
  - ローディング終了後、空状態メッセージが表示される
  - "検索結果が見つかりませんでした" などのメッセージ
  - エラーメッセージは表示されない

失敗条件:
  - 空状態処理未実装でエラー表示または空白画面
```

#### E2E-YT-003: API制限エラーの表示 (P1)

```yaml
テスト名:
  should display quota exceeded error when API limit is reached

前提条件:
  - MSWで429エラーを返すよう設定

操作:
  1. 検索フォームにキーワード "Google" を入力
  2. "検索" ボタンをクリック

期待結果:
  - エラーメッセージが表示される
  - "YouTube APIの利用制限に達しました。しばらくしてから再度お試しください。"
  - 検索結果は表示されない
  - リトライボタンが表示される (オプション)

失敗条件:
  - エラーハンドリング未実装で汎用エラーまたはクラッシュ
```

---

## E2Eテスト仕様: Google Sheets API

### ファイル: `tests/e2e/sheets-api.spec.ts`

#### E2E-SHEETS-001: 初回ログイン時のスプレッドシート自動作成 (P0)

```yaml
テスト名:
  should create spreadsheet on first login

前提条件:
  - 新規ユーザー (スプレッドシート未作成)
  - MSWでSpreadsheets APIをモック
  - ログイン直後

操作:
  1. ダッシュボードにアクセス
  2. スプレッドシート作成処理の実行を待機
  3. 設定ページまたはダッシュボードでスプレッドシートリンクを確認

期待結果:
  - スプレッドシートが自動作成される
  - スプレッドシートID が保存される (ローカルストレージまたはDB)
  - 初期シート (channels, videos, settings など) が作成される
  - ユーザーに通知メッセージ "スプレッドシートを作成しました"

失敗条件:
  - スプレッドシート作成ロジック未実装
```

#### E2E-SHEETS-002: チャンネルデータの保存 (P0)

```yaml
テスト名:
  should save channel data to spreadsheet

前提条件:
  - スプレッドシートが既に作成済み
  - チャンネル詳細ページにいる
  - チャンネルデータ: "Google Developers" (UC_x5XG1OV2P6uZZ5FSM9Ttw)

操作:
  1. チャンネル詳細ページで "スプレッドシートに保存" ボタンをクリック
  2. ローディング表示を確認
  3. 成功メッセージの表示を待機

期待結果:
  - "保存しました" の成功メッセージが表示される
  - MSWで POST /api/sheets/append リクエストが送信されたことを確認
  - リクエストボディに正しいチャンネルデータが含まれる

失敗条件:
  - 保存ロジック未実装で何も起こらない
```

#### E2E-SHEETS-003: 保存済みチャンネル一覧の表示 (P0)

```yaml
テスト名:
  should display saved channels from spreadsheet

前提条件:
  - スプレッドシートに既にチャンネルデータが保存されている
  - MSWでGET /api/sheets/channels のモックレスポンス設定

操作:
  1. ダッシュボードまたは "保存済みチャンネル" ページにアクセス
  2. データ読み込み完了を待機

期待結果:
  - 保存済みチャンネルが一覧表示される
  - 各チャンネルの名前、登録者数、保存日時が表示される
  - MSWで GET /api/sheets/channels リクエストが送信されたことを確認

失敗条件:
  - データ読み込みロジック未実装で空リスト
```

---

## 結合テスト仕様: YouTube API

### ファイル: `tests/integration/youtube-api.test.ts`

#### INT-YT-001: チャンネル検索API呼び出し (正常系) (P0)

```yaml
テスト名:
  should call YouTube search API and return channel list

前提条件:
  - MSWで /youtube/v3/search エンドポイントをモック
  - レスポンス: YouTube_SearchResponse_Success

操作:
  1. searchChannels("Google") 関数を呼び出し

期待結果:
  - Promise が resolve される
  - 返り値が配列 (length: 2)
  - 各要素に channelId, title, thumbnail, publishedAt が含まれる
  - MSWでリクエストパラメータを検証:
    - q=Google
    - type=channel
    - part=snippet
    - maxResults=10

失敗条件:
  - 関数未実装でエラー
```

#### INT-YT-002: チャンネル詳細取得API呼び出し (正常系) (P0)

```yaml
テスト名:
  should call YouTube channels API and return channel details

前提条件:
  - MSWで /youtube/v3/channels エンドポイントをモック
  - レスポンス: YouTube_ChannelResponse_Success

操作:
  1. getChannelDetails("UC_x5XG1OV2P6uZZ5FSM9Ttw") 関数を呼び出し

期待結果:
  - Promise が resolve される
  - 返り値オブジェクトに以下が含まれる:
    - id: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
    - title: "Google Developers"
    - subscriberCount: 1234567
    - videoCount: 5678
    - viewCount: 234567890
  - MSWでリクエストパラメータを検証:
    - id=UC_x5XG1OV2P6uZZ5FSM9Ttw
    - part=snippet,statistics,contentDetails

失敗条件:
  - 関数未実装でエラー
```

#### INT-YT-003: 複数チャンネル一括取得 (P1)

```yaml
テスト名:
  should fetch multiple channels in single API call

前提条件:
  - チャンネルID配列: ["UC_x5XG1OV2P6uZZ5FSM9Ttw", "UCK8sQmJBp8GCxrOtXWBpyEA"]
  - MSWで一括取得レスポンスをモック

操作:
  1. getChannelDetailsBatch([id1, id2]) 関数を呼び出し

期待結果:
  - 1回のAPI呼び出しで2件取得
  - 返り値が配列 (length: 2)
  - MSWでリクエストパラメータを検証:
    - id=UC_x5XG1OV2P6uZZ5FSM9Ttw,UCK8sQmJBp8GCxrOtXWBpyEA
  - クォータ消費: 1 (search.listより効率的)

失敗条件:
  - バッチ処理未実装で個別呼び出し (2回)
```

#### INT-YT-004: APIエラーハンドリング (429: Quota Exceeded) (P1)

```yaml
テスト名:
  should throw QuotaExceededError when API limit is reached

前提条件:
  - MSWで429エラーをモック

操作:
  1. searchChannels("Google") 関数を呼び出し

期待結果:
  - Promise が reject される
  - エラー型: QuotaExceededError (カスタムエラー)
  - エラーメッセージに "quota" が含まれる
  - エラーオブジェクトに retryAfter プロパティが含まれる (オプション)

失敗条件:
  - 汎用エラーが返されるまたはエラーハンドリングなし
```

#### INT-YT-005: APIエラーハンドリング (404: Not Found) (P1)

```yaml
テスト名:
  should return empty array when channel is not found

前提条件:
  - MSWで空レスポンスをモック
  - チャンネルID: "invalid_channel_id"

操作:
  1. getChannelDetails("invalid_channel_id") 関数を呼び出し

期待結果:
  - Promise が resolve される (エラーではない)
  - 返り値が null または undefined
  - エラーログが記録される (console.warn等)

失敗条件:
  - エラーがthrowされてしまう
```

#### INT-YT-006: ネットワークエラーハンドリング (P1)

```yaml
テスト名:
  should throw NetworkError when request fails

前提条件:
  - MSWでネットワークエラーをモック

操作:
  1. searchChannels("Google") 関数を呼び出し

期待結果:
  - Promise が reject される
  - エラー型: NetworkError
  - エラーメッセージに "network" または "timeout" が含まれる

失敗条件:
  - エラーハンドリング未実装でクラッシュ
```

---

## 結合テスト仕様: Google Sheets API

### ファイル: `tests/integration/sheets-api.test.ts`

#### INT-SHEETS-001: スプレッドシート作成API呼び出し (P0)

```yaml
テスト名:
  should create new spreadsheet with initial sheets

前提条件:
  - MSWで POST /v4/spreadsheets をモック
  - ユーザーアクセストークン: "mock_access_token_valid"

操作:
  1. createSpreadsheet("YouTube市場調査データ") 関数を呼び出し

期待結果:
  - Promise が resolve される
  - 返り値にスプレッドシートID が含まれる
  - MSWでリクエストボディを検証:
    - properties.title = "YouTube市場調査データ"
    - sheets[0].properties.title = "channels"
    - sheets[1].properties.title = "videos"
    - sheets[2].properties.title = "settings"

失敗条件:
  - 関数未実装でエラー
```

#### INT-SHEETS-002: データ追加 (append) API呼び出し (P0)

```yaml
テスト名:
  should append channel data to spreadsheet

前提条件:
  - MSWで POST /v4/spreadsheets/{id}/values/{range}:append をモック
  - スプレッドシートID: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  - シート名: "channels"

操作:
  1. appendChannelData(spreadsheetId, channelData) 関数を呼び出し
  2. channelData:
     - youtube_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
     - title: "Google Developers"
     - subscriber_count: 1234567
     - video_count: 5678
     - view_count: 234567890

期待結果:
  - Promise が resolve される
  - MSWでリクエストボディを検証:
    - range: "channels!A:I"
    - values: [["UC_x5XG1OV2P6uZZ5FSM9Ttw", "Google Developers", ...]]
    - valueInputOption: "RAW"

失敗条件:
  - 関数未実装でエラー
```

#### INT-SHEETS-003: データ取得 (get) API呼び出し (P0)

```yaml
テスト名:
  should fetch channel data from spreadsheet

前提条件:
  - MSWで GET /v4/spreadsheets/{id}/values/{range} をモック
  - レスポンス: Sheets_GetResponse_Success

操作:
  1. getChannels(spreadsheetId) 関数を呼び出し

期待結果:
  - Promise が resolve される
  - 返り値が配列 (length: 1, ヘッダー行を除く)
  - 各要素がオブジェクトに変換されている:
    - youtube_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw"
    - title: "Google Developers"
    - subscriber_count: 1234567 (数値型)
  - MSWでリクエストパラメータを検証:
    - range: "channels!A1:I1000"

失敗条件:
  - 関数未実装でエラー
```

#### INT-SHEETS-004: 空シートからのデータ取得 (P1)

```yaml
テスト名:
  should return empty array when sheet has no data

前提条件:
  - MSWで空レスポンス (ヘッダーのみ) をモック

操作:
  1. getChannels(spreadsheetId) 関数を呼び出し

期待結果:
  - Promise が resolve される
  - 返り値が空配列 []
  - エラーは発生しない

失敗条件:
  - エラーがthrowされる
```

#### INT-SHEETS-005: 権限エラーハンドリング (P1)

```yaml
テスト名:
  should throw PermissionError when access is denied

前提条件:
  - MSWで403エラーをモック

操作:
  1. createSpreadsheet("test") 関数を呼び出し

期待結果:
  - Promise が reject される
  - エラー型: PermissionError
  - エラーメッセージに "permission" が含まれる

失敗条件:
  - 汎用エラーまたはエラーハンドリングなし
```

---

## 単体テスト仕様: YouTube API Utils

### ファイル: `tests/unit/youtube-api-utils.test.ts`

#### UNIT-YT-001: チャンネルID抽出 (正常) (P0)

```yaml
テスト名:
  should extract channel ID from YouTube URL

前提条件:
  - テスト関数: extractChannelId(url)
  - 入力: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"

操作:
  1. extractChannelId(url) を呼び出し

期待結果:
  - "UC_x5XG1OV2P6uZZ5FSM9Ttw" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-YT-002: チャンネルID抽出 (@handle形式) (P1)

```yaml
テスト名:
  should extract channel handle from YouTube URL

前提条件:
  - 入力: "https://www.youtube.com/@googledevelopers"

操作:
  1. extractChannelId(url) を呼び出し

期待結果:
  - "@googledevelopers" が返される
  - または API呼び出しでチャンネルIDに変換される

失敗条件:
  - @handleに非対応
```

#### UNIT-YT-003: チャンネルID抽出 (無効なURL) (P1)

```yaml
テスト名:
  should return null for invalid YouTube URL

前提条件:
  - 入力: "https://example.com/invalid"

操作:
  1. extractChannelId(url) を呼び出し

期待結果:
  - null が返される
  - エラーは発生しない

失敗条件:
  - エラーがthrowされる
```

#### UNIT-YT-004: APIレスポンスの正規化 (P0)

```yaml
テスト名:
  should normalize YouTube API response to internal format

前提条件:
  - テスト関数: normalizeChannelData(apiResponse)
  - 入力: YouTube_ChannelResponse_Success.items[0]

操作:
  1. normalizeChannelData(apiResponse) を呼び出し

期待結果:
  - 返り値が以下の形式:
    {
      id: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      title: "Google Developers",
      description: "Official channel...",
      subscriberCount: 1234567,
      videoCount: 5678,
      viewCount: 234567890,
      publishedAt: "2007-08-23T00:34:43Z",
      thumbnailUrl: "https://yt3.ggpht.com/default.jpg"
    }
  - 数値フィールドがstring → numberに変換されている

失敗条件:
  - 関数未実装
```

#### UNIT-YT-005: 登録者数フォーマット (K表記) (P0)

```yaml
テスト名:
  should format subscriber count to K notation

前提条件:
  - テスト関数: formatSubscriberCount(count)
  - 入力: 1234

操作:
  1. formatSubscriberCount(1234) を呼び出し

期待結果:
  - "1.2K" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-YT-006: 登録者数フォーマット (M表記) (P0)

```yaml
テスト名:
  should format subscriber count to M notation

前提条件:
  - 入力: 1234567

操作:
  1. formatSubscriberCount(1234567) を呼び出し

期待結果:
  - "1.2M" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-YT-007: 登録者数フォーマット (1K未満) (P1)

```yaml
テスト名:
  should return count as-is when less than 1K

前提条件:
  - 入力: 999

操作:
  1. formatSubscriberCount(999) を呼び出し

期待結果:
  - "999" が返される (K表記なし)

失敗条件:
  - 誤って "0.9K" などが返される
```

---

## 単体テスト仕様: Google Sheets API Utils

### ファイル: `tests/unit/sheets-api-utils.test.ts`

#### UNIT-SHEETS-001: オブジェクト → 2D配列変換 (P0)

```yaml
テスト名:
  should convert object to 2D array for Sheets API

前提条件:
  - テスト関数: objectToSheetRow(obj, headers)
  - 入力オブジェクト:
    {
      youtube_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      title: "Google Developers",
      subscriber_count: 1234567
    }
  - ヘッダー: ["youtube_id", "title", "subscriber_count"]

操作:
  1. objectToSheetRow(obj, headers) を呼び出し

期待結果:
  - ["UC_x5XG1OV2P6uZZ5FSM9Ttw", "Google Developers", 1234567] が返される
  - ヘッダーの順序に従って配列化される

失敗条件:
  - 関数未実装
```

#### UNIT-SHEETS-002: 2D配列 → オブジェクト配列変換 (P0)

```yaml
テスト名:
  should convert 2D array from Sheets to object array

前提条件:
  - テスト関数: sheetRowsToObjects(rows)
  - 入力:
    [
      ["youtube_id", "title", "subscriber_count"],
      ["UC_x5XG1OV2P6uZZ5FSM9Ttw", "Google Developers", "1234567"]
    ]

操作:
  1. sheetRowsToObjects(rows) を呼び出し

期待結果:
  - 返り値が配列 (length: 1)
  - 各要素がオブジェクト:
    {
      youtube_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      title: "Google Developers",
      subscriber_count: 1234567 (数値に変換)
    }

失敗条件:
  - 関数未実装
```

#### UNIT-SHEETS-003: 数値文字列の型変換 (P1)

```yaml
テスト名:
  should convert numeric strings to numbers

前提条件:
  - テスト関数: parseSheetValue(value, type)
  - 入力: "1234567", type: "number"

操作:
  1. parseSheetValue("1234567", "number") を呼び出し

期待結果:
  - 1234567 (数値型) が返される

失敗条件:
  - 文字列のまま返される
```

#### UNIT-SHEETS-004: 日付文字列のパース (P1)

```yaml
テスト名:
  should parse date strings to ISO format

前提条件:
  - 入力: "2026-03-03", type: "date"

操作:
  1. parseSheetValue("2026-03-03", "date") を呼び出し

期待結果:
  - "2026-03-03T00:00:00.000Z" または Dateオブジェクト が返される

失敗条件:
  - 文字列のまま返される
```

---

## 単体テスト仕様: クォータ管理

### ファイル: `tests/unit/quota-manager.test.ts`

#### UNIT-QUOTA-001: クォータ消費の計算 (search.list) (P0)

```yaml
テスト名:
  should calculate quota cost for search.list

前提条件:
  - テスト関数: calculateQuotaCost(endpoint, params)
  - 入力: endpoint = "search.list"

操作:
  1. calculateQuotaCost("search.list") を呼び出し

期待結果:
  - 100 が返される (YouTube API公式のコスト)

失敗条件:
  - 関数未実装
```

#### UNIT-QUOTA-002: クォータ消費の計算 (channels.list) (P0)

```yaml
テスト名:
  should calculate quota cost for channels.list

前提条件:
  - 入力: endpoint = "channels.list"

操作:
  1. calculateQuotaCost("channels.list") を呼び出し

期待結果:
  - 1 が返される

失敗条件:
  - 関数未実装
```

#### UNIT-QUOTA-003: 累積クォータの追跡 (P1)

```yaml
テスト名:
  should track cumulative quota usage

前提条件:
  - テストクラス/オブジェクト: QuotaManager
  - 初期クォータ: 0

操作:
  1. quotaManager.addUsage("search.list") を呼び出し
  2. quotaManager.addUsage("channels.list") を呼び出し
  3. quotaManager.getTotalUsage() を呼び出し

期待結果:
  - 101 が返される (100 + 1)

失敗条件:
  - 累積計算ロジック未実装
```

#### UNIT-QUOTA-004: クォータ制限チェック (制限内) (P1)

```yaml
テスト名:
  should allow request when quota is within limit

前提条件:
  - 累積クォータ: 9900
  - デイリー制限: 10000
  - 次のリクエスト: search.list (コスト: 100)

操作:
  1. quotaManager.canMakeRequest("search.list") を呼び出し

期待結果:
  - true が返される

失敗条件:
  - ロジック未実装
```

#### UNIT-QUOTA-005: クォータ制限チェック (制限超過) (P1)

```yaml
テスト名:
  should block request when quota would exceed limit

前提条件:
  - 累積クォータ: 9950
  - 次のリクエスト: search.list (コスト: 100)

操作:
  1. quotaManager.canMakeRequest("search.list") を呼び出し

期待結果:
  - false が返される

失敗条件:
  - 制限チェック未実装でtrueが返される
```

#### UNIT-QUOTA-006: 日次リセット (P2)

```yaml
テスト名:
  should reset quota at midnight Pacific Time

前提条件:
  - 累積クォータ: 5000
  - 現在時刻: 太平洋時間 00:00 (日付変更)

操作:
  1. quotaManager.checkDailyReset() を呼び出し
  2. quotaManager.getTotalUsage() を呼び出し

期待結果:
  - 0 が返される (リセット済み)

失敗条件:
  - リセットロジック未実装
```

---

## MSW (Mock Service Worker) モック定義

### YouTube Data API

```yaml
GET https://www.googleapis.com/youtube/v3/search:
  正常レスポンス (キーワード: "Google"):
    status: 200
    body: YouTube_SearchResponse_Success

  空レスポンス (キーワード: "xyzabc123"):
    status: 200
    body: YouTube_SearchResponse_Empty

  エラーレスポンス (クォータ超過):
    status: 429
    body: YouTube_ErrorResponse_QuotaExceeded

  エラーレスポンス (無効なAPIキー):
    status: 400
    body: YouTube_ErrorResponse_InvalidApiKey

GET https://www.googleapis.com/youtube/v3/channels:
  正常レスポンス (ID: "UC_x5XG1OV2P6uZZ5FSM9Ttw"):
    status: 200
    body: YouTube_ChannelResponse_Success

  空レスポンス (ID: "invalid_id"):
    status: 200
    body: YouTube_ChannelResponse_NotFound
```

### Google Sheets API

```yaml
POST https://sheets.googleapis.com/v4/spreadsheets:
  正常レスポンス:
    status: 200
    body: Sheets_CreateResponse_Success

  エラーレスポンス (権限不足):
    status: 403
    body: Sheets_ErrorResponse_PermissionDenied

POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append:
  正常レスポンス:
    status: 200
    body: Sheets_AppendResponse_Success

GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:
  正常レスポンス (データあり):
    status: 200
    body: Sheets_GetResponse_Success

  正常レスポンス (データなし):
    status: 200
    body: Sheets_GetResponse_Empty

  エラーレスポンス (シートが存在しない):
    status: 404
    body: Sheets_ErrorResponse_NotFound
```

---

## カバレッジ目標

```yaml
E2Eテスト:
  - クリティカルパス: 100% (検索、詳細取得、保存、読み込み)

結合テスト:
  - API呼び出し: 95%
  - エラーハンドリング: 90%

単体テスト:
  - データ変換: 95%
  - フォーマット: 90%
  - クォータ管理: 85%
```

---

## 成功基準

REDテストが成功したと言える条件:

1. 全てのテストファイルが構文エラーなく実行できる
2. 全てのテストが失敗する (API連携未実装のため)
3. 失敗理由が明確 (関数未定義、APIモック未設定など)
4. テスト名を読むだけでAPI連携の仕様が理解できる
5. これらのテストが全て通れば、API連携機能が完成したと判断できる

---

## 次のステップ

1. team-test-exec に引き渡し
2. 優先度P0のテストから実装開始
3. YouTube API連携実装 → INT-YT-001, INT-YT-002が通る
4. Sheets API連携実装 → INT-SHEETS-001, INT-SHEETS-002が通る
5. エラーハンドリング実装 → P1テストが通る
6. 全テストがGREENになるまで実装を繰り返す
