# REDテスト仕様: UI コンポーネント

## 概要

ダッシュボード、検索フォーム、チャンネルカード、ナビゲーションなど、基本UIコンポーネントに対するREDテスト仕様。React Testing Libraryを使用してユーザー視点でのインタラクションを検証します。

**重要**: これらはREDテストです。実装前に書かれ、全て失敗することが期待されます。

## テスト対象範囲

```yaml
UIコンポーネント:
  - SearchForm: チャンネル検索フォーム
  - ChannelCard: チャンネル情報カード
  - ChannelList: 検索結果一覧
  - Dashboard: ダッシュボードレイアウト
  - Navigation: グローバルナビゲーション
  - ErrorBoundary: エラー表示
  - LoadingSpinner: ローディング表示

技術スタック:
  - React + Next.js (App Router)
  - React Testing Library
  - Vitest
  - MSW (APIモック)
```

## テストファイル構成

```
tests/
├── e2e/
│   └── ui-flows.spec.ts          # E2E: ユーザーフロー全体
├── integration/
│   ├── search-form.test.tsx      # 結合: フォーム送信 + API
│   ├── channel-list.test.tsx     # 結合: リスト表示 + データ
│   └── dashboard.test.tsx        # 結合: ダッシュボード全体
└── unit/
    ├── channel-card.test.tsx     # 単体: カードコンポーネント
    ├── navigation.test.tsx       # 単体: ナビゲーション
    ├── format-utils.test.ts      # 単体: フォーマット関数
    └── validation.test.ts        # 単体: バリデーション
```

## モックデータ定義

### チャンネルデータ

```typescript
// モックチャンネル (正常)
const mockChannel = {
  id: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  title: "Google Developers",
  description: "Official Google Developers YouTube channel",
  subscriberCount: 1234567,
  videoCount: 5678,
  viewCount: 234567890,
  publishedAt: "2007-08-23T00:34:43Z",
  thumbnailUrl: "https://yt3.ggpht.com/ytc/default.jpg",
  customUrl: "@googledevelopers"
};

// モックチャンネル (小規模)
const mockSmallChannel = {
  id: "UCsmallchannel123",
  title: "Small Channel",
  description: "A small YouTube channel",
  subscriberCount: 123,
  videoCount: 10,
  viewCount: 5000,
  publishedAt: "2025-01-01T00:00:00Z",
  thumbnailUrl: "https://yt3.ggpht.com/small.jpg",
  customUrl: null
};

// モックチャンネルリスト
const mockChannelList = [mockChannel, mockSmallChannel];
```

### UI状態

```typescript
// ローディング状態
const loadingState = {
  isLoading: true,
  error: null,
  data: null
};

// 成功状態
const successState = {
  isLoading: false,
  error: null,
  data: mockChannelList
};

// エラー状態
const errorState = {
  isLoading: false,
  error: new Error("Failed to fetch channels"),
  data: null
};

// 空状態
const emptyState = {
  isLoading: false,
  error: null,
  data: []
};
```

---

## E2Eテスト仕様: UIフロー

### ファイル: `tests/e2e/ui-flows.spec.ts`

#### E2E-UI-001: 検索フォームから結果表示までのフロー (P0)

```yaml
テスト名:
  should complete search flow from input to results display

前提条件:
  - ユーザーはログイン済み
  - チャンネル検索ページにいる
  - MSWでYouTube APIをモック

操作:
  1. 検索フォームの入力欄を見つける
  2. "Google" と入力
  3. "検索" ボタンをクリック
  4. ローディングスピナーが表示されることを確認
  5. 検索結果が表示されるまで待機

期待結果:
  - 2件のチャンネルカードが表示される
  - 各カードに以下が表示される:
    - チャンネル名 ("Google Developers", "Small Channel")
    - サムネイル画像
    - 登録者数 ("1.2M", "123")
    - 動画数
  - ローディングスピナーが消える
  - エラーメッセージは表示されない

失敗条件:
  - コンポーネント未実装のため何も表示されない
```

#### E2E-UI-002: ダッシュボードの初回ロード (P0)

```yaml
テスト名:
  should display dashboard with navigation and welcome message

前提条件:
  - ユーザーはログイン済み
  - ダッシュボードページにアクセス

操作:
  1. ページロード完了を待機
  2. ナビゲーションバーを確認
  3. メインコンテンツエリアを確認

期待結果:
  - ナビゲーションバーに以下が表示される:
    - アプリ名 "YouTube市場調査"
    - メニューリンク (ダッシュボード、チャンネル検索、保存済みチャンネル)
    - ユーザー名 "Test User"
    - ログアウトボタン
  - メインコンテンツエリアに:
    - ウェルカムメッセージ "こんにちは、Test User さん"
    - クイックアクションボタン ("チャンネル検索", "保存済みチャンネル")

失敗条件:
  - ダッシュボードコンポーネント未実装
```

#### E2E-UI-003: エラー表示 (API失敗時) (P1)

```yaml
テスト名:
  should display error message when API request fails

前提条件:
  - MSWで500エラーを返すよう設定

操作:
  1. 検索フォームに "Google" を入力
  2. "検索" ボタンをクリック
  3. エラーメッセージ表示を待機

期待結果:
  - エラーメッセージが表示される
  - "エラーが発生しました。もう一度お試しください。"
  - リトライボタンが表示される
  - 検索結果は表示されない

失敗条件:
  - エラーハンドリングUI未実装
```

---

## 結合テスト仕様: SearchForm

### ファイル: `tests/integration/search-form.test.tsx`

#### INT-UI-001: 検索フォーム送信 (正常) (P0)

```yaml
テスト名:
  should call onSearch callback when form is submitted

前提条件:
  - コンポーネント: <SearchForm onSearch={mockOnSearch} />
  - モック関数: mockOnSearch = vi.fn()

操作:
  1. render(<SearchForm onSearch={mockOnSearch} />)
  2. screen.getByLabelText("検索キーワード") で入力欄を取得
  3. userEvent.type(input, "Google") で入力
  4. screen.getByRole("button", { name: "検索" }) でボタンを取得
  5. userEvent.click(button) でクリック

期待結果:
  - mockOnSearch が1回呼ばれる
  - mockOnSearch の引数が { keyword: "Google" }
  - フォームがリセットされない (入力値が残る)

失敗条件:
  - SearchFormコンポーネント未実装
```

#### INT-UI-002: 検索フォームバリデーション (空入力) (P1)

```yaml
テスト名:
  should display validation error when keyword is empty

前提条件:
  - コンポーネント: <SearchForm onSearch={mockOnSearch} />

操作:
  1. render(<SearchForm onSearch={mockOnSearch} />)
  2. 入力欄を空のまま "検索" ボタンをクリック

期待結果:
  - エラーメッセージが表示される: "キーワードを入力してください"
  - mockOnSearch は呼ばれない
  - 入力欄にフォーカスが当たる (aria-invalid="true")

失敗条件:
  - バリデーションロジック未実装
```

#### INT-UI-003: 検索フォームバリデーション (100文字超) (P2)

```yaml
テスト名:
  should display validation error when keyword is too long

前提条件:
  - 入力値: "A".repeat(101) (101文字)

操作:
  1. 101文字を入力
  2. "検索" ボタンをクリック

期待結果:
  - エラーメッセージ: "キーワードは100文字以内で入力してください"
  - mockOnSearch は呼ばれない

失敗条件:
  - 文字数制限未実装
```

#### INT-UI-004: 検索中のローディング状態 (P1)

```yaml
テスト名:
  should disable submit button while searching

前提条件:
  - コンポーネント: <SearchForm onSearch={asyncMockOnSearch} isLoading={true} />

操作:
  1. render(<SearchForm onSearch={asyncMockOnSearch} isLoading={true} />)
  2. "検索" ボタンを取得

期待結果:
  - ボタンがdisabled状態
  - ボタンテキストが "検索中..." に変わる
  - ローディングスピナーがボタン内に表示される

失敗条件:
  - ローディング状態のUI未実装
```

---

## 結合テスト仕様: ChannelList

### ファイル: `tests/integration/channel-list.test.tsx`

#### INT-UI-005: チャンネルリスト表示 (正常) (P0)

```yaml
テスト名:
  should display list of channels

前提条件:
  - コンポーネント: <ChannelList channels={mockChannelList} />

操作:
  1. render(<ChannelList channels={mockChannelList} />)
  2. screen.getAllByRole("article") でカードを取得

期待結果:
  - 2件のチャンネルカードが表示される
  - 各カードに以下が含まれる:
    - チャンネル名 (heading要素)
    - サムネイル画像 (img要素、alt属性あり)
    - 登録者数
    - 動画数
    - "詳細を見る" ボタン

失敗条件:
  - ChannelListコンポーネント未実装
```

#### INT-UI-006: チャンネルリスト表示 (空リスト) (P1)

```yaml
テスト名:
  should display empty state when no channels are provided

前提条件:
  - コンポーネント: <ChannelList channels={[]} />

操作:
  1. render(<ChannelList channels={[]} />)

期待結果:
  - 空状態メッセージが表示される
  - "検索結果が見つかりませんでした"
  - 検索のヒントテキストが表示される (オプション)
  - チャンネルカードは表示されない

失敗条件:
  - 空状態処理未実装で何も表示されない
```

#### INT-UI-007: チャンネルカードクリック (P0)

```yaml
テスト名:
  should call onChannelClick when channel card is clicked

前提条件:
  - コンポーネント: <ChannelList channels={mockChannelList} onChannelClick={mockOnClick} />
  - モック関数: mockOnClick = vi.fn()

操作:
  1. render(...)
  2. 最初のチャンネルカードの "詳細を見る" ボタンをクリック

期待結果:
  - mockOnClick が1回呼ばれる
  - 引数がクリックされたチャンネルオブジェクト (mockChannel)

失敗条件:
  - イベントハンドラー未実装
```

---

## 結合テスト仕様: Dashboard

### ファイル: `tests/integration/dashboard.test.tsx`

#### INT-UI-008: ダッシュボードレイアウト (P0)

```yaml
テスト名:
  should render dashboard layout with navigation and main content

前提条件:
  - コンポーネント: <Dashboard user={mockUser} />
  - モックユーザー: { name: "Test User", email: "test@example.com" }

操作:
  1. render(<Dashboard user={mockUser} />)
  2. ナビゲーション要素を確認
  3. メインコンテンツ要素を確認

期待結果:
  - ナビゲーションバー (role="navigation") が存在
  - メインコンテンツエリア (role="main") が存在
  - ナビゲーション内にユーザー名 "Test User" が表示
  - メインコンテンツ内にウェルカムメッセージが表示

失敗条件:
  - Dashboardコンポーネント未実装
```

#### INT-UI-009: ナビゲーションメニュー (P1)

```yaml
テスト名:
  should display navigation menu with active state

前提条件:
  - 現在のページ: "/dashboard"

操作:
  1. render(<Dashboard />)
  2. ナビゲーションリンクを取得

期待結果:
  - 以下のリンクが存在:
    - "ダッシュボード" (href="/dashboard")
    - "チャンネル検索" (href="/channels/search")
    - "保存済みチャンネル" (href="/channels/saved")
  - "ダッシュボード" リンクが active 状態 (aria-current="page")

失敗条件:
  - ナビゲーション未実装
```

---

## 単体テスト仕様: ChannelCard

### ファイル: `tests/unit/channel-card.test.tsx`

#### UNIT-UI-001: チャンネルカード表示 (基本) (P0)

```yaml
テスト名:
  should display channel information correctly

前提条件:
  - コンポーネント: <ChannelCard channel={mockChannel} />

操作:
  1. render(<ChannelCard channel={mockChannel} />)
  2. 各要素を取得

期待結果:
  - チャンネル名 "Google Developers" が表示 (heading)
  - サムネイル画像が表示 (img, alt="Google Developers")
  - 登録者数 "1.2M" が表示
  - 動画数 "5,678" が表示
  - 総再生数 "234M" が表示

失敗条件:
  - ChannelCardコンポーネント未実装
```

#### UNIT-UI-002: チャンネルカード表示 (説明文の省略) (P1)

```yaml
テスト名:
  should truncate long description

前提条件:
  - チャンネル説明文: "A".repeat(500) (500文字)

操作:
  1. render(<ChannelCard channel={longDescChannel} />)
  2. 説明文要素を取得

期待結果:
  - 説明文が150文字程度で省略される
  - 末尾に "..." が表示される
  - "もっと見る" ボタンが表示される (オプション)

失敗条件:
  - 全文表示されてレイアウトが崩れる
```

#### UNIT-UI-003: チャンネルカード表示 (サムネイルエラー) (P2)

```yaml
テスト名:
  should display fallback image when thumbnail fails to load

前提条件:
  - サムネイルURL: "https://invalid.url/image.jpg" (読み込み失敗)

操作:
  1. render(<ChannelCard channel={noThumbChannel} />)
  2. img要素のonErrorイベントをトリガー

期待結果:
  - フォールバック画像が表示される
  - または、アイコン/プレースホルダーが表示される
  - エラーメッセージは表示されない

失敗条件:
  - broken imageアイコンが表示される
```

#### UNIT-UI-004: チャンネルカード (保存ボタン) (P0)

```yaml
テスト名:
  should call onSave when save button is clicked

前提条件:
  - コンポーネント: <ChannelCard channel={mockChannel} onSave={mockOnSave} />
  - モック関数: mockOnSave = vi.fn()

操作:
  1. render(...)
  2. "保存" ボタンをクリック

期待結果:
  - mockOnSave が1回呼ばれる
  - 引数がチャンネルID ("UC_x5XG1OV2P6uZZ5FSM9Ttw")

失敗条件:
  - 保存ボタン未実装
```

---

## 単体テスト仕様: Navigation

### ファイル: `tests/unit/navigation.test.tsx`

#### UNIT-UI-005: ナビゲーション表示 (ログイン済み) (P0)

```yaml
テスト名:
  should display user information when logged in

前提条件:
  - コンポーネント: <Navigation user={mockUser} />
  - モックユーザー: { name: "Test User", image: "https://example.com/avatar.jpg" }

操作:
  1. render(<Navigation user={mockUser} />)

期待結果:
  - ユーザー名 "Test User" が表示
  - アバター画像が表示 (img, alt="Test User")
  - ログアウトボタンが表示

失敗条件:
  - Navigationコンポーネント未実装
```

#### UNIT-UI-006: ナビゲーション表示 (未ログイン) (P1)

```yaml
テスト名:
  should display login button when not logged in

前提条件:
  - コンポーネント: <Navigation user={null} />

操作:
  1. render(<Navigation user={null} />)

期待結果:
  - ログインボタンが表示される
  - ユーザー名・アバターは表示されない
  - ログアウトボタンは表示されない

失敗条件:
  - ログイン状態の判定未実装
```

#### UNIT-UI-007: ログアウトボタンクリック (P0)

```yaml
テスト名:
  should call onLogout when logout button is clicked

前提条件:
  - コンポーネント: <Navigation user={mockUser} onLogout={mockOnLogout} />
  - モック関数: mockOnLogout = vi.fn()

操作:
  1. render(...)
  2. ログアウトボタンをクリック

期待結果:
  - mockOnLogout が1回呼ばれる
  - 引数なし

失敗条件:
  - イベントハンドラー未実装
```

---

## 単体テスト仕様: フォーマット関数

### ファイル: `tests/unit/format-utils.test.ts`

#### UNIT-FORMAT-001: 数値フォーマット (カンマ区切り) (P0)

```yaml
テスト名:
  should format number with comma separators

前提条件:
  - テスト関数: formatNumber(value)
  - 入力: 1234567

操作:
  1. formatNumber(1234567) を呼び出し

期待結果:
  - "1,234,567" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-FORMAT-002: 日付フォーマット (相対表示) (P1)

```yaml
テスト名:
  should format date to relative time

前提条件:
  - テスト関数: formatRelativeTime(date)
  - 入力: new Date(Date.now() - 86400000) (1日前)

操作:
  1. formatRelativeTime(date) を呼び出し

期待結果:
  - "1日前" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-FORMAT-003: 日付フォーマット (絶対表示) (P1)

```yaml
テスト名:
  should format date to absolute time

前提条件:
  - テスト関数: formatDate(date)
  - 入力: new Date("2026-03-03T12:00:00Z")

操作:
  1. formatDate(date) を呼び出し

期待結果:
  - "2026年3月3日" が返される (日本語ロケール)

失敗条件:
  - 関数未実装
```

#### UNIT-FORMAT-004: URL短縮表示 (P2)

```yaml
テスト名:
  should truncate long URLs

前提条件:
  - テスト関数: truncateUrl(url, maxLength)
  - 入力: "https://www.example.com/very/long/path/to/resource", maxLength: 30

操作:
  1. truncateUrl(url, 30) を呼び出し

期待結果:
  - "https://www.example.com/..." が返される
  - 30文字以内

失敗条件:
  - 関数未実装
```

---

## 単体テスト仕様: バリデーション

### ファイル: `tests/unit/validation.test.ts`

#### UNIT-VALID-001: キーワードバリデーション (正常) (P0)

```yaml
テスト名:
  should validate keyword as valid

前提条件:
  - テスト関数: validateKeyword(keyword)
  - 入力: "Google"

操作:
  1. validateKeyword("Google") を呼び出し

期待結果:
  - { valid: true, error: null } が返される

失敗条件:
  - 関数未実装
```

#### UNIT-VALID-002: キーワードバリデーション (空文字) (P0)

```yaml
テスト名:
  should validate empty keyword as invalid

前提条件:
  - 入力: ""

操作:
  1. validateKeyword("") を呼び出し

期待結果:
  - { valid: false, error: "キーワードを入力してください" } が返される

失敗条件:
  - バリデーション未実装でvalidがtrueになる
```

#### UNIT-VALID-003: キーワードバリデーション (空白のみ) (P1)

```yaml
テスト名:
  should validate whitespace-only keyword as invalid

前提条件:
  - 入力: "   "

操作:
  1. validateKeyword("   ") を呼び出し

期待結果:
  - { valid: false, error: "キーワードを入力してください" } が返される

失敗条件:
  - trim処理未実装でvalidがtrueになる
```

#### UNIT-VALID-004: キーワードバリデーション (100文字超) (P1)

```yaml
テスト名:
  should validate too long keyword as invalid

前提条件:
  - 入力: "A".repeat(101)

操作:
  1. validateKeyword(longKeyword) を呼び出し

期待結果:
  - { valid: false, error: "キーワードは100文字以内で入力してください" } が返される

失敗条件:
  - 文字数制限未実装
```

#### UNIT-VALID-005: チャンネルIDバリデーション (正常) (P0)

```yaml
テスト名:
  should validate channel ID as valid

前提条件:
  - テスト関数: validateChannelId(id)
  - 入力: "UC_x5XG1OV2P6uZZ5FSM9Ttw" (24文字、UC始まり)

操作:
  1. validateChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw") を呼び出し

期待結果:
  - { valid: true, error: null } が返される

失敗条件:
  - 関数未実装
```

#### UNIT-VALID-006: チャンネルIDバリデーション (無効な形式) (P1)

```yaml
テスト名:
  should validate invalid channel ID format

前提条件:
  - 入力: "invalid_id" (UC始まりでない、長さ不足)

操作:
  1. validateChannelId("invalid_id") を呼び出し

期待結果:
  - { valid: false, error: "無効なチャンネルIDです" } が返される

失敗条件:
  - 形式チェック未実装
```

---

## アクセシビリティテスト

### UNIT-A11Y-001: フォームのラベル関連付け (P1)

```yaml
テスト名:
  should associate labels with form inputs

前提条件:
  - コンポーネント: <SearchForm />

操作:
  1. render(<SearchForm />)
  2. screen.getByLabelText("検索キーワード") を呼び出し

期待結果:
  - input要素が取得できる
  - label要素とinput要素が正しく関連付けられている (htmlFor/id)

失敗条件:
  - ラベル関連付け未実装でgetByLabelTextが失敗
```

### UNIT-A11Y-002: ボタンのaria-label (P1)

```yaml
テスト名:
  should provide accessible label for icon buttons

前提条件:
  - コンポーネント: <ChannelCard /> (保存ボタンがアイコンのみ)

操作:
  1. render(<ChannelCard channel={mockChannel} />)
  2. screen.getByRole("button", { name: "保存" }) を呼び出し

期待結果:
  - ボタンが取得できる
  - aria-label または aria-labelledby が設定されている

失敗条件:
  - アクセシブルな名前が提供されていない
```

### UNIT-A11Y-003: キーボード操作 (フォーカス管理) (P2)

```yaml
テスト名:
  should manage focus correctly in modal

前提条件:
  - コンポーネント: <Modal isOpen={true} />

操作:
  1. render(<Modal isOpen={true} />)
  2. Tab キーを押下してフォーカス移動をシミュレート

期待結果:
  - フォーカスがモーダル内に閉じ込められる (フォーカストラップ)
  - Escキーでモーダルが閉じる
  - モーダルが閉じた後、元の要素にフォーカスが戻る

失敗条件:
  - フォーカス管理未実装
```

---

## レスポンシブデザインテスト

### UNIT-RESPONSIVE-001: モバイルビューでのレイアウト (P2)

```yaml
テスト名:
  should display mobile layout on small screens

前提条件:
  - コンポーネント: <ChannelList channels={mockChannelList} />
  - ビューポート: 375px x 667px (モバイル)

操作:
  1. window.matchMedia のモック設定
  2. render(<ChannelList channels={mockChannelList} />)

期待結果:
  - チャンネルカードが縦1列で表示される (grid-cols-1)
  - ナビゲーションメニューがハンバーガーメニューになる

失敗条件:
  - レスポンシブデザイン未実装
```

### UNIT-RESPONSIVE-002: タブレットビューでのレイアウト (P2)

```yaml
テスト名:
  should display tablet layout on medium screens

前提条件:
  - ビューポート: 768px x 1024px (タブレット)

操作:
  1. window.matchMedia のモック設定
  2. render(<ChannelList channels={mockChannelList} />)

期待結果:
  - チャンネルカードが2列で表示される (grid-cols-2)

失敗条件:
  - レスポンシブデザイン未実装
```

---

## エラーバウンダリテスト

### UNIT-ERROR-001: エラーバウンダリ (エラー捕捉) (P1)

```yaml
テスト名:
  should catch and display error when child component throws

前提条件:
  - コンポーネント: <ErrorBoundary><ThrowErrorComponent /></ErrorBoundary>
  - ThrowErrorComponent: throw new Error("Test error")

操作:
  1. render(...)
  2. console.error をモック (React の警告を抑制)

期待結果:
  - エラーメッセージが表示される
  - "エラーが発生しました"
  - リロードボタンまたはホームに戻るボタンが表示される
  - 子コンポーネントはレンダリングされない

失敗条件:
  - ErrorBoundary未実装でエラーが伝播
```

---

## MSW (Mock Service Worker) モック定義

### Next.js API Routes

```yaml
GET /api/youtube/search?q=Google:
  正常レスポンス:
    status: 200
    body: { channels: [mockChannel, mockSmallChannel] }

  エラーレスポンス (500):
    status: 500
    body: { error: "Internal server error" }

GET /api/youtube/channels/[id]:
  正常レスポンス:
    status: 200
    body: { channel: mockChannel }

POST /api/sheets/append:
  正常レスポンス:
    status: 200
    body: { success: true, rowsAdded: 1 }
```

---

## カバレッジ目標

```yaml
E2Eテスト:
  - クリティカルUIフロー: 100%

結合テスト:
  - フォーム送信: 95%
  - リスト表示: 90%
  - ダッシュボード: 85%

単体テスト:
  - コンポーネント表示: 90%
  - イベントハンドラー: 95%
  - フォーマット関数: 95%
  - バリデーション: 100%
```

---

## 成功基準

REDテストが成功したと言える条件:

1. 全てのテストファイルが構文エラーなく実行できる
2. 全てのテストが失敗する (UIコンポーネント未実装のため)
3. 失敗理由が明確 (コンポーネント未定義など)
4. テスト名を読むだけでUI仕様が理解できる
5. これらのテストが全て通れば、UI機能が完成したと判断できる
6. アクセシビリティテストが含まれている

---

## 次のステップ

1. team-test-exec に引き渡し
2. 優先度P0のテストから実装開始
3. コンポーネント実装 → UNIT-UI-001, UNIT-UI-005が通る
4. フォーム実装 → INT-UI-001が通る
5. レイアウト実装 → INT-UI-008が通る
6. 全テストがGREENになるまで実装を繰り返す

---

## 補足: React Testing Library のベストプラクティス

```yaml
クエリ優先順序:
  1. getByRole: セマンティックなアクセシビリティ重視
  2. getByLabelText: フォーム要素
  3. getByPlaceholderText: プレースホルダー
  4. getByText: 表示テキスト
  5. getByTestId: 最終手段 (他の方法がない場合のみ)

ユーザー視点のテスト:
  - 実装の詳細をテストしない (内部state、propsなど)
  - ユーザーが見る・触る要素のみテストする
  - 実際のユーザーインタラクションをシミュレート (userEvent使用)

非同期処理:
  - waitFor, findBy* を使用
  - act() 警告が出たら非同期処理の待機漏れ
```
