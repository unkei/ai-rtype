# ai-rtype（fable_ver 系列）

R-Type ライクな横スクロールSTG。Vanilla JS + Canvas、ビルド工程なし。

## セッション開始時に必ず読むこと

1. **docs/PLAN.md** — タスク一覧と進捗。⬜/🔄 のタスクが残作業
2. **docs/WORKFLOW.md** — ブランチ/PR運用の規約

## 最重要ルール

- **main ブランチには触れない**（commit / push / checkout / merge 禁止）
- ベースブランチは `fable_ver`。PR は必ず `--base fable_ver`
- 1タスク = 1ブランチ（`feature/fable-<topic>`）= 1PR → squash マージ
- 各PRで docs/PLAN.md の該当タスク状態を更新する

## 動作確認

```bash
for f in js/*.js; do node --check "$f"; done   # 構文チェック
python3 -m http.server 8080                     # ローカル確認（ES modules のため要HTTPサーバ）
```

公開URL: https://unkei.github.io/ai-rtype/ （タスク6完了後は fable_ver から配信）
