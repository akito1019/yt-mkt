# REDテスト仕様: 認証 (Google OAuth)

## 概要

Google OAuth 2.0を使用した認証フローのREDテスト仕様。NextAuth.js (Auth.js) を使用し、ユーザーがGoogleアカウントでログイン・ログアウトできることを検証します。

**重要**: これらはREDテストです。実装前に書かれ、全て失敗することが期待されます。

## テスト対象範囲

```yaml
認証フロー:
  - Google OAuthログイン
  - セッション管理
  - ログアウト
  - 保護されたページへのアクセス制御
  - セッション有効期限

技術スタック:
  - NextAuth.js (Auth.js)
  - Google OAuth 2.0
  - JWT セッション
```

## テストファイル構成

```
tests/
├── e2e/
│   └── auth.spec.ts              # E2E: 実際のOAuthフロー (Playwright)
├── integration/
│   ├── auth-session.test.ts      # 結合: セッション管理
│   └── auth-middleware.test.ts   # 結合: アクセス制御
└── unit/
    └── auth-utils.test.ts        # 単体: ユーティリティ関数
```

## モックデータ定義

### テストユーザー

```yaml
TestUser_Valid:
  id: "google_123456789"
  name: "Test User"
  email: "testuser@example.com"
  image: "https://example.com/avatar.jpg"
  provider: "google"
  accessToken: "mock_access_token_valid"
  refreshToken: "mock_refresh_token_valid"
  expiresAt: 1234567890 (未来の日時)

TestUser_Expired:
  id: "google_987654321"
  name: "Expired User"
  email: "expired@example.com"
  image: null
  provider: "google"
  accessToken: "mock_access_token_expired"
  refreshToken: null
  expiresAt: 1000000000 (過去の日時)
```

### NextAuth セッション形式

```typescript
// モックセッション (有効)
{
  user: {
    id: "google_123456789",
    name: "Test User",
    email: "testuser@example.com",
    image: "https://example.com/avatar.jpg"
  },
  accessToken: "mock_access_token_valid",
  expires: "2026-12-31T23:59:59.999Z"
}

// モックセッション (無効)
null
```

---

## E2Eテスト仕様

### ファイル: `tests/e2e/auth.spec.ts`

#### E2E-AUTH-001: Google OAuthログイン成功フロー (P0)

```yaml
テスト名:
  should complete Google OAuth login flow and redirect to dashboard

前提条件:
  - ユーザーは未認証状態
  - Google OAuth認証ページがモック可能 (Playwrightのモック機能使用)
  - 環境変数 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET が設定済み

操作:
  1. ログインページ (/login) にアクセス
  2. "Googleでログイン" ボタンをクリック
  3. (モック) Google認証画面で "許可" をクリック
  4. コールバックURL (/api/auth/callback/google) にリダイレクト

期待結果:
  - ダッシュボード (/dashboard) にリダイレクトされる
  - ナビゲーションバーにユーザー名 "Test User" が表示される
  - ナビゲーションバーにアバター画像が表示される
  - ブラウザのローカルストレージまたはCookieにセッション情報が保存される

失敗条件:
  - 実装前なので必ず失敗 (NextAuth.js未設定)
```

#### E2E-AUTH-002: セッション保持 (ページリロード後もログイン状態維持) (P0)

```yaml
テスト名:
  should persist session after page reload

前提条件:
  - ユーザーは既にログイン済み (E2E-AUTH-001が成功した状態)
  - ダッシュボードページにいる

操作:
  1. ブラウザをリロード (F5 または location.reload())
  2. 2秒待機 (セッション復元の時間)

期待結果:
  - ログイン状態が維持される
  - ダッシュボードページのまま (ログインページにリダイレクトされない)
  - ナビゲーションバーにユーザー名が引き続き表示される
  - セッション情報がローカルストレージ/Cookieから復元される

失敗条件:
  - セッション復元ロジック未実装のため失敗
```

#### E2E-AUTH-003: ログアウト成功フロー (P0)

```yaml
テスト名:
  should logout user and redirect to login page

前提条件:
  - ユーザーは既にログイン済み
  - ダッシュボードページにいる

操作:
  1. ナビゲーションバーの "ログアウト" ボタンをクリック
  2. (確認ダイアログがあれば) "確認" をクリック

期待結果:
  - ログインページ (/login) にリダイレクトされる
  - セッション情報がクリアされる (ローカルストレージ/Cookie削除)
  - 再度ダッシュボードにアクセスしようとするとログインページにリダイレクトされる

失敗条件:
  - ログアウトロジック未実装のため失敗
```

#### E2E-AUTH-004: 未認証ユーザーの保護ページアクセス (P0)

```yaml
テスト名:
  should redirect unauthenticated user to login page when accessing protected page

前提条件:
  - ユーザーは未認証状態
  - セッション情報が存在しない

操作:
  1. ダッシュボードURL (/dashboard) に直接アクセス
  2. チャンネル検索ページ (/channels/search) に直接アクセス

期待結果:
  - 両方のページでログインページ (/login) にリダイレクトされる
  - URLクエリパラメータに元のURL が含まれる (?callbackUrl=/dashboard)
  - リダイレクト先でエラーメッセージは表示されない (サイレントリダイレクト)

失敗条件:
  - ミドルウェア未実装のため保護ページに直接アクセスできてしまう
```

#### E2E-AUTH-005: OAuth失敗時のエラーハンドリング (P1)

```yaml
テスト名:
  should display error message when Google OAuth fails

前提条件:
  - ユーザーは未認証状態
  - Google OAuth認証がエラーを返すようモック設定

操作:
  1. ログインページにアクセス
  2. "Googleでログイン" ボタンをクリック
  3. (モック) Google認証画面で "拒否" をクリックまたはエラー発生

期待結果:
  - ログインページに戻る
  - エラーメッセージが表示される ("ログインに失敗しました。もう一度お試しください。")
  - セッション情報は作成されない

失敗条件:
  - エラーハンドリング未実装のため、エラーメッセージが表示されない
```

---

## 結合テスト仕様

### ファイル: `tests/integration/auth-session.test.ts`

#### INT-AUTH-001: NextAuth セッション取得 (有効なセッション) (P0)

```yaml
テスト名:
  should return valid session when user is authenticated

前提条件:
  - モックセッションプロバイダーで有効なセッションを設定
  - テストユーザー: TestUser_Valid

操作:
  1. getServerSession() を呼び出し
  2. または useSession() フック (クライアントコンポーネント)

期待結果:
  - セッションオブジェクトが返される
  - session.user.email === "testuser@example.com"
  - session.user.name === "Test User"
  - session.accessToken が存在する
  - session.expires が未来の日時

失敗条件:
  - NextAuth.js設定未完了のため、セッションが取得できない
```

#### INT-AUTH-002: NextAuth セッション取得 (セッションなし) (P0)

```yaml
テスト名:
  should return null when user is not authenticated

前提条件:
  - セッションが存在しない状態

操作:
  1. getServerSession() を呼び出し
  2. または useSession() フック

期待結果:
  - null が返される
  - エラーは発生しない

失敗条件:
  - セッション判定ロジック未実装
```

#### INT-AUTH-003: セッション有効期限チェック (P1)

```yaml
テスト名:
  should invalidate session when token is expired

前提条件:
  - モックセッションで期限切れトークンを設定
  - テストユーザー: TestUser_Expired

操作:
  1. getServerSession() を呼び出し
  2. セッション有効期限チェック関数を実行

期待結果:
  - セッションが無効と判定される
  - 自動的にログアウト処理が実行される (またはnull返却)
  - リフレッシュトークンがあれば更新を試みる (Phase 2)

失敗条件:
  - 有効期限チェック未実装のため、期限切れセッションが有効と判定される
```

### ファイル: `tests/integration/auth-middleware.test.ts`

#### INT-AUTH-004: 保護ルートのアクセス制御 (認証済み) (P0)

```yaml
テスト名:
  should allow access to protected route when user is authenticated

前提条件:
  - 有効なセッションが存在
  - ミドルウェアが設定済み

操作:
  1. GET /dashboard リクエスト (モック)
  2. セッション情報をヘッダーまたはCookieに含める

期待結果:
  - HTTPステータス 200 が返される
  - ページコンテンツが返される
  - リダイレクトされない

失敗条件:
  - ミドルウェア未実装のため、アクセス制御が動作しない
```

#### INT-AUTH-005: 保護ルートのアクセス制御 (未認証) (P0)

```yaml
テスト名:
  should redirect to login when unauthenticated user accesses protected route

前提条件:
  - セッションが存在しない

操作:
  1. GET /dashboard リクエスト (モック)
  2. セッション情報なし

期待結果:
  - HTTPステータス 307 (Temporary Redirect) が返される
  - Location ヘッダーに "/login?callbackUrl=/dashboard" が含まれる
  - ページコンテンツは返されない

失敗条件:
  - ミドルウェア未実装のため、未認証でもアクセスできる
```

#### INT-AUTH-006: 公開ルートへのアクセス (P1)

```yaml
テスト名:
  should allow access to public routes without authentication

前提条件:
  - セッションが存在しない
  - 公開ルート: /, /login, /api/health

操作:
  1. GET / リクエスト
  2. GET /login リクエスト
  3. GET /api/health リクエスト

期待結果:
  - 全て HTTPステータス 200 が返される
  - リダイレクトされない
  - 認証チェックがスキップされる

失敗条件:
  - 公開ルート設定が誤っており、認証が要求される
```

---

## 単体テスト仕様

### ファイル: `tests/unit/auth-utils.test.ts`

#### UNIT-AUTH-001: セッション有効性チェック (有効) (P0)

```yaml
テスト名:
  should return true when session is valid

前提条件:
  - テスト関数: isSessionValid(session)
  - 入力: 有効なセッションオブジェクト (expires が未来)

操作:
  1. isSessionValid(validSession) を呼び出し

期待結果:
  - true が返される

失敗条件:
  - 関数未実装のため、undefinedが返される
```

#### UNIT-AUTH-002: セッション有効性チェック (期限切れ) (P0)

```yaml
テスト名:
  should return false when session is expired

前提条件:
  - テスト関数: isSessionValid(session)
  - 入力: 期限切れセッション (expires が過去)

操作:
  1. isSessionValid(expiredSession) を呼び出し

期待結果:
  - false が返される

失敗条件:
  - 関数未実装または期限チェックロジック不備
```

#### UNIT-AUTH-003: セッション有効性チェック (null) (P0)

```yaml
テスト名:
  should return false when session is null

前提条件:
  - テスト関数: isSessionValid(session)
  - 入力: null

操作:
  1. isSessionValid(null) を呼び出し

期待結果:
  - false が返される
  - エラーは発生しない (nullセーフ)

失敘条件:
  - nullチェック未実装でエラーが発生
```

#### UNIT-AUTH-004: ユーザー表示名の取得 (P1)

```yaml
テスト名:
  should return user name when session has name

前提条件:
  - テスト関数: getUserDisplayName(session)
  - 入力: session.user.name = "Test User"

操作:
  1. getUserDisplayName(session) を呼び出し

期待結果:
  - "Test User" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-AUTH-005: ユーザー表示名の取得 (nameがnull → emailを使用) (P1)

```yaml
テスト名:
  should return email when session has no name

前提条件:
  - テスト関数: getUserDisplayName(session)
  - 入力: session.user.name = null, session.user.email = "test@example.com"

操作:
  1. getUserDisplayName(session) を呼び出し

期待結果:
  - "test@example.com" が返される

失敗条件:
  - フォールバックロジック未実装でnullが返される
```

#### UNIT-AUTH-006: ユーザー表示名の取得 (両方null → "ゲスト") (P2)

```yaml
テスト名:
  should return "ゲスト" when session has no name and no email

前提条件:
  - テスト関数: getUserDisplayName(session)
  - 入力: session.user.name = null, session.user.email = null

操作:
  1. getUserDisplayName(session) を呼び出し

期待結果:
  - "ゲスト" が返される

失敗条件:
  - デフォルト値未設定
```

#### UNIT-AUTH-007: アクセストークンの抽出 (P0)

```yaml
テスト名:
  should extract access token from session

前提条件:
  - テスト関数: getAccessToken(session)
  - 入力: session.accessToken = "mock_access_token_valid"

操作:
  1. getAccessToken(session) を呼び出し

期待結果:
  - "mock_access_token_valid" が返される

失敗条件:
  - 関数未実装
```

#### UNIT-AUTH-008: アクセストークンの抽出 (トークンなし) (P1)

```yaml
テスト名:
  should return null when session has no access token

前提条件:
  - テスト関数: getAccessToken(session)
  - 入力: session.accessToken = undefined

操作:
  1. getAccessToken(session) を呼び出し

期待結果:
  - null が返される
  - エラーは発生しない

失敗条件:
  - undefinedチェック未実装でエラー発生
```

---

## エッジケース・エラーハンドリング

### EDGE-AUTH-001: 同時ログイン試行 (P2)

```yaml
テスト名:
  should handle concurrent login attempts gracefully

前提条件:
  - 2つのブラウザタブで同時にログイン試行

操作:
  1. タブ1でログインボタンクリック
  2. 0.1秒後、タブ2でログインボタンクリック
  3. 両方のOAuthフロー完了

期待結果:
  - 両方のタブで正常にログイン完了
  - セッション競合が発生しない
  - 最後のログインがセッションに反映される

失敗条件:
  - 競合制御未実装で片方のセッションが破損
```

### EDGE-AUTH-002: ネットワーク切断中のログアウト (P2)

```yaml
テスト名:
  should logout locally when network is unavailable

前提条件:
  - ユーザーはログイン済み
  - ネットワーク接続がオフライン

操作:
  1. ネットワークをオフラインに設定 (Playwrightのモック)
  2. ログアウトボタンクリック

期待結果:
  - ローカルセッションがクリアされる
  - ログインページにリダイレクトされる
  - サーバー側セッション削除は失敗するが、ユーザーにはエラー表示されない

失敗条件:
  - オフライン時のエラーハンドリング未実装
```

### EDGE-AUTH-003: 異常に長いユーザー名 (P2)

```yaml
テスト名:
  should truncate or handle very long user names

前提条件:
  - テストユーザーのname = "A" * 500 (500文字)

操作:
  1. ログイン成功
  2. ナビゲーションバーにユーザー名表示

期待結果:
  - ユーザー名が適切に省略表示される ("AAAAAAA...")
  - UIレイアウトが崩れない
  - データベース/セッションには完全な名前が保存される

失敗条件:
  - 文字列処理未実装でUIが崩れる
```

---

## MSW (Mock Service Worker) モック定義

### NextAuth APIモック

```yaml
POST /api/auth/signin/google:
  正常レスポンス:
    status: 200
    body: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." }

  エラーレスポンス (設定エラー):
    status: 500
    body: { error: "Configuration error" }

GET /api/auth/callback/google:
  正常レスポンス (認証成功):
    status: 302
    headers: { Location: "/dashboard" }
    cookies: ["next-auth.session-token=..."]

  エラーレスポンス (認証拒否):
    status: 302
    headers: { Location: "/login?error=OAuthCallback" }

POST /api/auth/signout:
  正常レスポンス:
    status: 200
    body: { url: "/login" }
    cookies: ["next-auth.session-token=; Max-Age=0"] (削除)

GET /api/auth/session:
  認証済み:
    status: 200
    body: { user: {...}, expires: "..." }

  未認証:
    status: 200
    body: {}
```

---

## カバレッジ目標

```yaml
E2Eテスト:
  - クリティカルパス: 100% (ログイン、ログアウト、アクセス制御)

結合テスト:
  - セッション管理: 95%
  - ミドルウェア: 95%

単体テスト:
  - ユーティリティ関数: 90%
```

---

## 成功基準

REDテストが成功したと言える条件:

1. 全てのテストファイルが構文エラーなく実行できる
2. 全てのテストが失敗する (REDフェーズなので当然)
3. 失敗理由が明確 (関数未定義、コンポーネント未実装など)
4. テスト名を読むだけで認証フローの仕様が理解できる
5. これらのテストが全て通れば、認証機能が完成したと判断できる

---

## 次のステップ

1. team-test-exec に引き渡し
2. 優先度P0のテストから実装開始
3. NextAuth.js設定 → E2E-AUTH-001が通る
4. ミドルウェア実装 → E2E-AUTH-004が通る
5. 全テストがGREENになるまで実装を繰り返す
