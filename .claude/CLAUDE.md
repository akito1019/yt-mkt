# yt-mkt

YouTube市場調査システム。データで「どの市場で戦うか」を決める。

## Stack

- Next.js 16 (App Router)
- Google OAuth (NextAuth.js)
- Google Sheets (データ保存)
- YouTube Data API v3

## Commands

```bash
pnpm dev          # 開発サーバー
pnpm build        # ビルド
pnpm lint         # リント
```

## Git Flow

```
feature/* → develop → main
```

コミット時は Issue 番号を含める: `fix #1: 説明`

## 検証

```bash
pnpm build && pnpm lint  # PRマージ前に必ず通すこと
```
