# 用語集 & クイックリファレンス

コードを読んでいて「これ何？」となった時に参照するドキュメントです。

---

## 目次

1. [ゲーム開発用語](#1-ゲーム開発用語)
2. [プロジェクト定数](#2-プロジェクト定数)
3. [主要な型定義](#3-主要な型定義)
4. [ゲームバランス値](#4-ゲームバランス値)

---

## 1. ゲーム開発用語

### 基本概念

| 用語 | 説明 |
|------|------|
| **ゲームループ** | 「入力→更新→描画」を毎フレーム繰り返す仕組み。このゲームでは60FPS |
| **delta time (dt)** | 前フレームからの経過時間。速度に掛けることでFPS変動に対応する |
| **FPS** | Frames Per Second。1秒あたりの描画回数。60FPSが目標 |
| **Ticker** | PixiJS のゲームループ管理機構。`requestAnimationFrame` のラッパー |

### 描画・座標

| 用語 | 説明 |
|------|------|
| **Container** | PixiJS の描画グループ。HTMLの `<div>` に相当。子要素をまとめて操作 |
| **Graphics** | PixiJS のプログラム描画。`ctx.fillRect()` に相当 |
| **RenderTexture** | オフスクリーンバッファ。マップタイルを1枚にまとめて高速化 |
| **ワールド座標** | ゲーム世界上の絶対座標。マップの左上が(0,0) |
| **スクリーン座標** | 画面上の座標。UIはこちらを使用 |
| **カメラ** | ワールドのどの部分を画面に表示するかを決める仕組み |

### 物理・当たり判定

| 用語 | 説明 |
|------|------|
| **hitbox** | 当たり判定の範囲。このゲームでは円（攻撃）と矩形（体）を使用 |
| **AABB** | Axis-Aligned Bounding Box。軸に平行な矩形の当たり判定 |
| **circle-rect intersection** | 円と矩形の交差判定。攻撃判定で使用 |
| **knockback** | 攻撃を受けた時に吹き飛ぶ物理挙動 |
| **stun** | ノックバック後の一定時間、行動不能になる状態 |
| **invincible frame (i-frame)** | 被ダメージ後の無敵時間。連続ダメージを防ぐ |

### AI・ゲームデザイン

| 用語 | 説明 |
|------|------|
| **ステートマシン** | 状態と遷移で行動を管理するパターン。敵AIに使用 |
| **telegraph** | 攻撃前の予告演出。プレイヤーに回避の猶予を与える |
| **wave** | 敵の出現グループ。各フロアに2〜3ウェーブ |
| **phase** | ボスの段階。HP閾値で行動パターンが変化 |
| **aggro range** | 敵がプレイヤーを認識する距離。基本360px |
| **cooldown** | スキル/攻撃の再使用までの待ち時間 |
| **combo** | 連続ヒット。時間内に攻撃を当て続けるとダメージ倍率が上がる |

### 描画テクニック

| 用語 | 説明 |
|------|------|
| **sprite** | 画面上に表示する画像/図形。このゲームではGraphicsで手描き |
| **particle** | 小さな図形を大量に生成・消滅させる演出（ヒット、死亡、環境） |
| **vignette** | 画面端を暗くする演出。没入感を高める |
| **letterbox** | 画面上下の黒帯。映画風のカットシーン演出 |
| **screen shake** | カメラを短時間揺らす演出。大ダメージ・爆発時に使用 |
| **hit stop** | ヒット時に一瞬ゲームを停止する演出。打撃感を強調 |
| **bob animation** | 上下に揺れるアニメーション。アイテムや敵の浮遊感 |

---

## 2. プロジェクト定数

### マップ関連

| 定数 | 値 | 場所 | 説明 |
|------|-----|------|------|
| `TILE_SIZE` | `48` px | `WorldMap.ts` | 1タイルの辺の長さ |
| `TILE.FLOOR` | `0` | `WorldMap.ts` | 床タイル |
| `TILE.WALL` | `1` | `WorldMap.ts` | 壁タイル |
| `TILE.BOSS_FLOOR` | `2` | `WorldMap.ts` | ボス部屋の床 |
| `TILE.TRAP` | `3` | `WorldMap.ts` | トラップ |
| `TILE.STAIRS` | `4` | `WorldMap.ts` | 階段 |

### UI関連

| 定数 | 値 | 場所 | 説明 |
|------|-----|------|------|
| `BTN_R` | `46` px | `AttackButton.ts` | 攻撃ボタン半径 |
| `SKILL_R` | `34` px | `AttackButton.ts` | スキルボタン半径 |
| `BASE_R` | `52` px | `VirtualJoystick.ts` | ジョイスティック外枠半径 |
| `THUMB_R` | `26` px | `VirtualJoystick.ts` | ジョイスティック操作部半径 |
| `MAX_DIST` | `42` px | `VirtualJoystick.ts` | 操作部の最大移動距離 |
| `MM_SCALE` | `3` px/tile | `Minimap.ts` | ミニマップ縮尺 |

### アイテム関連

| 定数 | 値 | 場所 | 説明 |
|------|-----|------|------|
| `PICKUP_RADIUS` | `36` px | `Items.ts` | アイテム拾得距離 |
| `ITEM_LIFETIME` | `12` 秒 | `Items.ts` | アイテム消滅時間 |

---

## 3. 主要な型定義

### GameState

```typescript
// GameScene.ts
type GameState = 'title' | 'playing' | 'skill_select'
              | 'gameover' | 'win' | 'floor_transition';
```

### SkillStats

```typescript
// Skills.ts — プレイヤーのスキルで変更可能なステータス
interface SkillStats {
  attackDamage: number;      // 基礎攻撃力
  attackRange: number;       // 攻撃範囲（px）
  speed: number;             // 移動速度（px/秒）
  maxHp: number;             // 最大HP
  hp: number;                // 現在HP
  dashSpeedMult: number;     // ダッシュ速度倍率
  dashDuration: number;      // ダッシュ持続時間（秒）
  hasVampiric: boolean;      // 吸血スキル所持
  vampiricRatio: number;     // 吸血回復率
  hasChainLightning: boolean;// 連鎖雷スキル所持
  chainLightningDamage: number;
  hasFireSpin: boolean;      // 火炎旋風スキル所持
  fireSpinDamage: number;
  hasDashStrike: boolean;    // 突進攻撃スキル所持
  dashStrikeDamage: number;
  hasRangedSlash: boolean;   // 遠距離斬撃スキル所持
  rangedSlashDamage: number;
  attackCooldownMult: number;// 攻撃速度倍率（小さいほど速い）
  critChance: number;        // クリティカル率（0〜1）
  critMult: number;          // クリティカル倍率
  knockbackMult: number;     // ノックバック力倍率
  xpMult: number;            // 経験値倍率
  itemLuckMult: number;      // アイテムドロップ率倍率
}
```

### FloorConfig

```typescript
// DungeonConfig.ts — フロアの全設定
interface FloorConfig {
  floorNumber: number;       // フロア番号（1〜5）
  theme: DungeonTheme;       // テーマ（色、名前）
  cols: number;              // マップ横タイル数
  rows: number;              // マップ縦タイル数
  roomCount: number;         // 部屋の数
  waves: WaveTemplate[];     // 敵ウェーブ定義
  enemyHpMult: number;       // 敵HP倍率
  enemySpeedMult: number;    // 敵速度倍率
  enemyDamageMult: number;   // 敵ダメージ倍率
  hasBoss: boolean;          // ボスフロアか
  hasElite: boolean;         // エリート敵が出るか
  healPercent: number;       // フロア開始時のHP回復率（0〜1）
}
```

### EnemyType

```typescript
// DungeonConfig.ts
type EnemyType = 'basic' | 'ranged' | 'charger'
              | 'bomber' | 'shield' | 'summoner';
```

### ItemType

```typescript
// Items.ts
type ItemType = 'heart' | 'xpGem' | 'crystal';
```

---

## 4. ゲームバランス値

### プレイヤー初期値

| パラメータ | 初期値 | レベルアップ毎の増加 |
|-----------|--------|-------------------|
| HP | 100 | +20 (maxHp) / +30 (回復) |
| 攻撃力 | 25 | +5 |
| 移動速度 | 180 px/秒 | — |
| 攻撃範囲 | 64 px | — |
| 攻撃クールダウン | 0.45 秒 | — |
| 攻撃持続 | 0.14 秒 | — |
| 無敵時間 | 1.2 秒 | — |
| ダッシュ倍率 | 3.5倍 | — |
| ダッシュ持続 | 0.18 秒 | — |
| ダッシュCD | 1.0 秒 | — |
| コンボ窓 | 2.0 秒 | — |
| XP→レベルアップ | level × 50 | — |

### ボスステータス

| パラメータ | Phase 1 | Phase 2 (60%) | Phase 3 (35%) |
|-----------|---------|---------------|---------------|
| HP | 7000 | — | — |
| 速度 | 85 | 155 | 190 |
| 近接ダメージ | 50 | 100 | 140 |
| 弾間隔 | 2.5秒 | 1.2秒 | 0.7秒 |
| 近接CD | 1.0秒 | 0.6秒 | 0.35秒 |
| ダッシュ | なし | CD 4.0秒 | CD 2.5秒 |

### フロア難易度スケーリング

| フロア | HP倍率 | 速度倍率 | ダメージ倍率 | 回復 |
|--------|--------|---------|-------------|------|
| B1F 石の迷宮 | 1.0 | 1.0 | 1.0 | 0% |
| B2F 炎の洞窟 | 1.2 | 1.05 | 1.15 | 20% |
| B3F 氷の墓所 | 1.5 | 1.1 | 1.3 | 20% |
| B4F 影の深淵 | 1.8 | 1.15 | 1.5 | 25% |
| B5F 魔王の玉座 | 2.5 | 1.2 | 1.8 | 30% |

---

## 次に読むべきドキュメント

- **[architecture.md](./architecture.md)**: 全体構造の理解
- **[systems.md](./systems.md)**: 各システムの詳細な動作原理
- **[how-to-extend.md](./how-to-extend.md)**: 新コンテンツの追加手順
