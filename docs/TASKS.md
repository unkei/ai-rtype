# タスク一覧

各タスクグループは1つのフィーチャーブランチで実装し、PRでmainにマージする。
ワークフローの詳細は `/CLAUDE.md` を参照。

**上から順に、最初の未完了グループから着手すること。**

## 1. feature/project-setup — プロジェクトセットアップ ✅

- [x] CLAUDE.md(ワークフロールール)作成
- [x] docs/TASKS.md(本ファイル)作成
- [x] docs/GAME_DESIGN.md(設計仕様)作成
- [x] index.html シェル作成(canvas要素、game.js読み込み、モバイル向けviewport/CSS)
- [x] GitHub Pages 有効化(`gh api repos/unkei/ai-rtype/pages -X POST -f "source[branch]=main" -f "source[path]=/"`)
- [x] PR作成・マージ

## 2. feature/core-engine — コアエンジン ✅

- [x] game.js 新規作成: Game クラス(requestAnimationFrame ループ、deltaTime、ステートマシン骨格)
- [x] canvas 初期化(960x540 内部解像度、CSSでレスポンシブスケール)
- [x] Background クラス: 3層パララックス星スクロール
- [x] ParticleSystem スタブ(update/render の空実装)
- [x] AudioManager スタブ
- [x] 動作確認: 星が流れる画面が表示される
- [x] PR作成・マージ

## 3. feature/player — 自機と入力システム ✅

- [x] InputManager クラス: キーボード(矢印/WASD + Z/Space)
- [x] InputManager: Gamepad API 対応(標準マッピング、左スティック+十字キー、Aボタン)
- [x] InputManager: タッチ対応(左側バーチャルスティック + 右側ファイアボタン、HTML overlay)
- [x] Player クラス: 8方向移動、画面内クランプ
- [x] 通常ショット(連射、BulletManager とプーリング)
- [x] チャージショット(押し続けてチャージ→離して太いビーム)
- [x] HUD: チャージメーター表示
- [x] 動作確認: キーボード/ゲームパッド/タッチ(DevToolsエミュレーション)で操作・射撃できる
- [x] PR作成・マージ

## 4. feature/enemies — 敵とウェーブ ✅

- [x] Enemy 基底クラス + Type A(直進)
- [x] Type B(サイン波移動)
- [x] Type C(編隊で出現)
- [x] 敵弾(自機狙い弾)
- [x] EnemyManager: 時間ベースのウェーブスクリプト(ステージ1)
- [x] 衝突判定: 自機弾×敵、敵/敵弾×自機
- [x] 動作確認: 敵が出現し、撃破でき、被弾する
- [x] PR作成・マージ

## 5. feature/gameplay — ゲームフロー ✅

- [x] スコアシステム(敵撃破で加点 + スコアポップアップ浮き上がりテキスト)
- [x] 残機3、被弾で減少・リスポーン(無敵時間付き)
- [x] タイトル画面(Title → Playing)、ハイスコア表示
- [x] ゲームオーバー画面(スコア・ハイスコア・NEW表示 → Title)
- [x] ポーズ(Escまたはゲームパッドスタート)
- [x] ハイスコア(localStorage)
- [x] HUD: スコア・残機・ハイスコア・チャージメーター表示
- [x] 動作確認: タイトル→プレイ→ゲームオーバー→タイトルの一連フロー
- [x] PR作成・マージ

## 6. feature/polish — 仕上げ ✅

- [x] ParticleSystem: 爆発エフェクト(破片パーティクル + 衝撃波リング)
- [x] AudioManager: Web Audio合成によるSE(ショット、チャージ発射、爆発、被弾)
- [x] AudioContext をゲーム開始(ユーザー操作)時に unlock
- [x] README.md 更新(ゲーム説明、操作方法、公開URL)
- [x] GitHub Pages URL での最終動作確認
- [x] PR作成・マージ

---

すべてのグループが完了。新機能追加時は新しいグループをこのファイルに追記してから着手する。
