# yt-mkt

YouTube市場調査システム。データで「どの市場で戦うか」を決める。

## Git Flow

```
feature/* → develop → main
```

コミット時は Issue 番号を含める: `fix #1: 説明`

## Docs

詳細な計画・調査は `docs/` に集約。実装時に必要に応じて参照する。ファイル名は日本語で記載
必要に応じてフォルダは作成する。

### 会話記録の保存（Compacting前 — 必須）

- Compacting conversation 実行前に `docs/記録/index.md` を読み、手順に従うこと（必須）

## E2E テスト

- **外部 API（AI API、Supabase Edge Function 等）を呼び出す E2E テストは自動実行禁止**
- 実行が必要な場合は、必ず事前にユーザーへ確認を取ること
- テストファイルの作成・修正は確認不要

## 回答スタイル

- 挨拶・前置き・段階報告・絵文字禁止。結論ファースト
- 指摘すべきことは素直に指摘
