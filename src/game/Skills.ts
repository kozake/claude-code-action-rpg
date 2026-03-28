/** Skill definitions for roguelike level-up choices */

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Apply the skill effect to player stats/state */
  apply: (stats: SkillStats) => void;
}

/** Mutable stats that skills can modify */
export interface SkillStats {
  attackDamage: number;
  attackRange: number;
  speed: number;
  maxHp: number;
  hp: number;
  dashSpeedMult: number;
  dashDuration: number;
  // Skill flags
  hasVampiric: boolean;
  vampiricRatio: number;
  hasChainLightning: boolean;
  chainLightningDamage: number;
  hasFireSpin: boolean;
  fireSpinDamage: number;
  hasDashStrike: boolean;
  dashStrikeDamage: number;
  hasRangedSlash: boolean;
  rangedSlashDamage: number;
  attackCooldownMult: number;
  critChance: number;
  critMult: number;
  knockbackMult: number;
  xpMult: number;
  itemLuckMult: number;
}

export function createDefaultSkillStats(): SkillStats {
  return {
    attackDamage: 25,
    attackRange: 64,
    speed: 180,
    maxHp: 100,
    hp: 100,
    dashSpeedMult: 3.5,
    dashDuration: 0.18,
    hasVampiric: false,
    vampiricRatio: 0,
    hasChainLightning: false,
    chainLightningDamage: 0,
    hasFireSpin: false,
    fireSpinDamage: 0,
    hasDashStrike: false,
    dashStrikeDamage: 0,
    hasRangedSlash: false,
    rangedSlashDamage: 0,
    attackCooldownMult: 1,
    critChance: 0,
    critMult: 1.5,
    knockbackMult: 1,
    xpMult: 1,
    itemLuckMult: 1,
  };
}

const ALL_SKILLS: Skill[] = [
  {
    id: 'lightning_slash',
    name: '雷撃斬',
    icon: '⚡',
    description: '攻撃ヒット時に\n周囲の敵に連鎖ダメージ',
    apply: (s) => {
      s.hasChainLightning = true;
      s.chainLightningDamage += 15;
    },
  },
  {
    id: 'fire_spin',
    name: '火炎旋風',
    icon: '🔥',
    description: '全方位の回転攻撃で\n広範囲にダメージ',
    apply: (s) => {
      s.hasFireSpin = true;
      s.fireSpinDamage += 20;
    },
  },
  {
    id: 'vampiric',
    name: '吸血の刃',
    icon: '💚',
    description: '攻撃ヒット時に\nHPを少し回復',
    apply: (s) => {
      s.hasVampiric = true;
      s.vampiricRatio += 0.15;
    },
  },
  {
    id: 'dash_strike',
    name: '鉄壁突進',
    icon: '🛡️',
    description: 'ダッシュ中に敵に\n当たるとダメージ',
    apply: (s) => {
      s.hasDashStrike = true;
      s.dashStrikeDamage += 30;
    },
  },
  {
    id: 'ranged_slash',
    name: '剣気飛翔',
    icon: '🏹',
    description: '攻撃時に遠距離\n飛び道具を発射',
    apply: (s) => {
      s.hasRangedSlash = true;
      s.rangedSlashDamage += 12;
    },
  },
  {
    id: 'power_up',
    name: '剛力',
    icon: '💪',
    description: '攻撃力が大幅アップ',
    apply: (s) => {
      s.attackDamage += 12;
    },
  },
  {
    id: 'speed_up',
    name: '疾風',
    icon: '💨',
    description: '移動速度アップ\nダッシュも強化',
    apply: (s) => {
      s.speed += 30;
      s.dashSpeedMult += 0.5;
    },
  },
  {
    id: 'vitality',
    name: '生命力',
    icon: '❤️',
    description: '最大HPアップ\nHPも全回復',
    apply: (s) => {
      s.maxHp += 40;
      s.hp = s.maxHp;
    },
  },
  {
    id: 'crit',
    name: '必殺の一撃',
    icon: '🎯',
    description: 'クリティカル率アップ\n大ダメージの確率増加',
    apply: (s) => {
      s.critChance += 0.2;
      s.critMult += 0.3;
    },
  },
  {
    id: 'heavy_blow',
    name: '豪腕',
    icon: '🔨',
    description: 'ノックバック強化\n敵を遠くまで吹き飛ばす',
    apply: (s) => {
      s.knockbackMult += 0.5;
      s.attackDamage += 5;
    },
  },
  {
    id: 'fast_attack',
    name: '連撃',
    icon: '⚡',
    description: '攻撃速度アップ\n素早く連打可能',
    apply: (s) => {
      s.attackCooldownMult *= 0.7;
    },
  },
  {
    id: 'treasure_hunter',
    name: 'トレジャーハンター',
    icon: '💎',
    description: '経験値＆アイテム\nドロップ率アップ',
    apply: (s) => {
      s.xpMult += 0.4;
      s.itemLuckMult += 0.5;
    },
  },
  {
    id: 'wide_slash',
    name: '大剣',
    icon: '🗡️',
    description: '攻撃範囲が広がる',
    apply: (s) => {
      s.attackRange += 20;
    },
  },
];

/** Get N random unique skills for level-up selection */
export function getRandomSkills(count = 3, acquiredIds: Set<string> = new Set()): Skill[] {
  // Filter to skills not yet acquired (except stackable ones)
  const stackable = new Set(['power_up', 'speed_up', 'vitality', 'crit', 'heavy_blow', 'fast_attack', 'wide_slash']);
  const available = ALL_SKILLS.filter(s => stackable.has(s.id) || !acquiredIds.has(s.id));

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
