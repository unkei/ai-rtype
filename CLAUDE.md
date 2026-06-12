# ai-rtype

R-Type ライクな横スクロールSTG。Vanilla JS + Canvas、ビルド工程なし。

## セッション開始時に必ず読むこと

1. **docs/PLAN.md** — タスク一覧と進捗。⬜/🔄 のタスクが残作業
2. **docs/WORKFLOW.md** — ブランチ/PR運用の規約

## 最重要ルール

- ベースブランチは **`main`**。PR は必ず `--base main`
- 1タスク = 1ブランチ（`feature/<topic>` または `fix/<topic>`）= 1PR → squash マージ
- main へ直接 commit / push しない（必ず PR を経由する）
- 各PRで docs/PLAN.md の該当タスク状態を更新する
- `fable_ver` は過去の開発系列（main と同内容で凍結）。新規作業に使わない

## 動作確認

```bash
for f in js/*.js; do node --check "$f"; done   # 構文チェック
python3 -m http.server 8080                     # ローカル確認（ES modules のため要HTTPサーバ）
```

公開URL: https://unkei.github.io/ai-rtype/ （main から配信）
