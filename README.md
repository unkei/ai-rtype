# AI R-TYPE — Fable Edition

R-Type ライクな横スクロールシューティング。Vanilla JS + Canvas 2D、ビルド工程なし・外部アセットなし（音は Web Audio で合成）。

**▶ プレイ: https://unkei.github.io/ai-rtype/**

## 遊び方

| 操作 | キーボード | ゲームパッド | タッチ |
|------|-----------|--------------|--------|
| 移動 | 矢印キー / WASD | 左スティック / 十字キー | 画面左半分をドラッグ（バーチャルスティック） |
| ショット | Z / X / Space | A / B / X / RB / RT | 画面右半分をタップ |
| チャージビーム | ショット長押し→離す | 同左 | 右半分を長押し→離す |
| スタート | Enter / ショット | START / ショット | タップ |

- 敵は4種類: 直進機・サイン波機・急襲機・地上砲台
- ウェーブ1周ごとに **WARNING → ボス戦**。撃破で次周回（敵が高速化）
- ハイスコアは localStorage に保存

## 開発

```bash
python3 -m http.server 8080   # ES modules のため要HTTPサーバ
# → http://localhost:8080
for f in js/*.js; do node --check "$f"; done   # 構文チェック
```

- 開発計画と進捗: [docs/PLAN.md](docs/PLAN.md)
- ブランチ/PR運用規約: [docs/WORKFLOW.md](docs/WORKFLOW.md)（ベースブランチは `main`、直接pushせずPR経由）
