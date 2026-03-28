import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '../../input';
import type { WorldMap } from '../maps/WorldMap';
import type { SkillStats } from '../Skills';

/** Afterimage entry for dash trail */
interface Afterimage {
  x: number;
  y: number;
  scaleX: number;
  alpha: number;
  gfx: Sprite;
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
  readonly comboWindow = 2.0; // seconds to keep combo alive

  // Fire spin (skill)
  fireSpinActive = false;
  fireSpinTimer = 0;

  private sprite: Sprite;
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
  crystalBuffTime = 0; // temporary damage boost

  constructor(x: number, y: number, skillStats: SkillStats) {
    this.x = x;
    this.y = y;
    this.skills = skillStats;
    this.hp = this.maxHp;

    this.container = new Container();

    // Drop shadow
    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);

    // Attack effect layer (below sprite)
    this.attackGfx = new Graphics();
    this.container.addChild(this.attackGfx);

    // Character sprite
    this.sprite = new Sprite(Texture.from('./images/player.png'));
    this.sprite.anchor.set(0.5);
    this.sprite.width = this.w;
    this.sprite.height = this.h;
    this.container.addChild(this.sprite);

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
    // Combo multiplier: up to 2x at 10+ combo
    const comboMult = 1 + Math.min(this.comboCount * 0.1, 1.0);
    dmg *= comboMult;
    // Crystal buff
    if (this.crystalBuffTime > 0) dmg *= 1.5;
    // Crit
    const isCrit = Math.random() < this.skills.critChance;
    if (isCrit) dmg *= this.skills.critMult;
    return { damage: Math.round(dmg), isCrit };
  }

  update(dt: number, input: InputManager, map: WorldMap) {
    // Timers
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.comboCount = 0;
    this.crystalBuffTime = Math.max(0, this.crystalBuffTime - dt);
    this.fireSpinTimer = Math.max(0, this.fireSpinTimer - dt);
    if (this.fireSpinTimer <= 0) this.fireSpinActive = false;

    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (input.skillPressed && this.dashCooldown <= 0 && this.dashTime <= 0) {
      // Check if fire spin skill is available
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
      ai.alpha = Math.max(0, ai.life / 0.15) * 0.5;
      ai.gfx.alpha = ai.alpha;
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
    const ai = new Sprite(Texture.from('./images/player.png'));
    ai.anchor.set(0.5);
    ai.width = this.w;
    ai.height = this.h;
    ai.tint = 0x88eeff;
    ai.alpha = 0.5;
    ai.x = 0;
    ai.y = 0;
    ai.scale.x = this.facingX < -0.3 ? -Math.abs(ai.scale.x) : Math.abs(ai.scale.x);

    // Insert at beginning so it's behind the player sprite
    this.container.addChildAt(ai, 0);

    this.afterimages.push({
      x: this.x,
      y: this.y,
      scaleX: ai.scale.x,
      alpha: 0.5,
      gfx: ai,
      life: 0.15,
    });
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
    // Reset combo on taking damage
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
    this.shadowGfx.beginFill(0x000000, 0.3);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.4, 5);
    this.shadowGfx.endFill();

    // Sprite appearance
    this.sprite.alpha = flicker ? 0.2 : 1.0;

    // Tint based on state
    if (this.crystalBuffTime > 0) {
      this.sprite.tint = 0xffdd44; // golden when buffed
    } else if (this.fireSpinActive) {
      this.sprite.tint = 0xff6622;
    } else if (dashing) {
      this.sprite.tint = 0x88eeff;
    } else if (this.attackDuration > 0) {
      this.sprite.tint = 0xffee88;
    } else {
      this.sprite.tint = 0xffffff;
    }

    // Flip sprite based on facing direction
    this.sprite.scale.x = this.facingX < -0.3 ? -Math.abs(this.sprite.scale.x) : Math.abs(this.sprite.scale.x);

    // Bob animation when moving
    const bobY = Math.sin(this.bobTimer) * 2;
    this.sprite.y = bobY;

    // Attack & effects
    this.attackGfx.clear();

    // Dash speed lines
    if (dashing) {
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 8;
        const perpX = -this.facingY;
        const perpY = this.facingX;
        const lx = -this.facingX * (10 + i * 6) + perpX * offset;
        const ly = -this.facingY * (10 + i * 6) + perpY * offset;
        const alpha = 0.6 - i * 0.15;
        this.attackGfx.lineStyle(2, 0x88eeff, alpha);
        this.attackGfx.moveTo(lx, ly);
        this.attackGfx.lineTo(lx - this.facingX * 12, ly - this.facingY * 12);
      }
    }

    // Fire spin visual
    if (this.fireSpinActive) {
      const spinProgress = 1 - this.fireSpinTimer / 0.5;
      const spinAngle = spinProgress * Math.PI * 4;
      const r = this.attackRange * 1.2;

      // Spinning fire trail
      for (let i = 0; i < 6; i++) {
        const a = spinAngle + (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        const alpha = 0.6 * (1 - spinProgress);
        this.attackGfx.beginFill(0xff4400, alpha);
        this.attackGfx.drawCircle(px, py, 8 - i);
        this.attackGfx.endFill();
      }

      // Circle outline
      this.attackGfx.lineStyle(2, 0xff6600, 0.4 * (1 - spinProgress));
      this.attackGfx.drawCircle(0, 0, r);
    }

    // Attack slash arc - improved sword slash visual
    if (this.attackDuration > 0) {
      const ax = this.facingX * this.attackRange * 0.6;
      const ay = this.facingY * this.attackRange * 0.6;
      const r = this.attackRange * 0.55;
      const progress = this.attackDuration / 0.14;

      // Slash arc (sweeping motion)
      const baseAngle = Math.atan2(this.facingY, this.facingX);
      const sweepStart = baseAngle - 0.8;
      const sweepEnd = baseAngle + 0.8;
      const currentSweep = sweepStart + (sweepEnd - sweepStart) * (1 - progress);

      // Bright slash trail
      this.attackGfx.lineStyle(4, 0xffffff, 0.9 * progress);
      this.attackGfx.arc(0, 0, r * 0.85, sweepStart, currentSweep);

      // Outer glow
      this.attackGfx.lineStyle(8, 0xffee44, 0.3 * progress);
      this.attackGfx.arc(0, 0, r * 0.85, sweepStart, currentSweep);

      // Impact point glow
      const tipX = Math.cos(currentSweep) * r * 0.85;
      const tipY = Math.sin(currentSweep) * r * 0.85;
      this.attackGfx.beginFill(0xffffff, 0.8 * progress);
      this.attackGfx.drawCircle(tipX, tipY, 5 * progress);
      this.attackGfx.endFill();

      // Glow at center of hitbox
      this.attackGfx.beginFill(0xffee44, 0.2 * progress);
      this.attackGfx.drawCircle(ax, ay, r * 0.6);
      this.attackGfx.endFill();
    }
  }
}
