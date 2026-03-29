# システム別詳細ガイド

このドキュメントでは、各システムの仕組みを詳しく解説します。
コードを修正・拡張する際のリファレンスとして使ってください。

---

## 目次

1. [戦闘システム](#1-戦闘システム)
2. [マップ生成](#2-マップ生成)
3. [敵AIシステム](#3-敵aiシステム)
4. [スキルシステム](#4-スキルシステム)
5. [入力システム](#5-入力システム)
6. [アイテムシステム](#6-アイテムシステム)
7. [弾丸システム](#7-弾丸システム)
8. [パーティクル・演出](#8-パーティクル演出)
9. [音声システム](#9-音声システム)

---

## 1. 戦闘システム

**関連ファイル**: `GameScene.ts`, `Player.ts`, `Enemy.ts`

### 攻撃の流れ

プレイヤーが攻撃ボタンを押してから敵にダメージが入るまでの流れ:

```
1. input.attackPressed が true になる（InputManager）
2. Player.update() で attackDuration = 0.14秒 をセット
3. attackDuration > 0 の間、Player.getAttackHitbox() が円形の当たり判定を返す
4. GameScene が全敵と当たり判定をチェック（circleHit関数）
5. ヒットした敵に enemy.takeDamage(damage) を呼ぶ
6. パーティクル・ダメージ数字・ノックバック・SE を発生
```

### 当たり判定 — 円と矩形の交差

このゲームの主要な当たり判定は **円（攻撃範囲）** と **矩形（敵の体）** の交差です。

```typescript
// 攻撃判定の円を取得
getAttackHitbox(): { cx: number; cy: number; r: number } {
  return {
    cx: this.x + this.facingX * this.attackRange * 0.6,  // プレイヤーの前方
    cy: this.y + this.facingY * this.attackRange * 0.6,
    r: this.attackRange * 0.55,                           // 攻撃範囲の半径
  };
}
```

判定は「円の中心から矩形の最近接点までの距離 < 半径」で行います。

### ダメージ計算

```typescript
// Player.getEffectiveDamage() の計算式
基礎ダメージ = attackDamage（初期25、レベルアップ・スキルで増加）
× コンボ倍率   = 1 + min(comboCount × 0.1, 1.0)  ← 最大2倍
× クリスタルバフ = crystalBuffTime > 0 なら ×1.5
× クリティカル  = critChance の確率で ×critMult（初期1.5倍）
```

### コンボシステム

連続ヒットでダメージが増加:
- ヒットするたびに `comboCount++`、`comboTimer = 2.0秒` にリセット
- 2秒間ヒットしないとコンボリセット
- 被ダメージでもコンボリセット

### ノックバック物理

敵がダメージを受けると、攻撃元から離れる方向に吹き飛びます:

```typescript
// Enemy.applyKnockback()
const dx = this.x - fromX;     // 攻撃元からの方向ベクトル
const dy = this.y - fromY;
const dist = Math.sqrt(dx*dx + dy*dy) || 1;
this.kbVx = (dx / dist) * force;  // 正規化 × 力
this.kbVy = (dy / dist) * force;
this.stunTime = 0.2;              // 0.2秒スタン

// 毎フレームの減衰（摩擦）
this.kbVx *= Math.max(0, 1 - dt * 8);  // 約0.13秒で停止
```

---

## 2. マップ生成

**関連ファイル**: `maps/WorldMap.ts`, `DungeonConfig.ts`

### 手続き的マップ生成アルゴリズム

各フロアのマップはランダムに生成されます:

```
Step 1: 全タイルを WALL で初期化
Step 2: ランダムに部屋を配置（重なりチェック付き）
Step 3: 隣接する部屋をL字型通路で接続
Step 4: 通路にトラップ（スパイク）を配置
Step 5: 部屋に破壊可能オブジェクト（樽・箱）を配置
Step 6: 最後の部屋に階段を設置（初期は非表示）
Step 7: 松明を配置（ライティング演出用）
```

### タイルの種類

```typescript
export const TILE = {
  FLOOR: 0,       // 歩ける床
  WALL: 1,        // 壁（通行不可）
  BOSS_FLOOR: 2,  // ボス部屋の床
  TRAP: 3,        // スパイクトラップ
  STAIRS: 4,      // 次のフロアへの階段
} as const;
```

### 壁衝突判定

プレイヤー・敵の移動時に使用:

```typescript
// WorldMap.isColliding(x, y, w, h)
// 矩形の四隅がどのタイルに位置するか計算し、WALL タイルと重なるか判定
// TILE_SIZE = 48px のグリッドベース
```

**X軸とY軸を分離して判定**するのがポイントです:
```typescript
// まずX方向だけ動かして判定
if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
// 次にY方向だけ動かして判定
if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
```
これにより、壁に沿ってスライド移動できます。

---

## 3. 敵AIシステム

**関連ファイル**: `entities/Enemy.ts`, `entities/SpecialEnemies.ts`, `entities/Boss.ts`

### 敵の種類と行動パターン

| 敵タイプ | クラス | AI概要 |
|---------|--------|--------|
| **基本** | `Enemy` | プレイヤーに直進、近接攻撃 |
| **遠距離** | `RangedEnemy` | 距離を保ちつつ弾を発射 |
| **突撃** | `ChargerEnemy` | テレグラフ表示後、直線突進 |
| **爆弾** | `BomberEnemy` | 接近→導火線→自爆（範囲ダメージ） |
| **盾** | `ShieldEnemy` | 正面からの攻撃をブロック |
| **召喚** | `SummonerEnemy` | 一定間隔で雑魚敵を召喚 |

### 基本敵AI（Enemy.update）

```
1. 死亡中 → 死亡アニメーション再生して終了
2. スポーン中 → 出現アニメーション再生して終了
3. スタン中 → 動かない
4. プレイヤーとの距離を計算
5. 距離 < 360px かつ > 攻撃範囲 → プレイヤーに向かって移動
6. 距離 < 攻撃範囲 かつ クールダウン完了 → 近接攻撃
```

### 突撃敵の状態マシン（ChargerEnemy）

ゲーム開発でよく使う **ステートマシン** パターンの好例:

```
idle（通常移動）
  │ プレイヤーが250px以内に入った
  ▼
telegraph（予告・0.8秒）← 赤く点滅、矢印表示
  │ タイマー終了
  ▼
charging（突進・0.5秒）← 高速直進、壁にぶつかるとスタン
  │ タイマー終了 or 壁衝突
  ▼
idle に戻る
```

### 盾敵のブロック判定（ShieldEnemy）

攻撃がブロックされるかどうかは **角度** で判定:

```typescript
isBlocked(ax: number, ay: number): boolean {
  const attackAngle = Math.atan2(ay - this.y, ax - this.x);
  let diff = attackAngle - this.shieldAngle;  // 盾は常にプレイヤー方向
  // 角度差を -π〜π に正規化
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < Math.PI / 3;  // ±60度以内ならブロック
}
```
→ 背後に回り込めばダメージが通る設計です。

### ボスの3フェーズ（Boss）

```
Phase 1（HP 100%〜60%）
├── 移動: プレイヤーに直進
├── 近接攻撃: クールダウン1.0秒
└── 弾幕: 7発扇状、2.5秒間隔

Phase 2（HP 60%〜35%）← isAngry = true
├── 移動: ランダム方向＋速度1.3倍
├── 近接攻撃: クールダウン0.6秒
├── 弾幕: 9発扇状 + 8方向放射、1.2秒間隔
└── 【新】ダッシュ攻撃（150〜600px距離で発動）

Phase 3（HP 35%〜0%）← isEnraged = true
├── 移動: ランダム方向＋速度1.5倍
├── 近接攻撃: クールダウン0.35秒
├── 弾幕: 16方向放射×2 + 7発扇状、0.7秒間隔
├── ダッシュ攻撃（クールダウン2.5秒）
└── テレグラフ（赤い警告円）表示
```

---

## 4. スキルシステム

**関連ファイル**: `Skills.ts`, `ui/SkillSelect.ts`

### 仕組み

レベルアップ時に3つのスキルからランダムに選択。選んだスキルが即座に適用されます。

```
レベルアップ検知（Player.addXp → justLeveledUp = true）
  ↓
GameScene が state を 'skill_select' に変更
  ↓
SkillSelectUI にランダム3スキルを表示
  ↓
プレイヤーが選択
  ↓
skill.apply(player.skills) で SkillStats を変更
  ↓
player.syncSkills() で実際のステータスに反映
  ↓
state を 'playing' に戻す
```

### スキルの2分類

**ユニークスキル**（1回のみ取得可能）:
- 雷撃斬、火炎旋風、吸血の刃、鉄壁突進、剣気飛翔
- `acquiredIds` に記録され、2回目以降は候補に出ない

**スタッカブルスキル**（重ね取り可能）:
- 剛力、疾風、生命力、必殺の一撃、豪腕、連撃、大剣、トレジャーハンター
- 何度でも候補に出現し、効果が累積する

### SkillStats — スキルが変更する値

```typescript
interface SkillStats {
  attackDamage: number;    // 基礎攻撃力（初期25）
  attackRange: number;     // 攻撃範囲（初期64px）
  speed: number;           // 移動速度（初期180）
  maxHp: number;           // 最大HP（初期100）
  critChance: number;      // クリティカル率（初期0）
  critMult: number;        // クリティカル倍率（初期1.5）
  // ... フラグ系（hasVampiric, hasChainLightning 等）
}
```

---

## 5. 入力システム

**関連ファイル**: `input.ts`, `ui/VirtualJoystick.ts`, `ui/AttackButton.ts`

### 設計思想

キーボードとタッチを **InputManager で統一** し、ゲームロジックは入力元を意識しない:

```
キーボード（WASD/矢印）──┐
                          ├──→ InputManager ──→ moveX, moveY, attackPressed, skillPressed
仮想ジョイスティック───────┘
攻撃ボタン────────────────┘
```

### キー割り当て

| 操作 | キー | タッチ |
|------|------|--------|
| 移動 | WASD / 矢印キー | 仮想ジョイスティック（左半分） |
| 攻撃 | Space / Z / J | 攻撃ボタン ⚔（右下） |
| スキル | X / Shift | スキルボタン 💨（右上） |

### 仮想ジョイスティック

画面左半分をタッチするとジョイスティックがその位置に出現:

```typescript
// タッチ開始：左半分のみ反応
if (t.clientX < window.innerWidth * 0.5) {
  this.baseX = t.clientX;  // タッチ位置を中心に設定
  this.baseY = t.clientY;
}
// タッチ移動：方向と距離を計算
this.x = dx / dist;  // -1〜1 の正規化値
this.y = dy / dist;
const clamped = Math.min(dist, MAX_DIST);  // 最大42pxで制限
```

### attackPressed vs attack

```typescript
this.attack = /* 現在押されているか */;
this.attackPressed = this.attack && !this.prevAttack;  // 押した瞬間だけ true
```
- `attack`: ボタンを押し続けている間ずっと true
- `attackPressed`: 押した **瞬間** だけ true（エッジ検出）

---

## 6. アイテムシステム

**関連ファイル**: `Items.ts`

### アイテムの種類

| アイテム | 見た目 | 効果 |
|---------|--------|------|
| **heart** | 赤いハート | HP回復 |
| **xpGem** | 青いダイヤ | 経験値獲得 |
| **crystal** | 金色クリスタル | 一時的な攻撃力バフ |

### ドロップ確率（通常敵）

```
35% → heart
25% → xpGem
12% → crystal
28% → ドロップなし
```

ボスは heart×2 + xpGem + crystal を確定ドロップ。

### アイテムの挙動

- 上下に浮遊アニメーション（`bobTimer`）
- 12秒で消滅、残り2秒で点滅警告
- プレイヤーとの距離が36px以内で自動拾得

---

## 7. 弾丸システム

**関連ファイル**: `Projectile.ts`

### 2種類の弾丸

- **敵弾**（`isPlayerProj = false`）: ボス・遠距離敵が発射。プレイヤーに当たる
- **プレイヤー弾**（`isPlayerProj = true`）: 剣気飛翔スキルで発射。敵に当たる

### 弾丸のライフサイクル

```
add() で生成 → 毎フレーム位置更新 → 当たり判定 → ヒットor寿命切れで削除
```

各弾丸は `{ x, y, vx, vy, damage, radius, lifetime }` を持ちます。

---

## 8. パーティクル・演出

**関連ファイル**: `Particles.ts`, `ScreenEffects.ts`

### パーティクルの物理

各パーティクルは以下の属性を持ちます:

```typescript
interface Particle {
  x, y: number;       // 位置
  vx, vy: number;     // 速度
  life, maxLife: number; // 寿命
  color: number;       // 色
  size: number;        // サイズ
  gravity: number;     // 重力加速度
}
```

毎フレームの更新:
```
位置 += 速度 × dt
速度X *= (1 - dt × 3)   ← 空気抵抗
速度Y += 重力 × dt       ← 重力
透明度 = 残り寿命 / 最大寿命
サイズ = 初期サイズ × 残り寿命比率
```

### 環境パーティクル

フロアテーマごとに異なる環境演出:

| フロア | パーティクル |
|--------|-------------|
| 石の迷宮 | 塵（ゆっくり落下） |
| 炎の洞窟 | 火の粉（上昇） |
| 氷の墓所 | 雪片（斜めに落下） |
| 影の深淵 | 紫の霧（浮遊） |
| 魔王の玉座 | 金の輝き（浮遊） |

### 画面演出（ScreenEffects）

- **ビネット**: 画面端を暗くする常時エフェクト
- **フロア遷移**: フェードアウト → タイトル表示 → フェードイン
- **レターボックス**: ボス戦開始時の映画風演出（上下の黒帯）

---

## 9. 音声システム

**関連ファイル**: `audio.ts`

### 二重フォールバック設計

```
1. まず audio/field.ogg (or .mp3) をHTMLAudioで再生を試みる
2. ファイルが無い場合 → Web Audio API で合成BGMを生成
```

### 合成BGM

音声ファイルが無くても、Web Audio API のオシレーターで
8bit風BGMを自動生成します:

- **フィールド**: Dメジャー、140BPM、冒険的なメロディ
- **ボス**: Dマイナー、160BPM、激しい戦闘曲
- 各フロアごとに調・テンポ・音色が異なる

### SE（効果音）

SE もすべて Web Audio API で合成:
- ヒット音: 短いノイズバースト
- レベルアップ: 上昇するトーン
- ダッシュ: 風のようなスイープ

---

## 次に読むべきドキュメント

- **[architecture.md](./architecture.md)**: 全体構造を俯瞰したい場合
- **[how-to-extend.md](./how-to-extend.md)**: 新コンテンツの追加手順
- **[glossary.md](./glossary.md)**: 用語集・定数一覧
