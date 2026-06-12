# 開発ワークフロー規約

別セッション（別のClaude/開発者）でも同じ手順で継続できるよう、規約を定める。

## 絶対ルール

1. **main ブランチには触れない。** commit / push / checkout / merge いずれも禁止。
   GitHub Pages の配信元設定の変更は可（ブランチ自体を変更しないため）。
2. **ベースブランチは `fable_ver`。** すべての PR は `--base fable_ver` で作成する。
3. 1タスク = 1ブランチ = 1PR。ブランチ名は `feature/fable-<topic>` または `fix/fable-<topic>`。

## タスクの進め方（繰り返し単位）

```bash
# 1. 最新の fable_ver から分岐
git checkout fable_ver && git pull origin fable_ver
git checkout -b feature/fable-<topic>

# 2. 実装し、docs/PLAN.md の該当タスクの状態を更新（🔄→✅）
# 3. 構文チェック（最低限）
for f in js/*.js; do node --check "$f"; done

# 4. コミット & プッシュ & PR 作成
git add -A && git commit -m "feat: <要約>"
git push -u origin feature/fable-<topic>
gh pr create --base fable_ver --title "<タイトル>" --body "<説明>"

# 5. fable_ver に戻ってから squash マージ（gh が default branch=main を
#    checkout してしまうのを防ぐため、必ず先に fable_ver に戻る）
git checkout fable_ver
gh pr merge <PR番号> --squash --delete-branch
git pull origin fable_ver
```

## セッション再開手順

1. `docs/PLAN.md` を読み、⬜/🔄 のタスクを確認する
2. `git log --oneline fable_ver -10` と `gh pr list --base fable_ver` で進捗を照合
3. 上記「タスクの進め方」に従って次のタスクを実行する
4. 全タスク ✅ になったら、公開URLをブラウザで動作確認して完了

## コーディング規約

- Vanilla JS（ES modules）+ Canvas 2D。ビルド工程・外部依存を導入しない
- 画像・音声アセットは使わない（描画はプリミティブ、音は Web Audio で合成）
- 入力は必ず `js/input.js` の InputManager 経由で読む（直接 addEventListener しない）
