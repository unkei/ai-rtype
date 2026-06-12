# ai-rtype — R-Type-like Horizontal Shooter

ブラウザで動くR-Typeライク横スクロールシューティング。GitHub Pagesで公開する。

- 公開URL: https://unkei.github.io/ai-rtype/
- 技術スタック: HTML5 Canvas + Vanilla JS(ビルドツール・依存なし)、Web Audio API
- 設計仕様: `docs/GAME_DESIGN.md`
- タスク一覧と進捗: `docs/TASKS.md`

## テスト(必ず実施すること)

```bash
npm test                  # Playwright E2E (Chromium + WebKit)
npm run test:headed       # ブラウザ表示あり(デバッグ用)
```

- **PR作成前に `npm test` を必ず実行し、全テストがパスすることを確認する**
- 新機能・バグ修正には対応するテストを `tests/game.spec.js` に追加する
- `window.__game` が E2E テスト用の参照として公開されている
- テストは Chromium(Chrome相当)と WebKit(Safari相当)の両方で実行される

## 開発ワークフロー(必ず従うこと)

別セッションで作業を継続する場合も、以下のルールに従う:

1. セッション開始時: `git checkout main && git pull` してから `docs/TASKS.md` を読み、最初の未完了タスクグループを特定する。
2. 対応するフィーチャーブランチを作成する: `git checkout -b feature/xxx`(ブランチ名は TASKS.md に記載)。
3. そのグループのタスクをすべて実装する。**`docs/TASKS.md` のチェックボックス更新も同じブランチで行う**(mainへの直接コミット禁止のため、進捗はPR経由でmainに反映する)。
4. **`npm test` を実行し全テストがパスすることを確認する**。
5. コミットし、プッシュし、PRを作成・マージする:
   - `gh pr create --title "feat: <短い説明>" --body ...`
   - `gh pr merge --squash --delete-branch`
6. mainに戻って pull し、全グループ完了までステップ1から繰り返す。
7. PRタイトル規約: `feat: <短い説明>`
8. **mainに直接コミットしない。**

## 検証

- 各マージ後: ローカルサーブ + ブラウザで新機能を確認。
- 全完了後: GitHub Pages URL でゲームが動くことを確認(マージ後デプロイに1〜2分かかる)。

## GitHub Pages

- mainブランチのルートからデプロイ(「Deploy from branch main, /」)。mainへのマージごとに自動再デプロイされる。
- 未設定の場合: `gh api repos/unkei/ai-rtype/pages -X POST -f "source[branch]=main" -f "source[path]=/"`(409が返れば設定済み)。

## コード構成

`game.js` 単一ファイル・ES6クラス構成(file://でも動くようモジュール不使用):
Game / InputManager / Player / EnemyManager / Enemy系 / BulletManager / Background / ParticleSystem / AudioManager / HUD
