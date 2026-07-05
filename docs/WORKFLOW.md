# 開発ワークフロー規約

別セッション（別のClaude/開発者）でも同じ手順で継続できるよう、規約を定める。

## 絶対ルール

1. **ベースブランチは `main`。** すべての PR は `--base main` で作成する。
2. **main へ直接 commit / push しない。** 変更は必ず PR を経由して squash マージする。
3. 1タスク = 1ブランチ = 1PR。ブランチ名は `feature/<topic>` または `fix/<topic>`。
4. `fable_ver` は過去の開発系列（main と同内容で凍結）。新規作業に使わない。

## タスクの進め方（繰り返し単位）

```bash
# 1. 最新の main から分岐
git checkout main && git pull origin main
git checkout -b feature/<topic>

# 2. 実装し、docs/PLAN.md の該当タスクの状態を更新（🔄→✅）
# 3. 構文チェック（最低限）
for f in js/*.js; do node --check "$f"; done

# 4. コミット & プッシュ & PR 作成
git add -A && git commit -m "feat: <要約>"
git push -u origin feature/<topic>
gh pr create --base main --title "<タイトル>" --body "<説明>"

# 5. main に戻ってから squash マージ
git checkout main
gh pr merge <PR番号> --squash --delete-branch
git pull origin main
```

## セッション再開手順

1. `docs/PLAN.md` を読み、⬜/🔄 のタスクを確認する
2. `git log --oneline main -10` と `gh pr list --base main` で進捗を照合
3. 上記「タスクの進め方」に従って次のタスクを実行する
4. タスク完了ごとに、公開URL（https://unkei.github.io/ai-rtype/）で動作確認する

## 公開（GitHub Pages）

- 配信元: **main ブランチ** / ルート（legacy build、`.nojekyll` あり）
- main へのマージで自動的に再ビルド・反映される（数分かかることがある）

## コーディング規約

- Vanilla JS（ES modules）。ビルド工程を導入しない。外部ライブラリは Three.js のみ
  （CDN importmap 経由。npm / bundler は使わない）
- 描画はゲームロジックと分離: ロジックは 2D 座標系（960×540）、描画は `js/render3d.js`
  （Three.js WebGL）、テキスト HUD は透明 Canvas 2D オーバーレイ
- 3Dモデルは `assets/models/` の CC0 GLB（Kenney Space Kit）を使う。新規アセットは
  CC0 ライセンスのもののみ追加可（ライセンスファイルを同ディレクトリに置く）
- 音声アセットは使わない（Web Audio で合成）
- 入力は必ず `js/input.js` の InputManager 経由で読む（直接 addEventListener しない）
