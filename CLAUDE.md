# ai-rtype

R-Type ライクな横スクロールSTG。Vanilla JS + Three.js（CDN importmap）、ビルド工程なし。
ロジックは 2D（960×540）、描画は js/render3d.js の WebGL + Bloom、HUD は透明 Canvas オーバーレイ。

## セッション開始時に必ず読むこと

1. **docs/PLAN.md** — タスク一覧と進捗。⬜/🔄 のタスクが残作業
2. **docs/WORKFLOW.md** — ブランチ/PR運用の規約

## 最重要ルール

- ベースブランチは **`main`**。PR は必ず `--base main`
- 1タスク = 1ブランチ（`feature/<topic>` または `fix/<topic>`）= 1PR → squash マージ
- main へ直接 commit / push しない（必ず PR を経由する）
- 各PRで docs/PLAN.md の該当タスク状態を更新する
- `fable_ver` は過去の開発系列（main と同内容で凍結）。新規作業に使わない

## エージェントワークフロー（タスク実行手順）

タスクを受け取ったら以下の順序で進める：

1. **ブランチ作成** — `feature/<topic>` または `fix/<topic>`
2. **プラン** — **Fable5 エージェント**（`model: "fable"`）でプランニング。変数名・関数名・ファイル名・挿入行まで具体的に設計し、`docs/PLAN.md` に記述する
3. **実装** — **Sonnet エージェント**（`model: "sonnet"`, `isolation: "worktree"`）を機能ごとに並列 spawn して実装。各エージェントへのプロンプトはブランチ名・変更ファイル・詳細仕様を含む自己完結形式にする
4. **テスト** — 各ステップで構文チェック・動作確認を行い、ステップ単位でコミット
5. **Push & PR 作成** — `--base main` で PR を作成
6. **レビュー** — **Fable5 エージェント**でコードレビュー（`/code-review ultra` または Agent `model: "fable"`）
7. **マージ** — レビュー承認後にマージ

> **原則**: Fable5 がプラン・レビューでコントロールし、Sonnet が高速実装する役割分担。プランを省略して直接実装しない。

## 動作確認

```bash
for f in js/*.js; do node --check "$f"; done   # 構文チェック
python3 -m http.server 8080                     # ローカル確認（ES modules のため要HTTPサーバ）
# ヘッドレス確認: test-autoplay.html を Chrome --headless=new --virtual-time-budget で撮影（README 参照）
```

公開URL: https://unkei.github.io/ai-rtype/ （main から配信）
