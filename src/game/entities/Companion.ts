import { Graphics, Container } from 'pixi.js';
import type { Player } from './Player';
import type { Enemy } from './Enemy';
import type { WorldMap } from '../maps/WorldMap';

type CompanionState = 'follow' | 'attack' | 'downed' | 'reviving';

export class Companion {
  x: number;
  y: number;
  readonly w = 32;
  readonly h = 32;

  hp: number;
  maxHp = 60;
  attackDamage = 10;
  attackRange = 48;
  attackCooldown = 0;
  attackDuration = 0;
  invincibleTime = 0;
  speed = 160;

  state: CompanionState = 'follow';
  downedTimer = 0;
  reviveTimer = 0;
  targetEnemy: Enemy | null = null;

  facingX = 1;
  facingY = 0;

  // Knockback
  kbVx = 0;
  kbVy = 0;

  readonly container: Container;
  private bodyGfx: Graphics;
  private attackGfx: Graphics;
  private shadowGfx: Graphics;
  private hpBarGfx: Graphics;

  // Animation
  private bobTimer = 0;
  private floatTimer = 0;
  private hitFlash = 0;

  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;

    this.container = new Container();

    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);

    this.attackGfx = new Graphics();
    this.container.addChild(this.attackGfx);

    this.bodyGfx = new Graphics();
    this.container.addChild(this.bodyGfx);

    this.hpBarGfx = new Graphics();
    this.container.addChild(this.hpBarGfx);

    this.render();
  }

  /** Scale companion stats with player level */
  syncWithPlayer(player: Player) {
    this.maxHp = 60 + player.level * 8;
    this.attackDamage = 10 + player.level * 3;
    this.speed = 160 + player.level * 4;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  update(dt: number, player: Player, enemies: Enemy[], map: WorldMap) {
    this.invincibleTime = Math.max(0, this.invincibleTime - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackDuration = Math.max(0, this.attackDuration - dt);
    this.floatTimer += dt * 3;

    // Knockback
    if (Math.abs(this.kbVx) > 1 || Math.abs(this.kbVy) > 1) {
      const nx = this.x + this.kbVx * dt;
      const ny = this.y + this.kbVy * dt;
      if (!map.isColliding(nx, this.y, this.w, this.h)) this.x = nx;
      if (!map.isColliding(this.x, ny, this.w, this.h)) this.y = ny;
      this.kbVx *= Math.max(0, 1 - dt * 8);
      this.kbVy *= Math.max(0, 1 - dt * 8);
    }

    switch (this.state) {
      case 'downed':
        this.downedTimer -= dt;
        if (this.downedTimer <= 0) {
          this.state = 'reviving';
          this.reviveTimer = 1.0;
        }
        break;

      case 'reviving':
        this.reviveTimer -= dt;
        if (this.reviveTimer <= 0) {
          this.state = 'follow';
          this.hp = Math.round(this.maxHp * 0.5);
          this.invincibleTime = 2.0;
          this.dead = false;
        }
        break;

      case 'follow':
      case 'attack': {
        // Find nearest alive enemy within detection range
        let nearestEnemy: Enemy | null = null;
        let nearestDist = 200;
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = e;
          }
        }

        if (nearestEnemy) {
          this.state = 'attack';
          this.targetEnemy = nearestEnemy;

          // Move toward enemy
          const dx = nearestEnemy.x - this.x;
          const dy = nearestEnemy.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            this.facingX = dx / dist;
            this.facingY = dy / dist;
          }

          if (dist > this.attackRange * 0.7) {
            const mx = (dx / dist) * this.speed * dt;
            const my = (dy / dist) * this.speed * dt;
            if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
            if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
          }
        } else {
          this.state = 'follow';
          this.targetEnemy = null;

          // Follow player (stay behind player facing direction)
          const followX = player.x - player.facingX * 50;
          const followY = player.y - player.facingY * 50;
          const dx = followX - this.x;
          const dy = followY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 60) {
            if (dist > 1) {
              this.facingX = dx / dist;
              this.facingY = dy / dist;
            }
            const spd = dist > 200 ? this.speed * 1.5 : this.speed;
            const mx = (dx / dist) * spd * dt;
            const my = (dy / dist) * spd * dt;
            if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
            if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
          }

          // Teleport if too far from player
          if (dist > 400) {
            this.x = player.x - player.facingX * 40;
            this.y = player.y - player.facingY * 40;
          }
        }
        break;
      }
    }

    this.bobTimer += (this.state === 'follow' || this.state === 'attack') ? dt * 8 : 0;

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  /** Get attack hitbox (returns null if not attacking) */
  getAttackHitbox(): { cx: number; cy: number; r: number } | null {
    if (this.state !== 'attack' || this.attackCooldown > 0 || !this.targetEnemy || this.dead) return null;
    if (this.targetEnemy.dead) return null;

    const dx = this.targetEnemy.x - this.x;
    const dy = this.targetEnemy.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.attackRange) return null;

    // Attack!
    this.attackCooldown = 0.8;
    this.attackDuration = 0.12;
    return {
      cx: this.x + this.facingX * this.attackRange * 0.5,
      cy: this.y + this.facingY * this.attackRange * 0.5,
      r: this.attackRange * 0.5,
    };
  }

  takeDamage(amount: number, fromX: number, fromY: number) {
    if (this.invincibleTime > 0 || this.state === 'downed' || this.state === 'reviving') return;

    this.hp -= amount;
    this.hitFlash = 0.15;
    this.invincibleTime = 0.8;

    // Knockback
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.kbVx = (dx / dist) * 200;
    this.kbVy = (dy / dist) * 200;

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'downed';
      this.dead = true;
      this.downedTimer = 5.0;
    }
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  private render() {
    const isDowned = this.state === 'downed';
    const isReviving = this.state === 'reviving';
    const flicker = this.invincibleTime > 0 && Math.floor(this.invincibleTime * 10) % 2 === 0;

    // Shadow
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, isDowned ? 0.15 : 0.25);
    this.shadowGfx.drawEllipse(0, 12, 10, 4);
    this.shadowGfx.endFill();

    // Body alpha
    this.bodyGfx.alpha = flicker ? 0.2 : isDowned ? 0.4 : isReviving ? (0.4 + 0.6 * (1 - this.reviveTimer)) : 1.0;
    this.bodyGfx.y = isDowned ? 6 : Math.sin(this.bobTimer) * 1.5;
    this.bodyGfx.rotation = isDowned ? 1.4 : 0;

    const isHit = this.hitFlash > 0;

    // Colors
    const bodyColor = isHit ? 0xffffff : 0xdd44aa;
    const accentColor = isHit ? 0xffffff : 0xff88cc;
    const hairColor = isHit ? 0xffffff : 0xffcc44;
    const eyeColor = isHit ? 0xffffff : 0x88eeff;

    const g = this.bodyGfx;
    g.clear();

    // Flip based on facing
    g.scale.x = this.facingX < -0.3 ? -1 : 1;

    const facingUp = this.facingY < -0.5;
    const facingDown = this.facingY > 0.5;

    if (facingUp) {
      // ── BACK VIEW ──
      // Hair (long ponytail)
      g.beginFill(hairColor, 0.9);
      g.drawEllipse(0, 6, 6, 16);
      g.endFill();

      // Body / dress
      g.beginFill(bodyColor);
      g.drawRoundedRect(-8, -2, 16, 16, 4);
      g.endFill();

      // Skirt flare
      g.beginFill(bodyColor);
      g.drawEllipse(0, 12, 10, 5);
      g.endFill();

      // Head
      g.beginFill(0xffddb8);
      g.drawCircle(0, -12, 8);
      g.endFill();

      // Hair top
      g.beginFill(hairColor);
      g.drawEllipse(0, -16, 9, 6);
      g.endFill();

      // Hair ribbon
      g.beginFill(0xff4488);
      g.drawRect(-2, -10, 4, 3);
      g.endFill();
    } else if (facingDown) {
      // ── FRONT VIEW ──
      // Hair behind
      g.beginFill(hairColor, 0.7);
      g.drawEllipse(0, 4, 10, 14);
      g.endFill();

      // Body / dress
      g.beginFill(bodyColor);
      g.drawRoundedRect(-8, -2, 16, 16, 4);
      g.endFill();
      g.beginFill(accentColor, 0.4);
      g.drawRoundedRect(-7, -1, 6, 10, 3);
      g.endFill();

      // Skirt
      g.beginFill(bodyColor);
      g.drawEllipse(0, 12, 10, 5);
      g.endFill();

      // Belt
      g.beginFill(0x664422, 0.6);
      g.drawRect(-8, 10, 16, 3);
      g.endFill();

      // Head (skin)
      g.beginFill(0xffddb8);
      g.drawCircle(0, -12, 8);
      g.endFill();

      // Hair top
      g.beginFill(hairColor);
      g.drawEllipse(0, -16, 9, 6);
      g.endFill();
      // Bangs
      g.beginFill(hairColor);
      g.drawEllipse(-4, -12, 5, 3);
      g.drawEllipse(4, -12, 5, 3);
      g.endFill();

      // Eyes
      g.beginFill(eyeColor, 0.4);
      g.drawCircle(-3, -13, 3);
      g.drawCircle(3, -13, 3);
      g.endFill();
      g.beginFill(eyeColor);
      g.drawCircle(-3, -13, 1.8);
      g.drawCircle(3, -13, 1.8);
      g.endFill();
      g.beginFill(0xffffff, 0.7);
      g.drawCircle(-2.5, -13.5, 0.6);
      g.drawCircle(3.5, -13.5, 0.6);
      g.endFill();

      // Mouth
      g.beginFill(0xee7788, 0.5);
      g.drawEllipse(0, -9, 1.5, 0.8);
      g.endFill();

      // Hair ribbon
      g.beginFill(0xff4488);
      g.drawRect(-2, -10, 4, 3);
      g.endFill();
    } else {
      // ── SIDE VIEW ──
      // Hair trailing behind
      g.beginFill(hairColor, 0.8);
      g.drawEllipse(-4, 4, 7, 14);
      g.endFill();

      // Body
      g.beginFill(bodyColor);
      g.drawRoundedRect(-6, -2, 14, 16, 4);
      g.endFill();
      g.beginFill(accentColor, 0.35);
      g.drawRoundedRect(1, -1, 5, 10, 3);
      g.endFill();

      // Skirt
      g.beginFill(bodyColor);
      g.drawEllipse(0, 12, 9, 5);
      g.endFill();

      // Head
      g.beginFill(0xffddb8);
      g.drawCircle(0, -12, 8);
      g.endFill();

      // Hair side
      g.beginFill(hairColor);
      g.drawEllipse(-2, -16, 8, 6);
      g.endFill();
      // Bangs
      g.beginFill(hairColor);
      g.drawEllipse(3, -12, 4, 3);
      g.endFill();

      // Eye (single side)
      g.beginFill(eyeColor, 0.4);
      g.drawCircle(3, -13, 3);
      g.endFill();
      g.beginFill(eyeColor);
      g.drawCircle(3, -13, 1.8);
      g.endFill();
      g.beginFill(0xffffff, 0.7);
      g.drawCircle(3.5, -13.5, 0.6);
      g.endFill();

      // Hair ribbon
      g.beginFill(0xff4488);
      g.drawRect(-1, -10, 3, 3);
      g.endFill();
    }

    // ── Dagger ──
    if (!isDowned) {
      const sx1 = this.facingX * 10, sy1 = this.facingY * 10;
      const sx2 = this.facingX * 22, sy2 = this.facingY * 22;
      // Glow
      g.lineStyle(5, accentColor, 0.15);
      g.moveTo(sx1, sy1); g.lineTo(sx2, sy2);
      // Blade
      g.lineStyle(2, 0xeeddff, 0.9);
      g.moveTo(sx1, sy1); g.lineTo(sx2, sy2);
      // Shine
      g.lineStyle(1, 0xffffff, 0.5);
      g.moveTo(sx1, sy1); g.lineTo(sx2 - this.facingX * 3, sy2 - this.facingY * 3);
      g.lineStyle(0);
    }

    // ── Attack effect ──
    this.attackGfx.clear();
    if (this.attackDuration > 0 && !isDowned) {
      const r = this.attackRange * 0.45;
      const progress = this.attackDuration / 0.12;
      const baseAngle = Math.atan2(this.facingY, this.facingX);
      const sweepStart = baseAngle - 0.7;
      const sweepEnd = baseAngle + 0.7;
      const currentSweep = sweepStart + (sweepEnd - sweepStart) * (1 - progress);

      this.attackGfx.lineStyle(4, accentColor, 0.3 * progress);
      this.attackGfx.arc(0, 0, r * 0.8, sweepStart, currentSweep);
      this.attackGfx.lineStyle(2, 0xffffff, 0.8 * progress);
      this.attackGfx.arc(0, 0, r * 0.8, sweepStart, currentSweep);

      const tipX = Math.cos(currentSweep) * r * 0.8;
      const tipY = Math.sin(currentSweep) * r * 0.8;
      this.attackGfx.lineStyle(0);
      this.attackGfx.beginFill(0xffffff, 0.7 * progress);
      this.attackGfx.drawCircle(tipX, tipY, 3 * progress);
      this.attackGfx.endFill();
    }

    // ── HP Bar ──
    this.hpBarGfx.clear();
    const hpRatio = this.hp / this.maxHp;
    if (!isDowned && !isReviving && hpRatio < 1) {
      const bw = 26, bh = 4, bx = -bw / 2, by = -22;
      this.hpBarGfx.beginFill(0x111111, 0.6);
      this.hpBarGfx.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 2);
      this.hpBarGfx.endFill();
      const fc = hpRatio > 0.5 ? 0x44ddaa : hpRatio > 0.25 ? 0xffcc00 : 0xff3322;
      this.hpBarGfx.beginFill(fc);
      this.hpBarGfx.drawRoundedRect(bx, by, bw * hpRatio, bh, 2);
      this.hpBarGfx.endFill();
    }

    // Downed indicator
    if (isDowned) {
      const reviveProgress = 1 - this.downedTimer / 5.0;
      const barW = 30, barH = 4;
      this.hpBarGfx.beginFill(0x222222, 0.6);
      this.hpBarGfx.drawRoundedRect(-barW / 2 - 1, -22, barW + 2, barH + 2, 2);
      this.hpBarGfx.endFill();
      this.hpBarGfx.beginFill(0x44ddaa, 0.7);
      this.hpBarGfx.drawRoundedRect(-barW / 2, -21, barW * reviveProgress, barH, 2);
      this.hpBarGfx.endFill();
    }
  }
}
