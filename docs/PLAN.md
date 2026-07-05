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
| 8 | グラフィック3D化: Three.js（CDN importmap）+ UnrealBloom で全描画を 3D モデル化（Kenney Space Kit の CC0 GLB）。惑星・岩石地形・漂流メテオの背景。HUD/テキストは透明 Canvas オーバーレイ。ロジックは 2D のまま | `feature/three-graphics` | ✅ 完了 |
| 9 | オプションシステム: 敵10体撃破でカプセルドロップ → 取得でオプション付与（最大3個）。オプションは自機後方を追従し前方へ自動射撃。敵弾を防ぐ（HP5消費）。3D描画はグロー球体。HUDにオプション数を表示 | `feature/options` | ✅ 完了 |
| 12 | R-Typeスタイル Force オプション: オプションが自機前方(front)/後方(back)にドック。Vキー/L1/タッチFORCEで最新ユニットをデタッチ（スクリーン端まで滑走・両方向射撃）または全ユニットをリコール。破壊時はカプセル再ドロップ。HUDにF/B/Dラベル表示 | `feature/option-rtype` | ✅ 完了 |
| 10 | 難易度・ステージ拡張: LOOP_T を 26→55秒に延長。新敵種 Homing（追尾飛行）・MineLayer（機雷散布）追加。ボスに第2フェーズ（HP50%以下で攻撃激化）。周回ランク上昇率を強化。より多彩なウェーブスクリプト | `feature/difficulty` | ✅ 完了 |
| 11 | BGM追加: Web Audio APIで合成BGMを実装（ステージ曲・ボス曲）。ボス登場時の警告BGMを強化。外部ファイル対応も設計に組み込む（将来的なCC0音源差し替え用フック）。ゲームオーバー曲も拡張 | `feature/bgm` | ✅ 完了 |

状態の凡例: ⬜ 未着手 / 🔄 作業中 / ✅ 完了
**各PRで担当タスクの状態を必ず更新すること。**

## アーキテクチャ

```
index.html         … WebGL canvas + HUD オーバーレイ canvas、Three.js の importmap
js/main.js         … 起動（モデル読込待ち）、ゲームループ、ステート管理、HUD描画
js/render3d.js     … Three.js ビュー層（GLBモデル、岩石地形、惑星、星空、パーティクル、Bloom）
assets/models/     … Kenney Space Kit の GLB モデル（CC0、ライセンスファイル同梱）
js/input.js        … InputManager（3入力系統を統合、エッジ検出）
js/player.js       … 自機、弾、チャージビーム（ロジックのみ）
js/enemies.js      … 敵各種、ウェーブ管理、ボス（ロジックのみ）
js/options.js      … オプションカプセル・オプションユニット管理（タスク9以降）
js/fx.js           … パーティクル状態、スコアポップアップ
js/audio.js        … Web Audio による効果音・BGM（外部アセットなし）
test-autoplay.html … ヘッドレス動作確認用の自動プレイページ
```

- 論理解像度 960×540。ウィンドウに合わせレターボックスでスケール
- 入力エッジ検出はフレーム先頭の `input.beginFrame()` で確定し、
  フレーム中はどこから読んでも同じ値（タイトル画面の取りこぼしバグ対策）
- **描画は 2.5D 構成**: ゲームロジック・当たり判定は従来どおり 960×540 の 2D 座標系。
  `render3d.js` が毎フレーム、エンティティ→メッシュを同期して z=0 平面に描く
  （エンティティは描画コードを持たない）。Three.js は CDN importmap 経由
  （ビルド工程なしは維持）。テキスト HUD は上に重ねた透明 Canvas 2D

## 公開

- 配信元: `main` ブランチ / ルート（タスク7で fable_ver から切替済み）
- main へのマージで自動再ビルド・反映
- 公開URL: https://unkei.github.io/ai-rtype/

## 履歴メモ

- タスク1〜6 は `fable_ver` 系列（PR #9〜#14）で実施
- 2026-06-13 に main を fable_ver の内容で置換し、以後 main を通常運用ブランチとする
  （旧 main の最終コミットは `b10a709`、旧 feature ブランチから復元可能）
