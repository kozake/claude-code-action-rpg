import { Graphics, Container } from 'pixi.js';
import type { InputManager } from '../../input';
import type { WorldMap } from '../maps/WorldMap';
import type { SkillStats } from '../Skills';

/** Afterimage entry for dash trail */
interface Afterimage {
  gfx: Graphics;
  life: number;
}

export class Player {
  x: number;
  y: number;
  readonly w = 40;
  readonly h = 40;
  speed = 180;

  hp: number;
  maxHp = 100;
  xp = 0;
  level = 1;
  attackDamage = 25;
  attackRange = 64;
  attackCooldown = 0;
  attackDuration = 0;
  invincibleTime = 0;
  dashTime = 0;
  dashCooldown = 0;
  dashSpeedMult = 3.5;
  dashDuration = 0.18;

  facingX = 1;
  facingY = 0;

  // Skill stats
  skills: SkillStats;
  acquiredSkillIds = new Set<string>();

  // Combo
  comboCount = 0;
  comboTimer = 0;
  readonly comboWindow = 2.0;

  // Fire spin (skill)
  fireSpinActive = false;
  fireSpinTimer = 0;

  private bodyGfx: Graphics;
  readonly attackGfx: Graphics;
  readonly shadowGfx: Graphics;
  readonly container: Container;

  // Afterimage trail
  private afterimages: Afterimage[] = [];
  private afterimageTimer = 0;

  // Bob animation
  private bobTimer = 0;

  // Attack cooldown multiplier (from skills)
  attackCooldownMult = 1;

  justLeveledUp = false;

  // Buff timers
  crystalBuffTime = 0;

  constructor(x: number, y: number, skillStats: SkillStats) {
    this.x = x;
    this.y = y;
    this.skills = skillStats;
    this.hp = this.maxHp;

    this.container = new Container();

    // Drop shadow
    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);

    // Attack effect layer (below body)
    this.attackGfx = new Graphics();
    this.container.addChild(this.attackGfx);

    // Character body (procedural)
    this.bodyGfx = new Graphics();
    this.container.addChild(this.bodyGfx);

    this.render();
  }

  /** Sync player stats from skill stats */
  syncSkills() {
    this.attackDamage = this.skills.attackDamage;
    this.attackRange = this.skills.attackRange;
    this.speed = this.skills.speed;
    this.maxHp = this.skills.maxHp;
    this.hp = Math.min(this.hp, this.maxHp);
    this.dashSpeedMult = this.skills.dashSpeedMult;
    this.dashDuration = this.skills.dashDuration;
    this.attackCooldownMult = this.skills.attackCooldownMult;
  }

  /** Get effective attack damage (with combo multiplier, crit, crystal buff) */
  getEffectiveDamage(): { damage: number; isCrit: boolean } {
    let dmg = this.attackDamage;
    const comboMult = 1 + Math.min(this.comboCount * 0.1, 1.0);
    dmg *= comboMult;
    if (this.crystalBuffTime > 0) dmg *= 1.5;
    const isCrit = Math.random() < this.skills.critChance;
    if (isCrit) dmg *= this.skills.critMult;
    return { damage: Math.round(dmg), isCrit };
  }

  update(dt: number, input: InputManager, map: WorldMap) {
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.comboCount = 0;
    this.crystalBuffTime = Math.max(0, this.crystalBuffTime - dt);
    this.fireSpinTimer = Math.max(0, this.fireSpinTimer - dt);
    if (this.fireSpinTimer <= 0) this.fireSpinActive = false;

    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (input.skillPressed && this.dashCooldown <= 0 && this.dashTime <= 0) {
      if (this.skills.hasFireSpin && !this.fireSpinActive) {
        this.fireSpinActive = true;
        this.fireSpinTimer = 0.5;
      }
      this.dashTime = this.dashDuration;
      this.dashCooldown = 1.0;
      this.invincibleTime = Math.max(this.invincibleTime, this.dashDuration);
    }
    this.dashTime = Math.max(0, this.dashTime - dt);
    const dashing = this.dashTime > 0;

    // Afterimage during dash
    if (dashing) {
      this.afterimageTimer += dt;
      if (this.afterimageTimer > 0.03) {
        this.afterimageTimer = 0;
        this.spawnAfterimage();
      }
    }

    // Update afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const ai = this.afterimages[i];
      ai.life -= dt;
      ai.gfx.alpha = Math.max(0, ai.life / 0.15) * 0.45;
      if (ai.life <= 0) {
        this.container.removeChild(ai.gfx);
        this.afterimages.splice(i, 1);
      }
    }

    // Movement
    const spd = this.speed * (dashing ? this.dashSpeedMult : 1);
    const mx = input.moveX * spd * dt;
    const my = input.moveY * spd * dt;
    const isMoving = input.moveX !== 0 || input.moveY !== 0;

    if (isMoving) {
      this.facingX = input.moveX;
      this.facingY = input.moveY;
      const len = Math.sqrt(this.facingX ** 2 + this.facingY ** 2);
      if (len > 0) {
        this.facingX /= len;
        this.facingY /= len;
      }
      this.bobTimer += dt * (dashing ? 20 : 8);
    }

    if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
    if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;

    // Attack
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackDuration = Math.max(0, this.attackDuration - dt);
    this.invincibleTime = Math.max(0, this.invincibleTime - dt);

    if (input.attackPressed && this.attackCooldown <= 0) {
      this.attackCooldown = 0.45 * this.attackCooldownMult;
      this.attackDuration = 0.14;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  private spawnAfterimage() {
    const ai = new Graphics();
    // Draw a simplified silhouette in cyan
    ai.beginFill(0x00ccff, 1);
    // Body
    ai.drawRoundedRect(-9, -4, 18, 20, 5);
    // Head
    ai.drawCircle(0, -15, 9);
    ai.endFill();
    ai.alpha = 0.45;
    // Flip based on facing
    if (this.facingX < -0.3) ai.scale.x = -1;
    this.container.addChildAt(ai, 0);
    this.afterimages.push({ gfx: ai, life: 0.15 });
  }

  getAttackHitbox(): { cx: number; cy: number; r: number } | null {
    if (this.attackDuration <= 0) return null;
    return {
      cx: this.x + this.facingX * this.attackRange * 0.6,
      cy: this.y + this.facingY * this.attackRange * 0.6,
      r: this.attackRange * 0.55,
    };
  }

  /** Get fire spin hitbox (full circle around player) */
  getFireSpinHitbox(): { cx: number; cy: number; r: number } | null {
    if (!this.fireSpinActive) return null;
    return { cx: this.x, cy: this.y, r: this.attackRange * 1.2 };
  }

  /** Get dash strike hitbox */
  getDashStrikeHitbox(): { cx: number; cy: number; r: number } | null {
    if (this.dashTime <= 0 || !this.skills.hasDashStrike) return null;
    return { cx: this.x, cy: this.y, r: this.w * 0.7 };
  }

  /** Register a hit for combo tracking */
  registerHit() {
    this.comboCount++;
    this.comboTimer = this.comboWindow;
  }

  takeDamage(amount: number) {
    if (this.invincibleTime > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTime = 1.2;
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  /** Heal HP (from vampiric or items) */
  heal(amount: number) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  addXp(amount: number) {
    const boosted = Math.round(amount * this.skills.xpMult);
    this.xp += boosted;
    const needed = this.level * 50;
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.skills.maxHp += 20;
      this.skills.hp = Math.min(this.skills.hp + 30, this.skills.maxHp);
      this.skills.attackDamage += 5;
      this.syncSkills();
      this.hp = Math.min(this.hp + 30, this.maxHp);
      this.justLeveledUp = true;
    }
  }

  get dead() {
    return this.hp <= 0;
  }

  get isDashing() {
    return this.dashTime > 0;
  }

  private render() {
    const flicker = this.invincibleTime > 0 && Math.floor(this.invincibleTime * 10) % 2 === 0;
    const dashing = this.dashTime > 0;

    // Drop shadow
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.28);
    this.shadowGfx.drawEllipse(0, 16, 14, 5);
    this.shadowGfx.endFill();

    // Flicker when invincible
    this.bodyGfx.alpha = flicker ? 0.2 : 1.0;
    // Bob animation
    this.bodyGfx.y = Math.sin(this.bobTimer) * 2;

    // Choose color scheme based on state
    let bodyColor = 0x1a4bc0;      // Royal blue armor
    let accentColor = 0x4488ff;    // Light blue accent
    let glowColor = 0x88ccff;      // Eye/glow color
    let sheen = 0x6699ff;          // Armor sheen

    if (this.crystalBuffTime > 0) {
      bodyColor = 0xcc7700; accentColor = 0xffdd44; glowColor = 0xffee88; sheen = 0xffcc22;
    } else if (this.fireSpinActive) {
      bodyColor = 0xbb2200; accentColor = 0xff6622; glowColor = 0xffaa44; sheen = 0xff8833;
    } else if (dashing) {
      bodyColor = 0x0077bb; accentColor = 0x33ddff; glowColor = 0x88eeff; sheen = 0x44ccff;
    } else if (this.attackDuration > 0) {
      bodyColor = 0x2255dd; accentColor = 0x88bbff; glowColor = 0xccddff; sheen = 0xaaccff;
    }

    this.bodyGfx.clear();

    // Flip horizontally based on facing direction
    this.bodyGfx.scale.x = this.facingX < -0.3 ? -1 : 1;

    // ── Body ──────────────────────────────────────────────────────────────────
    // Cape/cloak (behind body, darker)
    const cloakColor = (bodyColor & 0xfefefe) >> 1; // ~50% darkened
    this.bodyGfx.beginFill(cloakColor, 0.85);
    this.bodyGfx.drawEllipse(0, 6, 13, 16);
    this.bodyGfx.endFill();

    // Shoulder pauldrons
    this.bodyGfx.beginFill(bodyColor);
    this.bodyGfx.drawEllipse(-13, -2, 6, 5);
    this.bodyGfx.drawEllipse(13, -2, 6, 5);
    this.bodyGfx.endFill();

    // Chest plate
    this.bodyGfx.beginFill(bodyColor);
    this.bodyGfx.drawRoundedRect(-10, -5, 20, 20, 5);
    this.bodyGfx.endFill();

    // Chest sheen (left highlight)
    this.bodyGfx.beginFill(sheen, 0.4);
    this.bodyGfx.drawRoundedRect(-9, -4, 8, 14, 4);
    this.bodyGfx.endFill();

    // Emblem on chest
    this.bodyGfx.beginFill(accentColor, 0.7);
    this.bodyGfx.drawPolygon([0, -2, 3, 2, 0, 6, -3, 2]);
    this.bodyGfx.endFill();

    // Belt
    this.bodyGfx.beginFill(0x221100, 0.6);
    this.bodyGfx.drawRect(-10, 11, 20, 4);
    this.bodyGfx.endFill();
    this.bodyGfx.beginFill(glowColor, 0.3);
    this.bodyGfx.drawRect(-3, 11, 6, 4);
    this.bodyGfx.endFill();

    // ── Head / Helmet ─────────────────────────────────────────────────────────
    // Helmet base
    this.bodyGfx.beginFill(bodyColor);
    this.bodyGfx.drawCircle(0, -17, 10);
    this.bodyGfx.endFill();

    // Crest ridge on top
    this.bodyGfx.beginFill(accentColor, 0.8);
    this.bodyGfx.drawRoundedRect(-2, -28, 4, 12, 2);
    this.bodyGfx.endFill();
    this.bodyGfx.beginFill(glowColor, 0.5);
    this.bodyGfx.drawRoundedRect(-1, -28, 2, 8, 1);
    this.bodyGfx.endFill();

    // Visor slit
    this.bodyGfx.beginFill(0x001122, 0.75);
    this.bodyGfx.drawRoundedRect(-8, -20, 16, 5, 2);
    this.bodyGfx.endFill();

    // Glowing eyes through visor
    this.bodyGfx.beginFill(glowColor, 0.4);
    this.bodyGfx.drawCircle(-4, -19, 3.5);
    this.bodyGfx.drawCircle(4, -19, 3.5);
    this.bodyGfx.endFill();
    this.bodyGfx.beginFill(glowColor);
    this.bodyGfx.drawCircle(-4, -19, 2);
    this.bodyGfx.drawCircle(4, -19, 2);
    this.bodyGfx.endFill();
    // Eye highlight
    this.bodyGfx.beginFill(0xffffff, 0.7);
    this.bodyGfx.drawCircle(-3.5, -19.5, 0.7);
    this.bodyGfx.drawCircle(4.5, -19.5, 0.7);
    this.bodyGfx.endFill();

    // Cheek guards
    this.bodyGfx.beginFill(bodyColor);
    this.bodyGfx.drawRoundedRect(-10, -22, 3, 8, 2);
    this.bodyGfx.drawRoundedRect(7, -22, 3, 8, 2);
    this.bodyGfx.endFill();

    // ── Sword ─────────────────────────────────────────────────────────────────
    // Drawn in world-facing direction (unaffected by bodyGfx scale flip)
    const sx1 = this.facingX * 12, sy1 = this.facingY * 12;
    const sx2 = this.facingX * 28, sy2 = this.facingY * 28;
    // Sword glow
    this.bodyGfx.lineStyle(7, accentColor, 0.18);
    this.bodyGfx.moveTo(sx1, sy1); this.bodyGfx.lineTo(sx2, sy2);
    // Blade
    this.bodyGfx.lineStyle(3, 0xffee66, 0.95);
    this.bodyGfx.moveTo(sx1, sy1); this.bodyGfx.lineTo(sx2, sy2);
    // Shine
    this.bodyGfx.lineStyle(1.5, 0xffffff, 0.6);
    this.bodyGfx.moveTo(sx1, sy1); this.bodyGfx.lineTo(sx2 - this.facingX * 4, sy2 - this.facingY * 4);
    // Guard
    const perpX = -this.facingY, perpY = this.facingX;
    this.bodyGfx.lineStyle(3, 0xcc8800, 0.9);
    this.bodyGfx.moveTo(sx1 + perpX * 7, sy1 + perpY * 7);
    this.bodyGfx.lineTo(sx1 - perpX * 7, sy1 - perpY * 7);
    this.bodyGfx.lineStyle(0);

    // ── Attack effects ────────────────────────────────────────────────────────
    this.attackGfx.clear();

    // Dash speed lines
    if (dashing) {
      for (let i = 0; i < 4; i++) {
        const offset = (i - 1.5) * 7;
        const perpLx = -this.facingY;
        const perpLy = this.facingX;
        const lx = -this.facingX * (8 + i * 5) + perpLx * offset;
        const ly = -this.facingY * (8 + i * 5) + perpLy * offset;
        const len = 14 + i * 2;
        const alpha = 0.55 - i * 0.1;
        this.attackGfx.lineStyle(2, 0x44eeff, alpha);
        this.attackGfx.moveTo(lx, ly);
        this.attackGfx.lineTo(lx - this.facingX * len, ly - this.facingY * len);
      }
    }

    // Fire spin visual
    if (this.fireSpinActive) {
      const spinProgress = 1 - this.fireSpinTimer / 0.5;
      const spinAngle = spinProgress * Math.PI * 4;
      const r = this.attackRange * 1.2;
      const fade = 1 - spinProgress;

      // Outer ring
      this.attackGfx.lineStyle(2, 0xff6600, 0.35 * fade);
      this.attackGfx.drawCircle(0, 0, r);

      for (let i = 0; i < 8; i++) {
        const a = spinAngle + (i / 8) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        this.attackGfx.lineStyle(0);
        this.attackGfx.beginFill(0xff6600, 0.55 * fade);
        this.attackGfx.drawCircle(px, py, 7 - i * 0.5);
        this.attackGfx.endFill();
        // Trail dot
        const a2 = a - 0.3;
        this.attackGfx.beginFill(0xff9922, 0.3 * fade);
        this.attackGfx.drawCircle(Math.cos(a2) * r, Math.sin(a2) * r, 4);
        this.attackGfx.endFill();
      }
    }

    // Attack slash arc
    if (this.attackDuration > 0) {
      const r = this.attackRange * 0.55;
      const progress = this.attackDuration / 0.14;
      const baseAngle = Math.atan2(this.facingY, this.facingX);
      const sweepStart = baseAngle - 0.85;
      const sweepEnd = baseAngle + 0.85;
      const currentSweep = sweepStart + (sweepEnd - sweepStart) * (1 - progress);

      // Outer glow arc
      this.attackGfx.lineStyle(12, accentColor, 0.18 * progress);
      this.attackGfx.arc(0, 0, r * 0.82, sweepStart, currentSweep);
      // Mid glow
      this.attackGfx.lineStyle(6, accentColor, 0.35 * progress);
      this.attackGfx.arc(0, 0, r * 0.82, sweepStart, currentSweep);
      // Core white slash
      this.attackGfx.lineStyle(3, 0xffffff, 0.92 * progress);
      this.attackGfx.arc(0, 0, r * 0.82, sweepStart, currentSweep);

      // Impact tip glow
      const tipX = Math.cos(currentSweep) * r * 0.82;
      const tipY = Math.sin(currentSweep) * r * 0.82;
      this.attackGfx.lineStyle(0);
      this.attackGfx.beginFill(0xffffff, 0.9 * progress);
      this.attackGfx.drawCircle(tipX, tipY, 5 * progress);
      this.attackGfx.endFill();
      this.attackGfx.beginFill(accentColor, 0.5 * progress);
      this.attackGfx.drawCircle(tipX, tipY, 9 * progress);
      this.attackGfx.endFill();

      // Center hitbox glow
      const ax = this.facingX * this.attackRange * 0.6;
      const ay = this.facingY * this.attackRange * 0.6;
      this.attackGfx.beginFill(accentColor, 0.15 * progress);
      this.attackGfx.drawCircle(ax, ay, r * 0.55);
      this.attackGfx.endFill();
    }
  }
}
