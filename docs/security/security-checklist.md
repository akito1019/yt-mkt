# セキュリティチェックリスト

## 実装時に確認すべきセキュリティ要件

このチェックリストは **OWASP Top 10 2021** に基づき、yt-mkt システムの実装時に必須のセキュリティ対策をまとめたものです。

---

## A01: Broken Access Control (アクセス制御の不備)

### 認証・認可の基本

- [ ] **全APIエンドポイントに認証チェック**
  - `getServerSession(authOptions)` で認証状態を確認
  - 未認証の場合は 401 Unauthorized を返す
  - サーバーコンポーネントとAPI Routesの両方で実施

- [ ] **リソースへのアクセス権限チェック**
  - スプレッドシートIDとユーザーIDの関連性を確認
  - ユーザーのGoogle OAuth トークンでAPIを実行 (ユーザー権限で動作)
  - 他ユーザーのリソースへのアクセスを拒否

- [ ] **IDOR (Insecure Direct Object Reference) 対策**
  ```typescript
  // ❌ 悪い例: URLパラメータのIDをそのまま使用
  const spreadsheetId = req.query.id;
  await sheets.spreadsheets.values.get({ spreadsheetId });

  // ✅ 良い例: セッションから取得したユーザーのIDを使用
  const session = await getServerSession(authOptions);
  const spreadsheetId = await getUserSpreadsheetId(session.user.id);
  await sheets.spreadsheets.values.get({ spreadsheetId });
  ```

- [ ] **CORSの適切な設定**
  - 必要なオリジンのみを許可
  - `Access-Control-Allow-Credentials: true` の場合はワイルドカード禁止
  - Next.js の `next.config.js` で設定

### セッション管理

- [ ] **セッションの有効期限設定**
  - JWT の有効期限: 15分 (短い)
  - リフレッシュトークンの有効期限: 30日
  - NextAuth.js の `session.maxAge` 設定

- [ ] **セッション固定攻撃対策**
  - ログイン成功時にセッションIDを再生成 (NextAuth.jsはデフォルトで対応)
  - セッションCookieに `SameSite=Lax` を設定

---

## A02: Cryptographic Failures (暗号化の失敗)

### HTTPS強制

- [ ] **HTTPS通信の強制**
  - VercelはデフォルトでHTTPS
  - Next.js の `next.config.js` で HTTP → HTTPS リダイレクト
  ```javascript
  // next.config.js
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://yourdomain.com/:path*',
        permanent: true,
      },
    ];
  }
  ```

### 認証情報の保護

- [ ] **パスワードのハッシュ化** (将来的にパスワード認証を追加する場合)
  - bcrypt または argon2 を使用
  - ソルトは自動生成
  - ラウンド数: 最低10

- [ ] **OAuth トークンの安全な保存**
  - アクセストークンはサーバーサイドのみで保持
  - リフレッシュトークンはデータベースに暗号化して保存 (必要であれば)
  - ブラウザには JWT (署名付き) のみ

- [ ] **APIキーとシークレットの管理**
  - 環境変数に保存 (`.env.local`, Vercel環境変数)
  - `.env.local` を `.gitignore` に追加
  - `NEXT_PUBLIC_` プレフィックスは慎重に使用 (ブラウザに露出)
  ```bash
  # ✅ サーバーサイドのみ
  GOOGLE_CLIENT_SECRET=xxxxx
  YOUTUBE_API_KEY=xxxxx
  NEXTAUTH_SECRET=xxxxx

  # ⚠️ ブラウザにも露出 (公開しても問題ない値のみ)
  NEXT_PUBLIC_APP_NAME=yt-mkt
  ```

### データの暗号化

- [ ] **機密データの暗号化** (スプレッドシートに保存する場合)
  - アクセストークンは暗号化 (crypto モジュール使用)
  - ユーザーのメールアドレスはハッシュ化を検討

- [ ] **Cookie の Secure 属性設定**
  ```typescript
  // NextAuth.js 設定
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPSでのみ
        sameSite: 'lax',
        path: '/',
      },
    },
  }
  ```

---

## A03: Injection (インジェクション)

### SQL インジェクション

- [ ] **該当なし** (データベース未使用)
  - Google Sheets APIを使用するため、SQLインジェクションは発生しない
  - ただし、将来的にデータベース導入時は対策が必要

### NoSQL インジェクション

- [ ] **該当なし** (NoSQLデータベース未使用)

### スプレッドシート インジェクション (数式インジェクション)

- [ ] **ユーザー入力をスプレッドシートに書き込む際のサニタイズ**
  ```typescript
  function sanitizeForSheets(input: string): string {
    // '=', '+', '-', '@' で始まる文字列はシングルクォートで無効化
    if (/^[=+\-@]/.test(input)) {
      return `'${input}`;
    }
    return input;
  }

  // 使用例
  const values = [[sanitizeForSheets(userInput)]];
  await sheets.spreadsheets.values.update({ range, values });
  ```

### XSS (Cross-Site Scripting)

- [ ] **React の自動エスケープを活用**
  - JSX内の `{}` は自動的にエスケープされる
  - `dangerouslySetInnerHTML` は使用禁止 (必要な場合はDOMPurifyでサニタイズ)

- [ ] **Content Security Policy (CSP) の設定**
  ```typescript
  // next.config.js
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://i.ytimg.com https://yt3.ggpht.com",
              "connect-src 'self' https://www.googleapis.com https://sheets.googleapis.com",
              "frame-src https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ];
  }
  ```

- [ ] **ユーザー入力のサニタイズ**
  - スプレッドシートから読み取ったデータも信頼しない
  - HTML表示前にエスケープ (React が自動実行)
  ```typescript
  // ✅ 安全: React が自動エスケープ
  <div>{userInput}</div>

  // ❌ 危険: エスケープなし
  <div dangerouslySetInnerHTML={{ __html: userInput }} />

  // ✅ 必要な場合はサニタイズ
  import DOMPurify from 'isomorphic-dompurify';
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
  ```

### コマンドインジェクション

- [ ] **該当なし** (Puppeteer/Playwright 使用時は注意)
  - URLパラメータを直接 `page.goto(url)` に渡さない
  - ホワイトリスト検証
  ```typescript
  // ✅ 良い例: URLバリデーション
  function isValidYouTubeUrl(url: string): boolean {
    const allowedHosts = ['www.youtube.com', 'youtube.com', 'i.ytimg.com'];
    const parsedUrl = new URL(url);
    return allowedHosts.includes(parsedUrl.hostname);
  }

  if (isValidYouTubeUrl(thumbnailUrl)) {
    await page.goto(thumbnailUrl);
  }
  ```

---

## A04: Insecure Design (安全でない設計)

### ビジネスロジックの検証

- [ ] **レート制限の実装**
  - ユーザーごとのAPI呼び出し制限: 10リクエスト/分
  - IPベースの制限: 100リクエスト/時間
  - next-rate-limit または upstash/ratelimit 使用
  ```typescript
  import { Ratelimit } from '@upstash/ratelimit';
  import { Redis } from '@upstash/redis';

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
  });

  export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const { success } = await ratelimit.limit(session.user.id);

    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    // ...
  }
  ```

- [ ] **YouTube API クォータの保護**
  - キャッシュの積極的な利用 (Redis または Next.js キャッシュ)
  - バッチ処理 (最大50件まとめて取得)
  - クォータ消費量のトラッキング
  ```typescript
  // キャッシュ例
  import { unstable_cache } from 'next/cache';

  const getChannelInfo = unstable_cache(
    async (channelId: string) => {
      // YouTube API 呼び出し
      return await youtube.channels.list({ id: channelId });
    },
    ['channel-info'],
    { revalidate: 86400 } // 24時間キャッシュ
  );
  ```

### 入力バリデーション

- [ ] **全ての入力をバリデーション**
  - スキーマバリデーション: Zod または Yup 使用
  - ホワイトリスト方式で検証
  ```typescript
  import { z } from 'zod';

  const ChannelSearchSchema = z.object({
    query: z.string().min(1).max(100),
    maxResults: z.number().int().min(1).max(50).default(10),
  });

  export async function POST(req: Request) {
    const body = await req.json();
    const validated = ChannelSearchSchema.parse(body); // throws on invalid
    // ...
  }
  ```

- [ ] **リクエストサイズの制限**
  - Next.js の `bodySizeLimit` 設定
  - 大きなファイルアップロードは禁止 (現時点では不要)

### 安全なデフォルト設定

- [ ] **最小権限の原則**
  - OAuth スコープは必要最低限のみ
  ```typescript
  // NextAuth.js
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file', // 自分が作成したファイルのみ
          ].join(' '),
        },
      },
    }),
  ]
  ```

---

## A05: Security Misconfiguration (セキュリティ設定ミス)

### 環境設定

- [ ] **本番環境のデバッグモード無効化**
  ```bash
  # .env.production
  NODE_ENV=production
  NEXT_PUBLIC_DEBUG=false
  ```

- [ ] **不要な機能の無効化**
  - Next.js の開発者ツールを本番で無効化
  - Source map は本番環境にデプロイしない
  ```javascript
  // next.config.js
  productionBrowserSourceMaps: false,
  ```

- [ ] **デフォルト認証情報の削除**
  - 該当なし (カスタム認証情報のみ使用)

### セキュリティヘッダー

- [ ] **必須セキュリティヘッダーの設定**
  ```typescript
  // next.config.js
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  }
  ```

### エラー処理

- [ ] **本番環境のエラーメッセージを一般化**
  ```typescript
  // app/api/error-handler.ts
  export function handleApiError(error: unknown) {
    console.error('API Error:', error); // サーバーログに詳細を記録

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    // 本番環境では一般的なメッセージのみ
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
  ```

### 依存関係の管理

- [ ] **依存パッケージの脆弱性スキャン**
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **定期的な依存関係の更新**
  - Dependabot または Renovate の設定
  - 週次での脆弱性チェック

---

## A06: Vulnerable and Outdated Components (脆弱性のあるコンポーネント)

- [ ] **パッケージの最新バージョン使用**
  - Next.js, React, NextAuth.js を最新のLTSバージョンに
  - `npm outdated` で確認

- [ ] **使用していないパッケージの削除**
  ```bash
  npx depcheck
  ```

- [ ] **信頼できるソースからのみインストール**
  - npm公式レジストリのみ使用
  - `package-lock.json` をコミット

---

## A07: Identification and Authentication Failures (認証の失敗)

### ブルートフォース対策

- [ ] **ログイン試行回数の制限**
  - 同一IPから 5回失敗で 15分ロック
  - レート制限ライブラリ使用
  ```typescript
  const loginRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
  });
  ```

### セッション管理

- [ ] **セッションの適切なライフサイクル**
  - ログアウト時にセッションを破棄
  - 非アクティブ時の自動ログアウト (30分)
  - NextAuth.js の `signOut()` を使用

- [ ] **多要素認証 (MFA) の推奨**
  - Googleアカウント側でMFAを有効化するようユーザーに案内
  - 将来的にアプリ内MFAの実装を検討

### パスワードポリシー

- [ ] **該当なし** (パスワード認証未使用)
  - OAuth 2.0 のみ使用

---

## A08: Software and Data Integrity Failures (ソフトウェアとデータの整合性)

### サプライチェーン攻撃対策

- [ ] **依存関係の整合性チェック**
  - `package-lock.json` の使用
  - `npm ci` でのインストール (本番環境)
  ```bash
  # CI/CD
  npm ci --only=production
  ```

- [ ] **CDNからのリソース読み込み時の SRI (Subresource Integrity)**
  - 外部スクリプト読み込み時に `integrity` 属性を使用
  ```html
  <script
    src="https://cdn.example.com/script.js"
    integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux..."
    crossorigin="anonymous"
  ></script>
  ```

### デジタル署名

- [ ] **JWT の署名検証**
  - NextAuth.js が自動的に実施
  - `NEXTAUTH_SECRET` の安全な管理
  ```bash
  # .env.local
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  ```

### データ整合性

- [ ] **スプレッドシートデータの検証**
  - 読み取ったデータの型チェック
  - 不正なデータは無視またはエラー
  ```typescript
  const ChannelDataSchema = z.object({
    youtube_id: z.string().regex(/^UC[a-zA-Z0-9_-]{22}$/),
    subscriber_count: z.number().int().nonnegative(),
    // ...
  });

  const rawData = await sheets.spreadsheets.values.get({ range: 'channels' });
  const validatedData = rawData.values
    .map(row => ChannelDataSchema.safeParse(row))
    .filter(result => result.success)
    .map(result => result.data);
  ```

---

## A09: Security Logging and Monitoring Failures (ログと監視の失敗)

### ログ記録

- [ ] **セキュリティイベントのログ**
  - ログイン成功/失敗
  - 権限エラー (403, 401)
  - API クォータ超過
  - 異常なリクエストパターン
  ```typescript
  // lib/logger.ts
  export function logSecurityEvent(event: {
    type: 'login' | 'auth_error' | 'quota_exceeded';
    userId?: string;
    ip?: string;
    details?: Record<string, unknown>;
  }) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'security',
      ...event,
    }));
  }
  ```

- [ ] **ログインジェクション対策**
  - ユーザー入力をログに記録する際はサニタイズ
  ```typescript
  function sanitizeLogInput(input: string): string {
    return input.replace(/[\n\r]/g, ''); // 改行を削除
  }

  console.log(`User search: ${sanitizeLogInput(userQuery)}`);
  ```

- [ ] **機密情報のログ出力禁止**
  - アクセストークン、APIキー、パスワードをログに含めない
  - ログ出力前のマスキング処理
  ```typescript
  function maskToken(token: string): string {
    return token.slice(0, 10) + '***';
  }

  console.log(`Token used: ${maskToken(accessToken)}`);
  ```

### 監視

- [ ] **アラート設定**
  - Vercel の Log Drains 設定
  - 外部ログサービス (Datadog, Sentry) の統合
  - エラー率が閾値を超えたら通知

- [ ] **異常検知**
  - 急激なAPI使用量の増加
  - 同一IPからの大量リクエスト
  - 連続した認証エラー

---

## A10: Server-Side Request Forgery (SSRF)

### URL検証

- [ ] **ユーザー提供のURLの検証**
  - Puppeteer/Playwright でのURL取得時
  - ホワイトリスト検証
  ```typescript
  function isAllowedUrl(url: string): boolean {
    const allowedDomains = [
      'www.youtube.com',
      'youtube.com',
      'i.ytimg.com',
      'yt3.ggpht.com',
    ];

    try {
      const parsedUrl = new URL(url);
      return allowedDomains.includes(parsedUrl.hostname);
    } catch {
      return false;
    }
  }

  // 使用例
  if (!isAllowedUrl(thumbnailUrl)) {
    throw new Error('Invalid URL');
  }
  await page.goto(thumbnailUrl);
  ```

- [ ] **プライベートIPアドレスへのアクセス禁止**
  ```typescript
  function isPrivateIp(hostname: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/,
    ];

    return privateRanges.some(regex => regex.test(hostname));
  }
  ```

---

## 追加のセキュリティ対策

### Google API 固有の対策

- [ ] **OAuth スコープの最小化**
  - `drive.file` (自分が作成したファイルのみアクセス)
  - `youtube.readonly` (読み取り専用)
  - `spreadsheets` (必要な場合のみ)

- [ ] **トークンのリフレッシュ戦略**
  - アクセストークンの有効期限: 1時間 (Googleデフォルト)
  - リフレッシュトークンで自動更新
  - NextAuth.js の `jwt` コールバックで実装

- [ ] **Webhook署名検証** (将来的に実装する場合)
  - Google Pub/Sub からの通知の検証
  - HMAC署名の検証

### フロントエンド固有の対策

- [ ] **クリックジャッキング対策**
  - `X-Frame-Options: DENY` ヘッダー
  - CSP の `frame-ancestors 'none'` 設定

- [ ] **リファラーポリシー**
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - 外部サイトに機密情報を送信しない

---

## チェックリスト使用方法

### 実装フェーズ

1. **設計レビュー**: 脅威モデルを確認
2. **実装前**: 該当する対策をチェックリストで確認
3. **実装中**: コードレビュー時にチェックリストを使用
4. **実装後**: セキュリティテストで検証

### 定期レビュー

- **月次**: 依存関係の脆弱性スキャン
- **四半期**: セキュリティチェックリストの全項目再確認
- **年次**: 脅威モデルの更新

---

## 参考リソース

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Google OAuth 2.0 Best Practices](https://developers.google.com/identity/protocols/oauth2/best-practices)
