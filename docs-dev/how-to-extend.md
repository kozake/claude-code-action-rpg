# コンテンツ追加ガイド

このドキュメントでは、ゲームに新しい要素を追加する具体的な手順を解説します。
既存のコードパターンに倣って安全に拡張する方法を学べます。

---

## 目次

1. [新しい敵を追加する](#1-新しい敵を追加する)
2. [新しいスキルを追加する](#2-新しいスキルを追加する)
3. [新しいフロアを追加する](#3-新しいフロアを追加する)
4. [新しいアイテムを追加する](#4-新しいアイテムを追加する)
5. [UIを変更する](#5-uiを変更する)

---

## 1. 新しい敵を追加する

### 例: 「テレポーター」敵を追加する

瞬間移動でプレイヤーの背後に回り込む敵を作ってみましょう。

### Step 1: クラスを作成

`src/game/entities/SpecialEnemies.ts` に追加します。
既存の `ChargerEnemy` をパターンの参考にします。

```typescript
/** Teleporter: 一定間隔でプレイヤーの背後にワープ */
export class TeleporterEnemy extends Enemy {
  private teleportCooldown = 0;
  private readonly teleportInterval = 3.0;

  constructor(x: number, y: number, hp = 120, speed = 60) {
    // super(x, y, hp, speed, damage, attackRange, xpReward, w, h)
    super(x, y, hp, speed, 35, 36, 30, 34, 34);
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) { super.update(dt, player, map); return; }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.floatTimer += dt * 3;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    this.teleportCooldown -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // テレポート: プレイヤーの背後に移動
    if (this.teleportCooldown <= 0 && dist < 300) {
      const behindX = player.x - player.facingX * 60;
      const behindY = player.y - player.facingY * 60;
      if (!map.isColliding(behindX, behindY, this.w, this.h)) {
        this.x = behindX;
        this.y = behindY;
      }
      this.teleportCooldown = this.teleportInterval;
    }

    // 通常の近接攻撃
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage, this.x, this.y);
      this.attackCooldown = 1.2;
    }
    this.syncGfx();
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawCircle(0, 0, this.w * 0.4);
      g.endFill();
      return;
    }
    // 紫色の魔法使い風
    this.drawDemonBody(g, 0x440066, 0x8833cc, 0xcc66ff);
  }
}
```

### Step 2: EnemyType に追加

`src/game/DungeonConfig.ts`:
```typescript
export type EnemyType = 'basic' | 'ranged' | 'charger' | 'bomber'
                      | 'shield' | 'summoner' | 'teleporter';  // ← 追加
```

### Step 3: GameScene の生成処理に追加

`GameScene.ts` の `createEnemy()` メソッド（または敵生成のswitch文）に分岐を追加:

```typescript
case 'teleporter':
  enemy = new TeleporterEnemy(x, y, hpBase, speedBase);
  break;
```

### Step 4: ウェーブに配置

`DungeonConfig.ts` の `makeWaves()` で使用:
```typescript
{ type: 'teleporter', count: 2, hpBase: 300, speedBase: 60 },
```

### チェックリスト

- [ ] `Enemy` を継承して `update()` と `drawBody()` をオーバーライド
- [ ] `EnemyType` に型を追加
- [ ] `GameScene` の敵生成ロジックに追加
- [ ] `makeWaves()` でウェーブに配置
- [ ] テストプレイで動作確認

---

## 2. 新しいスキルを追加する

### 例: 「反射バリア」スキルを追加する

### Step 1: SkillStats にフラグを追加

`src/game/Skills.ts`:
```typescript
export interface SkillStats {
  // ... 既存のプロパティ
  hasReflect: boolean;       // ← 追加
  reflectDamage: number;     // ← 追加
}

export function createDefaultSkillStats(): SkillStats {
  return {
    // ... 既存の初期値
    hasReflect: false,        // ← 追加
    reflectDamage: 0,         // ← 追加
  };
}
```

### Step 2: スキル定義を追加

`ALL_SKILLS` 配列に追加:
```typescript
{
  id: 'reflect',
  name: '反射バリア',
  icon: '🛡️',
  description: '被ダメージ時に\n敵にダメージを返す',
  apply: (s) => {
    s.hasReflect = true;
    s.reflectDamage += 20;
  },
},
```

### Step 3: ゲームロジックに効果を実装

`GameScene.ts` のプレイヤー被ダメージ処理で:
```typescript
if (this.player.skills.hasReflect) {
  enemy.takeDamage(this.player.skills.reflectDamage);
}
```

### Step 4: スタッカブルにするか決める

`getRandomSkills()` の `stackable` セットに `'reflect'` を追加すれば重ね取り可能。
追加しなければ1回限り。

---

## 3. 新しいフロアを追加する

### Step 1: テーマを定義

`src/game/DungeonConfig.ts`:
```typescript
const CRYSTAL_CAVERN: DungeonTheme = {
  name: 'Crystal Cavern',
  nameJa: '水晶洞窟',
  palette: {
    floorColors: [0x2a4a5a, 0x1e3e5a, 0x346a7a],
    floorAccent: 0x1a3a50,
    wallBase: 0x3a5a6a,
    wallBrick: 0x4a6a7a,
    wallHighlight: 0x6a9aaa,
    wallShadow: 0x1a3a4a,
    wallSheen: 0x5a8a9a,
    trapColor: 0x44aadd,
    stairsColor: 0x44ddaa,
    torchFlame: [0x44aaff, 0x66ccff, 0x88eeff, 0xccffff],
    ambientTint: 0x112233,
  },
};
```

### Step 2: ウェーブを定義

`makeWaves()` に `case 6:` を追加（フロア番号）:
```typescript
case 6:
  return [
    {
      message: '⚔ B6F Wave 1: 水晶の番人',
      composition: [
        { type: 'shield', count: 4, hpBase: 500, speedBase: 75 },
        { type: 'ranged', count: 3, hpBase: 400, speedBase: 80 },
      ],
    },
    // ... 追加ウェーブ
  ];
```

### Step 3: FloorConfig を追加

`buildFloorConfigs()` の配列に追加:
```typescript
{
  floorNumber: 6,
  theme: CRYSTAL_CAVERN,
  cols: 46, rows: 36,    // マップサイズ
  roomCount: 7,
  waves: makeWaves(6),
  enemyHpMult: 2.0,      // 難易度倍率
  enemySpeedMult: 1.15,
  enemyDamageMult: 1.6,
  hasBoss: false,
  hasElite: true,
  healPercent: 0.2,       // フロア開始時のHP回復率
},
```

### Step 4: ボスフロアの調整

ボスフロアが最後になるように、既存のボスフロア（`hasBoss: true`）の
`floorNumber` を調整してください。

### Step 5: 環境パーティクルの追加（任意）

`Particles.ts` の `emitAmbient()` に新テーマのケースを追加:
```typescript
case 'Crystal Cavern': {
  // 水晶の輝き
  const life = 2 + Math.random();
  this.particles.push({
    x: rx, y: ry,
    vx: (Math.random() - 0.5) * 6,
    vy: -5 - Math.random() * 3,
    life, maxLife: life,
    color: 0x88eeff,
    size: 1.5,
    gravity: -2,
  });
  break;
}
```

---

## 4. 新しいアイテムを追加する

### Step 1: ItemType に追加

`src/game/Items.ts`:
```typescript
export type ItemType = 'heart' | 'xpGem' | 'crystal' | 'shield';  // ← 追加
```

### Step 2: spawn() に描画を追加

```typescript
} else if (type === 'shield') {
  // 青い盾アイコン
  g.beginFill(0x4488ff);
  g.drawRoundedRect(-6, -8, 12, 16, 3);
  g.endFill();
}
```

### Step 3: ドロップ確率を調整

`dropFromEnemy()` の確率分岐を調整。

### Step 4: 拾得時の効果を実装

`GameScene.ts` でアイテム拾得を処理している箇所に効果を追加:
```typescript
case 'shield':
  this.player.invincibleTime = 3.0;  // 3秒無敵
  break;
```

---

## 5. UIを変更する

### ボタンサイズの変更

`src/ui/AttackButton.ts` の定数:
```typescript
const BTN_R = 46;    // 攻撃ボタン半径（px）
const SKILL_R = 34;  // スキルボタン半径（px）
```

### ボタン位置の変更

`AttackButton.layout()` メソッド:
```typescript
this.attackX = screenW - 90;   // 右端から90px
this.attackY = screenH - 100;  // 下端から100px
this.skillX = screenW - 170;   // 右端から170px
this.skillY = screenH - 155;   // 下端から155px
```

### ジョイスティックのサイズ変更

`src/ui/VirtualJoystick.ts` の定数:
```typescript
const BASE_R = 52;     // ベース円の半径
const THUMB_R = 26;    // サム（操作部）の半径
const MAX_DIST = 42;   // サムの最大移動距離
```

### ミニマップの調整

`src/ui/Minimap.ts`:
```typescript
const MM_SCALE = 3;   // 1タイルあたりのピクセル数
const MARGIN = 10;    // 画面端からのマージン
```

---

## 次に読むべきドキュメント

- **[architecture.md](./architecture.md)**: 全体構造の理解
- **[systems.md](./systems.md)**: 各システムの詳細な動作原理
- **[glossary.md](./glossary.md)**: 用語・定数のクイックリファレンス
