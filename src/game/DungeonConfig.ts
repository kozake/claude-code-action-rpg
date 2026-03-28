// ============================================================
// DungeonConfig – 階層定義、テーマ、パレット、ウェーブ生成
// ============================================================

export type EnemyType = 'basic' | 'ranged' | 'charger' | 'bomber' | 'shield' | 'summoner';

export interface WaveTemplate {
  composition: { type: EnemyType; count: number; hpBase: number; speedBase: number }[];
  message: string;
}

export interface TilePalette {
  floorColors: number[];    // 3 variants for floor tiles
  floorAccent: number;      // decorative patch color
  wallBase: number;
  wallBrick: number;
  wallHighlight: number;
  wallShadow: number;
  wallSheen: number;
  trapColor: number;
  stairsColor: number;
  torchFlame: number[];     // [outer, main, inner, core]
  ambientTint: number;      // vignette / ambient overlay tint
}

export interface DungeonTheme {
  name: string;
  nameJa: string;
  palette: TilePalette;
}

export interface FloorConfig {
  floorNumber: number;
  theme: DungeonTheme;
  cols: number;
  rows: number;
  roomCount: number;
  waves: WaveTemplate[];
  enemyHpMult: number;
  enemySpeedMult: number;
  enemyDamageMult: number;
  hasBoss: boolean;
  hasElite: boolean;
  healPercent: number; // HP recovery on floor entry (0-1)
}

// ── Themes ────────────────────────────────────────────────────

const STONE_LABYRINTH: DungeonTheme = {
  name: 'Stone Labyrinth',
  nameJa: '石の迷宮',
  palette: {
    floorColors: [0x4a5a3a, 0x3e4e32, 0x546444],
    floorAccent: 0x3a4a2e,
    wallBase: 0x5a5a5a,
    wallBrick: 0x6a6a6a,
    wallHighlight: 0x8a8a7a,
    wallShadow: 0x3a3a3a,
    wallSheen: 0x7a7a6a,
    trapColor: 0xcc4444,
    stairsColor: 0x44ddaa,
    torchFlame: [0xff6600, 0xff9900, 0xffcc00, 0xffffaa],
    ambientTint: 0x224422,
  },
};

const FIRE_CAVERN: DungeonTheme = {
  name: 'Fire Cavern',
  nameJa: '炎の洞窟',
  palette: {
    floorColors: [0x5a3a2a, 0x6a3a20, 0x4a3024],
    floorAccent: 0x7a4430,
    wallBase: 0x6a3a2a,
    wallBrick: 0x8a4a30,
    wallHighlight: 0xaa6a40,
    wallShadow: 0x3a2010,
    wallSheen: 0x9a5a38,
    trapColor: 0xff6600,
    stairsColor: 0x44ddaa,
    torchFlame: [0xff4400, 0xff6600, 0xffaa00, 0xffffcc],
    ambientTint: 0x442211,
  },
};

const ICE_CRYPT: DungeonTheme = {
  name: 'Ice Crypt',
  nameJa: '氷の墓所',
  palette: {
    floorColors: [0x3a4a5a, 0x2e3e5a, 0x445a6a],
    floorAccent: 0x2a3a50,
    wallBase: 0x4a5a6a,
    wallBrick: 0x5a6a7a,
    wallHighlight: 0x7a9aaa,
    wallShadow: 0x2a3a4a,
    wallSheen: 0x6a8a9a,
    trapColor: 0x44aaff,
    stairsColor: 0x44ddaa,
    torchFlame: [0x4488ff, 0x66aaff, 0x88ccff, 0xccddff],
    ambientTint: 0x112244,
  },
};

const SHADOW_DEPTHS: DungeonTheme = {
  name: 'Shadow Depths',
  nameJa: '影の深淵',
  palette: {
    floorColors: [0x3a2a4a, 0x342848, 0x402e52],
    floorAccent: 0x2a1e3a,
    wallBase: 0x4a3a5a,
    wallBrick: 0x5a4a6a,
    wallHighlight: 0x7a6a8a,
    wallShadow: 0x2a1a3a,
    wallSheen: 0x6a5a7a,
    trapColor: 0xcc44ff,
    stairsColor: 0x44ddaa,
    torchFlame: [0xaa44ff, 0xcc66ff, 0xdd88ff, 0xeeccff],
    ambientTint: 0x221133,
  },
};

const DEMON_THRONE: DungeonTheme = {
  name: 'Demon Throne',
  nameJa: '魔王の玉座',
  palette: {
    floorColors: [0x2a1a1a, 0x3a1a1a, 0x2a1020],
    floorAccent: 0x4a2020,
    wallBase: 0x3a2a2a,
    wallBrick: 0x4a2a2a,
    wallHighlight: 0x6a4a4a,
    wallShadow: 0x1a0a0a,
    wallSheen: 0x5a3a3a,
    trapColor: 0xff2244,
    stairsColor: 0xffdd44,
    torchFlame: [0xff2200, 0xff4400, 0xff6644, 0xffaa88],
    ambientTint: 0x330011,
  },
};

export const THEMES: DungeonTheme[] = [
  STONE_LABYRINTH,
  FIRE_CAVERN,
  ICE_CRYPT,
  SHADOW_DEPTHS,
  DEMON_THRONE,
];

// ── Wave Templates per Floor ──────────────────────────────────

function makeWaves(floor: number): WaveTemplate[] {
  switch (floor) {
    case 1:
      return [
        {
          message: '⚔ B1F Wave 1: 前哨戦',
          composition: [
            { type: 'basic', count: 6, hpBase: 220, speedBase: 94 },
          ],
        },
        {
          message: '⚔ B1F Wave 2: 遠距離の脅威',
          composition: [
            { type: 'basic', count: 4, hpBase: 240, speedBase: 100 },
            { type: 'ranged', count: 3, hpBase: 280, speedBase: 70 },
          ],
        },
      ];
    case 2:
      return [
        {
          message: '⚔ B2F Wave 1: 突撃部隊',
          composition: [
            { type: 'basic', count: 3, hpBase: 280, speedBase: 100 },
            { type: 'charger', count: 3, hpBase: 350, speedBase: 90 },
          ],
        },
        {
          message: '⚔ B2F Wave 2: 爆炎の嵐',
          composition: [
            { type: 'charger', count: 2, hpBase: 360, speedBase: 92 },
            { type: 'bomber', count: 4, hpBase: 210, speedBase: 113 },
            { type: 'ranged', count: 2, hpBase: 300, speedBase: 74 },
          ],
        },
      ];
    case 3:
      return [
        {
          message: '⚔ B3F Wave 1: 鉄壁の守り',
          composition: [
            { type: 'shield', count: 3, hpBase: 440, speedBase: 68 },
            { type: 'ranged', count: 3, hpBase: 320, speedBase: 76 },
          ],
        },
        {
          message: '⚔ B3F Wave 2: 精鋭部隊',
          composition: [
            { type: 'shield', count: 2, hpBase: 460, speedBase: 70 },
            { type: 'charger', count: 3, hpBase: 390, speedBase: 94 },
            { type: 'bomber', count: 2, hpBase: 230, speedBase: 115 },
          ],
        },
        {
          message: '💀 B3F Wave 3: 氷の試練',
          composition: [
            { type: 'shield', count: 3, hpBase: 480, speedBase: 72 },
            { type: 'charger', count: 2, hpBase: 400, speedBase: 96 },
            { type: 'ranged', count: 3, hpBase: 340, speedBase: 78 },
            { type: 'bomber', count: 2, hpBase: 250, speedBase: 118 },
          ],
        },
      ];
    case 4:
      return [
        {
          message: '⚔ B4F Wave 1: 闇の召喚師',
          composition: [
            { type: 'summoner', count: 2, hpBase: 500, speedBase: 50 },
            { type: 'shield', count: 2, hpBase: 470, speedBase: 70 },
            { type: 'basic', count: 4, hpBase: 320, speedBase: 106 },
          ],
        },
        {
          message: '⚔ B4F Wave 2: 影の軍団',
          composition: [
            { type: 'summoner', count: 2, hpBase: 540, speedBase: 54 },
            { type: 'charger', count: 3, hpBase: 420, speedBase: 98 },
            { type: 'bomber', count: 3, hpBase: 260, speedBase: 120 },
          ],
        },
        {
          message: '💀 B4F Wave 3: 総攻撃',
          composition: [
            { type: 'summoner', count: 3, hpBase: 560, speedBase: 56 },
            { type: 'shield', count: 3, hpBase: 500, speedBase: 74 },
            { type: 'charger', count: 2, hpBase: 440, speedBase: 100 },
            { type: 'ranged', count: 2, hpBase: 380, speedBase: 80 },
          ],
        },
      ];
    case 5:
    default:
      // Boss floor: no regular waves, boss spawns directly
      return [];
  }
}

// ── Floor Configs ─────────────────────────────────────────────

export function buildFloorConfigs(): FloorConfig[] {
  return [
    {
      floorNumber: 1,
      theme: STONE_LABYRINTH,
      cols: 36, rows: 28,
      roomCount: 5,
      waves: makeWaves(1),
      enemyHpMult: 1.0, enemySpeedMult: 1.0, enemyDamageMult: 1.0,
      hasBoss: false, hasElite: false,
      healPercent: 0,
    },
    {
      floorNumber: 2,
      theme: FIRE_CAVERN,
      cols: 40, rows: 30,
      roomCount: 5,
      waves: makeWaves(2),
      enemyHpMult: 1.2, enemySpeedMult: 1.05, enemyDamageMult: 1.15,
      hasBoss: false, hasElite: false,
      healPercent: 0.2,
    },
    {
      floorNumber: 3,
      theme: ICE_CRYPT,
      cols: 42, rows: 32,
      roomCount: 6,
      waves: makeWaves(3),
      enemyHpMult: 1.5, enemySpeedMult: 1.1, enemyDamageMult: 1.3,
      hasBoss: false, hasElite: true,
      healPercent: 0.2,
    },
    {
      floorNumber: 4,
      theme: SHADOW_DEPTHS,
      cols: 44, rows: 34,
      roomCount: 7,
      waves: makeWaves(4),
      enemyHpMult: 1.8, enemySpeedMult: 1.15, enemyDamageMult: 1.5,
      hasBoss: false, hasElite: true,
      healPercent: 0.25,
    },
    {
      floorNumber: 5,
      theme: DEMON_THRONE,
      cols: 30, rows: 24,
      roomCount: 2,
      waves: makeWaves(5),
      enemyHpMult: 2.5, enemySpeedMult: 1.2, enemyDamageMult: 1.8,
      hasBoss: true, hasElite: false,
      healPercent: 0.3,
    },
  ];
}
