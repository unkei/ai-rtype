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
| 13 | 敵バリアント＋メガボス: 新敵3種（Spinner 8方向弾、Carrier 護衛展開、Armored 重装甲→突進）。MegaBoss（3周ごとに登場、3つの弱点破壊で撃破）。ループごとにスター流れ方向をランダム変更 | `feature/enemy-variants` | ✅ 完了 |
| 14 | 中間地形障害物: 画面中央に岩柱・壁ゲート・上下壁キャップが120px/sで右から流れてくる。40秒周期スクリプト（pillar/gate/topWall/bottomWall）。自機は接触即死（無敵時間あり）、自機弾・敵弾は貫通不可。敵は素通り。3D描画は暗いBoxメッシュ+青アディティブグロー縁取り。周回2周目以降でmaze variant（3本柱）解放 | `feature/terrain-obstacles` | ✅ 完了 |
| 15 | Stage2ライティング改善: ENVS[1]（敵艦内部）が暗すぎて地形が見えない。全環境に低角度リムライト（DirectionalLight `_rim`）を追加し輪郭を出す。ENVS[1] は ambInt/fog を緩和 | `fix/stage2-lighting` | ⬜ 未着手 |
| 16 | 本家式 Force + Bit + 壁伝いミサイル: メインオプション（Force）は1基のみ・無敵・接触ダメージ。射出/リコール式でリコール時は接触した側（前/後）にドック。カプセル2-3個目は Bit（自機の上下に固定）。4個目でウォールミサイル（壁・地形表面を這って進む）、5個目で炎ミサイルに強化 | `feature/force-bits-missile` | ⬜ 未着手 |
| 17 | GAME OVER 自動タイトル復帰: GAMEOVER 表示から8秒無操作でタイトル画面へ自動遷移 | `fix/gameover-auto-title` | ⬜ 未着手 |
| 18 | 自機フライイン演出: ゲーム開始時に自機が画面外左からジェット噴射（炎を大きく）しながら定位置へ登場。登場中は操作・射撃・被弾なし | `feature/ship-intro` | ⬜ 未着手 |

状態の凡例: ⬜ 未着手 / 🔄 作業中 / ✅ 完了
**各PRで担当タスクの状態を必ず更新すること。**

## タスク16 詳細仕様（本家 R-TYPE 準拠の Force システム）

本家仕様（調査済み）: Force は1基のみ・不死身。ボタンで前方へ射出、再度押すとリコールし
自機へホーミング帰還、**接触した側（前 or 後ろ）にそのままドッキング**する。
Bit は取得順に自機の上→下へ固定装備され、切り離し不可。

- `js/options.js` 改修:
  - ユニット種別を `kind: 'force' | 'bit'` に分離。Force は最初のカプセルで1基だけ付与
  - Force: `hp` 無限（`absorbBullet()` でダメージなし・敵弾は消す）。敵との接触で
    継続ダメージ（0.15s ごとに 2）。mode は `front`/`back`/`detached`/`recall`
  - 射出: ドック側方向へ滑走（front→右 / back→左、既存 DETACH_SPEED）
  - リコール: 自機へホーミング。接触時 `u.x >= player.x ? 'front' : 'back'` でドック
  - Bit: カプセル2個目=上（`player.y - 46`）、3個目=下（`player.y + 46`）に固定追従。
    前方射撃のみ。従来どおり敵弾を吸収（hp5）し、破壊時はカプセル再ドロップ
  - カプセル4個目: `missileLevel = 1`、5個目: `missileLevel = 2`（炎）。満装備後はドロップ停止
- 壁伝いミサイル（`js/player.js` BulletManager 拡張）:
  - `missileLevel >= 1` の間、自機から 0.9s 間隔で上下交互に発射（kind `'missile'`/`'flame'`）
  - seek フェーズ: 斜め前方（vx 260, vy ±320）へ飛び、上下端ストリップ（y≤48 / y≥H-48）
    または地形セグメント接触で crawl フェーズへ
  - crawl フェーズ: 表面に貼り付き右方向へ 340px/s。地形セグメントに当たったら表面を
    乗り越える（セグメント上を這う）。乗り越え不能なら爆散
  - Lv1: damage 2・命中で消滅。Lv2（炎）: damage 4・pierce 2・大型オレンジ描画
  - `main.js` checkCollisions: kind `'missile'`/`'flame'` は地形での即死対象から除外
- `js/render3d.js`: Force は大型グローリング、Bit は小型（0.6倍）球体、ミサイルは
  コーン+噴射（炎版はオレンジ大型）。HUD（`main.js`）は F / Bit×2 / M1・M2 表示に変更

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
js/terrain.js      … 中間地形障害物（TerrainManager: pillar/gate/wall, タスク12以降）
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
