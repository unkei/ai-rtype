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

## 3. feature/player — 自機と入力システム

- [ ] InputManager クラス: キーボード(矢印/WASD + Z/Space)
- [ ] InputManager: Gamepad API 対応(標準マッピング、左スティック+十字キー、Aボタン)
- [ ] InputManager: タッチ対応(左側バーチャルスティック + 右側ファイアボタン、HTML overlay)
- [ ] Player クラス: 8方向移動、画面内クランプ
- [ ] 通常ショット(連射、BulletManager とプーリング)
- [ ] チャージショット(押し続けてチャージ→離して太いビーム)
- [ ] HUD: チャージメーター表示
- [ ] 動作確認: キーボード/ゲームパッド/タッチ(DevToolsエミュレーション)で操作・射撃できる
- [ ] PR作成・マージ

## 4. feature/enemies — 敵とウェーブ

- [ ] Enemy 基底クラス + Type A(直進)
- [ ] Type B(サイン波移動)
- [ ] Type C(編隊で出現)
- [ ] 敵弾(自機狙い弾)
- [ ] EnemyManager: 時間ベースのウェーブスクリプト(ステージ1)
- [ ] 衝突判定: 自機弾×敵、敵/敵弾×自機
- [ ] 動作確認: 敵が出現し、撃破でき、被弾する
- [ ] PR作成・マージ

## 5. feature/gameplay — ゲームフロー

- [ ] スコアシステム(敵撃破で加点)
- [ ] 残機3、被弾で減少・リスポーン(無敵時間付き)
- [ ] タイトル画面(Title → Playing)
- [ ] ゲームオーバー画面(→ Title)
- [ ] ポーズ(Escまたはゲームパッドスタート)
- [ ] ハイスコア(localStorage)
- [ ] HUD: スコア・残機・ハイスコア表示
- [ ] 動作確認: タイトル→プレイ→ゲームオーバー→タイトルの一連フロー
- [ ] PR作成・マージ

## 6. feature/polish — 仕上げ

- [ ] ParticleSystem: 爆発エフェクト(敵撃破・自機被弾)
- [ ] AudioManager: Web Audio合成によるSE(ショット、チャージ、爆発、被弾)
- [ ] ビジュアル調整(自機・敵のデザイン、ビームのグロー等)
- [ ] README.md 更新(ゲーム説明、操作方法、公開URL)
- [ ] GitHub Pages URL での最終動作確認
- [ ] PR作成・マージ

---

すべてのグループが完了したらプロジェクト完了。新機能追加時は新しいグループをこのファイルに追記してから着手する。
