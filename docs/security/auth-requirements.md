# 認証・認可要件

## 概要

yt-mkt システムの認証・認可設計要件を定義します。
本システムは **Google OAuth 2.0** を使用し、ユーザーのGoogleアカウントで認証を行い、YouTube Data API および Google Sheets API にアクセスします。

---

## 認証方式

### 採用技術

| 項目 | 技術 | 理由 |
|------|------|------|
| 認証フレームワーク | NextAuth.js (Auth.js) v5 | Next.js App Router 対応、OAuth 2.0 標準サポート |
| プロバイダ | Google OAuth 2.0 | YouTubeデータ取得に必須、ユーザー認証も兼ねる |
| セッション管理 | JWT (JSON Web Token) | サーバーレス環境に適している、Vercel互換 |
| トークン保存 | HttpOnly Cookie | XSS攻撃からの保護 |

---

## OAuth 2.0 フロー

### 認可コードフロー (Authorization Code Flow)

```
1. ユーザーがログインボタンをクリック
   ↓
2. Next.js が Google OAuth 認証エンドポイントにリダイレクト
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=https://yourdomain.com/api/auth/callback/google&
     response_type=code&
     scope=openid%20email%20profile%20...&
     state=RANDOM_STATE&
     code_challenge=PKCE_CHALLENGE&
     code_challenge_method=S256
   ↓
3. ユーザーがGoogleアカウントでログイン、スコープを承認
   ↓
4. Google が認可コード (code) をコールバックURLに返す
   ↓
5. Next.js がコードをアクセストークンと交換 (バックエンド)
   POST https://oauth2.googleapis.com/token
   ↓
6. アクセストークン・リフレッシュトークンを取得
   ↓
7. JWTセッショントークンを生成し、Cookie に保存
   ↓
8. ユーザーはログイン状態でアプリケーションを使用
```

### PKCE (Proof Key for Code Exchange)

- **必須**: OAuth 2.0 の認可コードフローでは PKCE を使用
- **目的**: 認可コードの傍受攻撃を防止
- **実装**: NextAuth.js が自動的に実装
- **検証**: Google Cloud Console で PKCE 有効化を確認

---

## OAuth スコープ

### 必要なスコープ

| スコープ | 用途 | 必須/任意 |
|----------|------|----------|
| `openid` | OpenID Connect 認証 | 必須 |
| `email` | ユーザーのメールアドレス取得 | 必須 |
| `profile` | ユーザーの基本情報 (名前、写真) | 必須 |
| `https://www.googleapis.com/auth/youtube.readonly` | YouTube データの読み取り専用アクセス | 必須 |
| `https://www.googleapis.com/auth/spreadsheets` | スプレッドシートの作成・編集 | 必須 |
| `https://www.googleapis.com/auth/drive.file` | アプリが作成したファイルのみアクセス | 必須 |

### スコープの最小化原則

- ❌ `https://www.googleapis.com/auth/drive` (全ファイルアクセス)
- ✅ `https://www.googleapis.com/auth/drive.file` (自分が作成したファイルのみ)

- ❌ `https://www.googleapis.com/auth/youtube` (YouTube アカウント管理)
- ✅ `https://www.googleapis.com/auth/youtube.readonly` (読み取り専用)

### NextAuth.js 設定例

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline', // リフレッシュトークン取得
          response_type: 'code',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
        },
      },
    }),
  ],
  // ... (後述)
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

## セッション管理

### JWT (JSON Web Token) 方式

**選択理由**:
- Vercel (サーバーレス) に最適
- データベース不要
- スケーラブル

**構成**:
```json
{
  "iss": "https://yourdomain.com",
  "sub": "user_google_id",
  "aud": "yt-mkt",
  "exp": 1234567890,
  "iat": 1234567000,
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "accessToken": "ya29.a0AfB_...",
  "refreshToken": "1//0g...",
  "accessTokenExpires": 1234570600
}
```

### JWT 設定

```typescript
// NextAuth.js 設定
export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
    updateAge: 24 * 60 * 60, // 24時間ごとに更新
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
};
```

### トークンのライフサイクル

| トークン | 有効期限 | 保存場所 | 更新方法 |
|----------|----------|----------|----------|
| JWT セッション | 30日 | HttpOnly Cookie | 24時間ごと自動更新 |
| Google アクセストークン | 1時間 | JWT内 (サーバーサイド) | リフレッシュトークンで更新 |
| Google リフレッシュトークン | 無期限 (取り消しまで) | JWT内 (サーバーサイド) | 初回認証時のみ取得 |

### トークンのリフレッシュ

```typescript
// app/api/auth/[...nextauth]/route.ts
async function refreshAccessToken(token: JWT) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing access token', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions = {
  // ...
  callbacks: {
    async jwt({ token, account, user }) {
      // 初回ログイン時
      if (account && user) {
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at! * 1000,
          user,
        };
      }

      // トークンがまだ有効
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // トークンの有効期限切れ → リフレッシュ
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user as any;
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
};
```

---

## 認証状態の確認

### サーバーコンポーネント

```typescript
// app/dashboard/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/api/auth/signin');
  }

  return <div>Welcome {session.user.name}</div>;
}
```

### API Routes

```typescript
// app/api/youtube/search/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // YouTube API 呼び出し (セッションのアクセストークンを使用)
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?...`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  );

  return NextResponse.json(await response.json());
}
```

### クライアントコンポーネント

```typescript
// app/components/UserProfile.tsx
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

export default function UserProfile() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <button onClick={() => signIn('google')}>Sign in with Google</button>;
  }

  return (
    <div>
      <p>Signed in as {session.user.email}</p>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

---

## 認可 (Authorization)

### リソースベースアクセス制御

**原則**: ユーザーは自分のリソースのみアクセス可能

#### スプレッドシートアクセス

```typescript
// lib/sheets.ts
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getUserSpreadsheet() {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error('Unauthorized');
  }

  // ユーザーのアクセストークンで Google Sheets API クライアントを作成
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // スプレッドシートID取得 (ユーザーのメタデータから)
  const spreadsheetId = await getOrCreateUserSpreadsheet(session.user.email);

  // ✅ ユーザーのトークンで実行 → アクセス権限が自動的にチェックされる
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'channels!A:I',
  });

  return response.data.values;
}
```

**重要**: Google Sheets API をユーザーのアクセストークンで実行することで、Googleが自動的に権限チェックを行います。

#### YouTube データアクセス

```typescript
// lib/youtube.ts
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function searchYouTubeChannels(query: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error('Unauthorized');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // ✅ ユーザーのトークンで実行 → クォータもユーザーに紐づく
  const response = await youtube.search.list({
    part: ['snippet'],
    q: query,
    type: ['channel'],
    maxResults: 10,
  });

  return response.data.items;
}
```

### IDOR (Insecure Direct Object Reference) 対策

**禁止**: URLパラメータのIDを直接使用

```typescript
// ❌ 悪い例
export async function GET(
  request: Request,
  { params }: { params: { spreadsheetId: string } }
) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // 危険: 他ユーザーのスプレッドシートにアクセスできる可能性
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: 'channels!A:I',
  });

  return NextResponse.json(response.data.values);
}
```

**推奨**: セッションからユーザーIDを取得し、関連付けを確認

```typescript
// ✅ 良い例
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ユーザーのアクセストークンで API クライアントを作成
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // ユーザーに関連付けられたスプレッドシートIDを取得
  const spreadsheetId = await getUserSpreadsheetId(session.user.email);

  // ✅ ユーザーのトークンで実行 → 自分のファイルのみアクセス可能
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'channels!A:I',
  });

  return NextResponse.json(response.data.values);
}
```

---

## CSRF (Cross-Site Request Forgery) 対策

### NextAuth.js のデフォルト対策

- ✅ `state` パラメータで OAuth フローを保護 (自動)
- ✅ CSRF トークンの検証 (自動)
- ✅ SameSite Cookie 属性 (Lax)

### 追加対策

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};
```

---

## セッション固定攻撃対策

### NextAuth.js のデフォルト対策

- ✅ ログイン成功時にセッションIDを再生成 (自動)
- ✅ Cookie の `SameSite=Lax` 属性

### 追加対策

```typescript
// ログアウト時にセッションを完全に破棄
import { signOut } from 'next-auth/react';

async function handleLogout() {
  await signOut({ callbackUrl: '/' });
}
```

---

## ブルートフォース攻撃対策

### レート制限の実装

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 15分間に5回まで
  analytics: true,
});

export async function checkLoginRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(
    `login:${identifier}`
  );

  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    throw new Error(`Too many login attempts. Retry after ${retryAfter} seconds.`);
  }

  return { remaining, reset };
}
```

### ログイン試行回数の記録

```typescript
// app/api/auth/[...nextauth]/route.ts
export const authOptions = {
  // ...
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log('Sign in event:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
        timestamp: new Date().toISOString(),
      });
    },
  },
};
```

---

## ログアウト

### サーバーサイドログアウト

```typescript
// app/api/auth/logout/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (session) {
    // ログアウトログの記録
    console.log('User logged out:', {
      userId: session.user.email,
      timestamp: new Date().toISOString(),
    });
  }

  // セッション破棄
  return NextResponse.redirect('/api/auth/signout');
}
```

### クライアントサイドログアウト

```typescript
// app/components/LogoutButton.tsx
'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button
      onClick={() =>
        signOut({
          callbackUrl: '/',
          redirect: true,
        })
      }
    >
      Sign out
    </button>
  );
}
```

---

## 環境変数・シークレット管理

### 必要な環境変数

```bash
# .env.local (開発環境)
# .env.production (本番環境はVercel環境変数で設定)

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# (オプション) YouTube API Key (サーバーサイド専用クォータ)
YOUTUBE_API_KEY=AIzaSyxxxxx

# (オプション) レート制限 (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxX
```

### シークレット管理のベストプラクティス

1. **`.env.local` を `.gitignore` に追加**
   ```gitignore
   .env*.local
   .env.production
   ```

2. **Vercel 環境変数で本番シークレットを管理**
   - Dashboard → Settings → Environment Variables
   - 本番環境 (Production) のみに設定

3. **`NEXT_PUBLIC_` プレフィックスの禁止**
   - OAuth Client Secret, API Key は **絶対に** `NEXT_PUBLIC_` を付けない
   - ブラウザに露出する変数のみ `NEXT_PUBLIC_` を使用

4. **NEXTAUTH_SECRET の生成**
   ```bash
   openssl rand -base64 32
   ```

---

## セキュリティレビューポイント

### コードレビュー時のチェック

- [ ] 全APIエンドポイントで `getServerSession()` を呼び出しているか
- [ ] セッションが `null` の場合に 401 エラーを返しているか
- [ ] Google API 呼び出しでユーザーのアクセストークンを使用しているか
- [ ] スプレッドシートIDをURLパラメータから直接取得していないか
- [ ] 環境変数に `NEXT_PUBLIC_` を誤って使用していないか
- [ ] Cookie に `HttpOnly`, `Secure`, `SameSite` 属性が設定されているか
- [ ] トークンをログに出力していないか

### デプロイ前のチェック

- [ ] Vercel 環境変数に全てのシークレットを設定したか
- [ ] Google Cloud Console で承認済みリダイレクトURIを設定したか
- [ ] OAuth スコープが最小限に制限されているか
- [ ] HTTPS が有効になっているか (Vercel はデフォルトで有効)
- [ ] セキュリティヘッダーが設定されているか

---

## トラブルシューティング

### リフレッシュトークンが取得できない

**原因**: `access_type: 'offline'` が設定されていない

**解決策**:
```typescript
GoogleProvider({
  authorization: {
    params: {
      access_type: 'offline', // 必須
      prompt: 'consent', // 必須 (再同意を促す)
    },
  },
})
```

### "RefreshAccessTokenError" が発生

**原因**: リフレッシュトークンの有効期限切れまたは取り消し

**解決策**:
1. ユーザーに再ログインを促す
2. Google アカウント設定でアプリのアクセス権を確認
3. NextAuth.js の `jwt` コールバックでエラーハンドリング
   ```typescript
   async jwt({ token }) {
     if (token.error === 'RefreshAccessTokenError') {
       // ユーザーに再認証を促す
       return { ...token, error: 'RefreshAccessTokenError' };
     }
     // ...
   }
   ```

### セッションが保持されない

**原因**: Cookie の設定ミス

**解決策**:
1. `SameSite` 属性を確認 (Strict → Lax に変更)
2. ブラウザの Cookie 設定を確認
3. HTTPS 環境で `Secure` 属性を確認

---

## 参考リソース

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
