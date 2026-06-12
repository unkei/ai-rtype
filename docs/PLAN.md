# ai-rtype 開発計画

R-Type ライクな横スクロールシューティングを Vanilla JS + Canvas で実装し、
GitHub Pages に公開する。ビルド工程なし（静的ファイルのみ）。

## ゴール

- 横スクロールSTG: 自機移動・通常ショット・チャージビーム・敵ウェーブ・ボス・スコア
- 入力: キーボード / ゲームパッド / スマホタッチ（バーチャルスティック＋ボタン）の3系統
- 公開: GitHub Pages（配信元は `main` ブランチ）

## タスク一覧（1タスク = 1ブランチ = 1PR）

| # | タスク | ブランチ | 状態 |
|---|--------|----------|------|
| 1 | プロジェクトセットアップ: docs（本計画・ワークフロー）、CLAUDE.md、index.html シェル、.nojekyll | `feature/fable-setup` | ✅ 完了 |
| 2 | コアエンジン: ゲームループ、ステート管理（TITLE/PLAYING/GAMEOVER）、パララックス星空＋地形背景、画面スケーリング | `feature/fable-core` | ✅ 完了 |
| 3 | 入力と自機: InputManager（キーボード/ゲームパッド/タッチ）、自機移動、通常弾、チャージビーム、HUD | `feature/fable-player` | ✅ 完了 |
| 4 | 敵とウェーブ: 敵4種（直進/サイン波/急襲/砲台）、ウェーブスクリプト、衝突判定、爆発パーティクル | `feature/fable-enemies` | ✅ 完了 |
| 5 | ボスとゲームフロー: ボス戦、スコアポップアップ、ハイスコア（localStorage）、ゲームオーバー/リスタート、周回難易度 | `feature/fable-boss` | ✅ 完了 |
| 6 | 仕上げと公開: Web Audio 効果音、タッチUI調整、README、GitHub Pages 配信元切替＋動作確認 | `feature/fable-polish` | ✅ 完了 |
| 7 | 運用切替: main を通常運用ブランチ化（fable_ver を force push で反映済み）、docs のルール更新、Pages 配信元を main に変更 | `chore/main-workflow` | ✅ 完了 |

状態の凡例: ⬜ 未着手 / 🔄 作業中 / ✅ 完了
**各PRで担当タスクの状態を必ず更新すること。**

## アーキテクチャ

```
index.html        … canvas とエントリ <script type="module">
js/main.js        … 起動、ゲームループ、ステート管理、背景描画
js/input.js       … InputManager（3入力系統を統合、エッジ検出）
js/player.js      … 自機、弾、チャージビーム
js/enemies.js     … 敵各種、ウェーブ管理、ボス
js/fx.js          … パーティクル、スコアポップアップ
js/audio.js       … Web Audio による効果音（外部アセットなし）
```

- 論理解像度 960×540。ウィンドウに合わせレターボックスでスケール
- 入力エッジ検出はフレーム先頭の `input.beginFrame()` で確定し、
  フレーム中はどこから読んでも同じ値（タイトル画面の取りこぼしバグ対策）

## 公開

- 配信元: `main` ブランチ / ルート（タスク7で fable_ver から切替済み）
- main へのマージで自動再ビルド・反映
- 公開URL: https://unkei.github.io/ai-rtype/

## 履歴メモ

- タスク1〜6 は `fable_ver` 系列（PR #9〜#14）で実施
- 2026-06-13 に main を fable_ver の内容で置換し、以後 main を通常運用ブランチとする
  （旧 main の最終コミットは `b10a709`、旧 feature ブランチから復元可能）
