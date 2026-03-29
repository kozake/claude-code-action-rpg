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

  // Magic attack
  magicCooldown = 0;
  private readonly magicDetectRange = 200;
  private readonly magicCooldownMax = 1.2;
  private readonly magicBulletSpeed = 280;
  /** Called when companion fires a magic shot. Set by GameScene. */
  onFireMagic?: (x: number, y: number, vx: number, vy: number, damage: number) => void;

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
  private sparkleTimer = 0;
  private attackExpressionTimer = 0;

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
    this.magicCooldown = Math.max(0, this.magicCooldown - dt);
    this.attackExpressionTimer = Math.max(0, this.attackExpressionTimer - dt);
    this.floatTimer += dt * 3;
    this.sparkleTimer += dt * 2.5;

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
        let nearestDist = this.magicDetectRange;
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

          const dx = nearestEnemy.x - this.x;
          const dy = nearestEnemy.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            this.facingX = dx / dist;
            this.facingY = dy / dist;
          }

          if (dist <= this.attackRange) {
            // Close enough for melee — stay in place (attack handled by getAttackHitbox)
          } else if (dist > this.attackRange && dist <= this.magicDetectRange) {
            // Out of melee but within magic range — fire magic and hold position
            if (this.magicCooldown <= 0 && this.onFireMagic) {
              const speed = this.magicBulletSpeed;
              this.onFireMagic(
                this.x, this.y,
                (dx / dist) * speed,
                (dy / dist) * speed,
                this.attackDamage,
              );
              this.magicCooldown = this.magicCooldownMax;
              this.attackExpressionTimer = 0.35;
            }
            // Maintain a comfortable distance (don't walk into melee range)
            const idealDist = this.attackRange * 1.8;
            if (dist > idealDist + 20) {
              const mx = (dx / dist) * this.speed * dt;
              const my = (dy / dist) * this.speed * dt;
              if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
              if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
            }
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

  /** Get attack hitbox for melee (returns null if not in melee range or on cooldown) */
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
    this.attackExpressionTimer = 0.4;
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
    const isAttacking = this.state === 'attack';
    const flicker = this.invincibleTime > 0 && Math.floor(this.invincibleTime * 10) % 2 === 0;

    // Shadow
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, isDowned ? 0.15 : 0.25);
    this.shadowGfx.drawEllipse(0, 14, 11, 4);
    this.shadowGfx.endFill();

    // Body alpha & bob
    this.bodyGfx.alpha = flicker ? 0.2 : isDowned ? 0.4 : isReviving ? (0.4 + 0.6 * (1 - this.reviveTimer)) : 1.0;
    this.bodyGfx.y = isDowned ? 6 : Math.sin(this.bobTimer) * 2.2;
    this.bodyGfx.rotation = isDowned ? 1.4 : 0;

    const isHit = this.hitFlash > 0;

    // Color palette
    const bodyColor   = isHit ? 0xffffff : 0xee44bb;
    const accentColor = isHit ? 0xffffff : 0xff99dd;
    const frillColor  = isHit ? 0xffffff : 0xffbbee;
    const hairColor   = isHit ? 0xffffff : 0xffdd44;
    const hairHi      = isHit ? 0xffffff : 0xfff4aa;
    const skinColor   = 0xffddb8;
    const eyeColor    = isHit ? 0xffffff : 0x44ddaa;
    const eyeInner    = isHit ? 0xffffff : 0x22bb88;
    const blushColor  = 0xff9999;

    const g = this.bodyGfx;
    g.clear();

    // Flip based on facing direction
    g.scale.x = this.facingX < -0.3 ? -1 : 1;

    const facingUp   = this.facingY < -0.5;
    const facingDown = this.facingY > 0.5;

    // ══════════════════════════════════════════════════════════════
    if (facingUp) {
      // ── BACK VIEW ──

      // Ponytail (curved, fluffy)
      g.beginFill(hairColor, 0.85);
      g.moveTo(-4, -8);
      g.bezierCurveTo(-10, 2, -7, 16, 0, 20);
      g.bezierCurveTo(7, 16, 10, 2, 4, -8);
      g.closePath();
      g.endFill();
      // Ponytail highlight
      g.beginFill(hairHi, 0.5);
      g.moveTo(-1, -6);
      g.bezierCurveTo(-5, 3, -3, 12, 0, 14);
      g.bezierCurveTo(1, 10, 1, 3, 1, -6);
      g.closePath();
      g.endFill();

      // Dress (back)
      g.beginFill(bodyColor);
      g.drawRoundedRect(-9, -2, 18, 17, 5);
      g.endFill();
      // Back bow
      g.beginFill(0xff4488);
      g.drawPolygon([-5, 4, 0, 8, 5, 4, 0, 0]);
      g.endFill();
      g.beginFill(0xff77aa);
      g.drawCircle(0, 4, 2.2);
      g.endFill();

      // Skirt with frill scallops
      g.beginFill(bodyColor);
      g.drawEllipse(0, 13, 11, 5.5);
      g.endFill();
      g.beginFill(frillColor, 0.7);
      for (let i = -2; i <= 2; i++) {
        g.drawCircle(i * 4.2, 16.5, 3.2);
      }
      g.endFill();

      // Head
      g.beginFill(skinColor);
      g.drawCircle(0, -11, 9);
      g.endFill();

      // Hair (back top, fluffy)
      g.beginFill(hairColor);
      g.drawEllipse(0, -17, 11, 7.5);
      g.drawEllipse(-6, -16, 7, 5);
      g.drawEllipse(6, -16, 7, 5);
      g.endFill();
      g.beginFill(hairHi, 0.5);
      g.drawEllipse(-2, -20, 5, 3);
      g.endFill();

      // Big bow ribbon
      g.beginFill(0xff4488);
      g.drawPolygon([-8, -15, -3, -13, -3, -19, -8, -17]);
      g.drawPolygon([8, -15, 3, -13, 3, -19, 8, -17]);
      g.endFill();
      g.beginFill(0xff77aa);
      g.drawCircle(0, -15, 2.8);
      g.endFill();

    // ══════════════════════════════════════════════════════════════
    } else if (facingDown) {
      // ── FRONT VIEW ──

      // Hair behind (fluffy, layered)
      g.beginFill(hairColor, 0.55);
      g.drawEllipse(0, 1, 13, 17);
      g.endFill();
      g.beginFill(hairColor, 0.7);
      g.drawEllipse(-10, 0, 6, 13);
      g.drawEllipse(10, 0, 6, 13);
      g.endFill();

      // Dress body
      g.beginFill(bodyColor);
      g.drawRoundedRect(-9, -3, 18, 18, 5);
      g.endFill();
      // Dress highlight panel
      g.beginFill(accentColor, 0.5);
      g.drawRoundedRect(-6, -1, 12, 12, 4);
      g.endFill();
      // Chest bow
      g.beginFill(0xff4488);
      g.drawPolygon([-3.5, 1, 0, 4.5, 3.5, 1, 0, -1.5]);
      g.endFill();
      g.beginFill(0xff77aa);
      g.drawCircle(0, 1.5, 2);
      g.endFill();

      // Skirt frill
      g.beginFill(bodyColor);
      g.drawEllipse(0, 13, 12, 6);
      g.endFill();
      g.beginFill(frillColor, 0.75);
      for (let i = -2; i <= 2; i++) {
        g.drawCircle(i * 4.5, 17, 3.5);
      }
      g.endFill();

      // Head (skin)
      g.beginFill(skinColor);
      g.drawCircle(0, -11, 9.5);
      g.endFill();

      // Hair top (fluffy, multi-layer)
      g.beginFill(hairColor);
      g.drawEllipse(0, -18, 11, 8);
      g.drawEllipse(-6, -17, 7, 6);
      g.drawEllipse(6, -17, 7, 6);
      g.endFill();
      g.beginFill(hairHi, 0.55);
      g.drawEllipse(-3, -21, 6, 3.5);
      g.endFill();
      // Bangs (overlapping, curved)
      g.beginFill(hairColor);
      g.drawEllipse(-4.5, -13, 6, 4.5);
      g.drawEllipse(4.5, -13, 6, 4.5);
      g.drawEllipse(0, -14, 5, 4);
      g.endFill();

      // ── Anime eyes ──
      if (!isHit) {
        // Eye whites
        g.beginFill(0xffffff, 0.92);
        g.drawEllipse(-3.8, -12.5, 5, 6);
        g.drawEllipse(3.8, -12.5, 5, 6);
        g.endFill();
        // Iris outer
        g.beginFill(eyeColor);
        g.drawEllipse(-3.8, -12.5, 4, 5.2);
        g.drawEllipse(3.8, -12.5, 4, 5.2);
        g.endFill();
        // Iris inner
        g.beginFill(eyeInner);
        g.drawEllipse(-3.8, -13, 2.8, 3.8);
        g.drawEllipse(3.8, -13, 2.8, 3.8);
        g.endFill();
        // Pupil
        g.beginFill(0x112233);
        g.drawEllipse(-3.8, -13, 1.8, 2.8);
        g.drawEllipse(3.8, -13, 1.8, 2.8);
        g.endFill();
        // Main highlight (large)
        g.beginFill(0xffffff, 0.95);
        g.drawCircle(-5.2, -14.2, 1.4);
        g.drawCircle(2.4, -14.2, 1.4);
        g.endFill();
        // Secondary highlight (small)
        g.beginFill(0xffffff, 0.65);
        g.drawCircle(-3, -12.2, 0.7);
        g.drawCircle(5.6, -12.2, 0.7);
        g.endFill();
        // Eyelashes (top)
        g.lineStyle(1.3, 0x223344, 0.85);
        g.moveTo(-7.5, -15.5); g.lineTo(-6.5, -17.2);
        g.moveTo(-3.8, -16.5); g.lineTo(-3.8, -18.2);
        g.moveTo(-0.5, -15.5); g.lineTo(-0.8, -17);
        g.moveTo(0.5, -15.5);  g.lineTo(0.8, -17);
        g.moveTo(3.8, -16.5);  g.lineTo(3.8, -18.2);
        g.moveTo(7.5, -15.5);  g.lineTo(6.5, -17.2);
        g.lineStyle(0);
      } else {
        g.beginFill(0xffffff, 0.92);
        g.drawCircle(-3.8, -12.5, 4.5);
        g.drawCircle(3.8, -12.5, 4.5);
        g.endFill();
      }

      // ── Cheek blush ──
      if (!isHit) {
        g.beginFill(blushColor, 0.32);
        g.drawEllipse(-6.5, -9, 4, 2.2);
        g.drawEllipse(6.5, -9, 4, 2.2);
        g.endFill();
      }

      // ── Mouth ──
      if (!isHit) {
        if (isAttacking && this.attackExpressionTimer > 0) {
          // Determined expression
          g.lineStyle(1.5, 0xcc4466, 0.9);
          g.moveTo(-2.5, -7.5); g.lineTo(2.5, -7.5);
          g.lineStyle(0);
        } else {
          // Cute smile
          g.lineStyle(1.5, 0xdd5577, 0.85);
          g.arc(0, -8.5, 2.5, 0.25, Math.PI - 0.25);
          g.lineStyle(0);
        }
      }

      // Hair ribbon (big cute bow at top)
      g.beginFill(0xff4488);
      g.drawPolygon([-9, -17, -3.5, -15, -3.5, -21, -9, -19]);
      g.drawPolygon([9, -17, 3.5, -15, 3.5, -21, 9, -19]);
      g.endFill();
      g.beginFill(0xff77aa);
      g.drawCircle(0, -17, 3);
      g.endFill();

      // ── Magic orbiting sparkles when attacking ──
      if (isAttacking && !isDowned && !isHit) {
        for (let i = 0; i < 3; i++) {
          const angle = this.sparkleTimer + (i * Math.PI * 2) / 3;
          const sx = Math.cos(angle) * 20;
          const sy = Math.sin(angle) * 11 - 2;
          // Hand-drawn 4-point star
          const or = 3.5, ir = 1.5;
          g.beginFill(0xff88ff, 0.8);
          g.drawPolygon([
            sx,       sy - or,
            sx + ir,  sy - ir,
            sx + or,  sy,
            sx + ir,  sy + ir,
            sx,       sy + or,
            sx - ir,  sy + ir,
            sx - or,  sy,
            sx - ir,  sy - ir,
          ]);
          g.endFill();
          // Tiny glow
          g.beginFill(0xffffff, 0.4);
          g.drawCircle(sx, sy, 1.5);
          g.endFill();
        }
      }

    // ══════════════════════════════════════════════════════════════
    } else {
      // ── SIDE VIEW ──

      // Hair trailing behind (fluffy, multi-layer)
      g.beginFill(hairColor, 0.7);
      g.drawEllipse(-6, 1, 9, 16);
      g.endFill();
      g.beginFill(hairColor, 0.5);
      g.drawEllipse(-8, -3, 7, 10);
      g.endFill();
      g.beginFill(hairHi, 0.45);
      g.drawEllipse(-5, 0, 5, 9);
      g.endFill();

      // Body (side)
      g.beginFill(bodyColor);
      g.drawRoundedRect(-7, -3, 15, 18, 5);
      g.endFill();
      g.beginFill(accentColor, 0.45);
      g.drawRoundedRect(1, -1, 5.5, 11, 3);
      g.endFill();

      // Skirt frill (side)
      g.beginFill(bodyColor);
      g.drawEllipse(0, 13, 10.5, 5.5);
      g.endFill();
      g.beginFill(frillColor, 0.7);
      for (let i = -2; i <= 2; i++) {
        g.drawCircle(i * 4, 16.5, 3);
      }
      g.endFill();

      // Head
      g.beginFill(skinColor);
      g.drawCircle(1, -11, 9);
      g.endFill();

      // Hair top (side)
      g.beginFill(hairColor);
      g.drawEllipse(-2, -18, 10, 7.5);
      g.endFill();
      g.beginFill(hairHi, 0.5);
      g.drawEllipse(-4, -20, 5.5, 3.5);
      g.endFill();
      // Bangs side
      g.beginFill(hairColor);
      g.drawEllipse(4.5, -13, 5.5, 4.5);
      g.drawEllipse(1, -14, 4.5, 4);
      g.endFill();

      // ── Eye (side, large anime-style) ──
      if (!isHit) {
        g.beginFill(0xffffff, 0.92);
        g.drawEllipse(4.2, -12.5, 4.5, 5.8);
        g.endFill();
        g.beginFill(eyeColor);
        g.drawEllipse(4.2, -12.5, 3.6, 4.8);
        g.endFill();
        g.beginFill(eyeInner);
        g.drawEllipse(4.2, -13, 2.4, 3.5);
        g.endFill();
        g.beginFill(0x112233);
        g.drawEllipse(4.2, -13, 1.5, 2.5);
        g.endFill();
        g.beginFill(0xffffff, 0.95);
        g.drawCircle(3, -14.2, 1.2);
        g.endFill();
        g.beginFill(0xffffff, 0.6);
        g.drawCircle(5.5, -12.2, 0.6);
        g.endFill();
        // Lashes
        g.lineStyle(1.3, 0x223344, 0.85);
        g.moveTo(1, -15.8); g.lineTo(1.5, -17.4);
        g.moveTo(4.2, -16.8); g.lineTo(4.2, -18.5);
        g.moveTo(7.5, -15.8); g.lineTo(7, -17.4);
        g.lineStyle(0);
      } else {
        g.beginFill(0xffffff, 0.92);
        g.drawCircle(4.2, -12.5, 4.5);
        g.endFill();
      }

      // Cheek blush
      if (!isHit) {
        g.beginFill(blushColor, 0.3);
        g.drawEllipse(7, -9, 3.5, 2);
        g.endFill();
      }

      // Mouth (profile)
      if (!isHit) {
        if (isAttacking && this.attackExpressionTimer > 0) {
          g.lineStyle(1.5, 0xcc4466, 0.9);
          g.moveTo(4, -7.5); g.lineTo(7, -7.5);
          g.lineStyle(0);
        } else {
          g.lineStyle(1.5, 0xdd5577, 0.85);
          g.arc(6, -8, 1.8, 0, Math.PI * 0.65);
          g.lineStyle(0);
        }
      }

      // Ribbon (side)
      g.beginFill(0xff4488);
      g.drawPolygon([-7, -17, -3, -14.5, -3, -20, -7, -18]);
      g.drawPolygon([-2, -15.5, 1, -13, 1, -18, -2, -16.5]);
      g.endFill();
      g.beginFill(0xff77aa);
      g.drawCircle(-1, -15.5, 2.2);
      g.endFill();
    }

    // ── Magic Staff ──
    if (!isDowned) {
      const sx1 = this.facingX * 8,  sy1 = this.facingY * 8;
      const sx2 = this.facingX * 23, sy2 = this.facingY * 23;
      // Staff glow
      g.lineStyle(6, accentColor, 0.12);
      g.moveTo(sx1, sy1); g.lineTo(sx2, sy2);
      // Staff shaft
      g.lineStyle(2.5, 0xeeddff, 0.9);
      g.moveTo(sx1, sy1); g.lineTo(sx2, sy2);
      g.lineStyle(0);
      // Magic orb at tip
      const orbPulse = 1 + Math.sin(this.floatTimer * 4) * 0.15;
      g.beginFill(0xff88ff, 0.35);
      g.drawCircle(sx2, sy2, 5.5 * orbPulse);
      g.endFill();
      g.beginFill(0xff44ee, 0.85);
      g.drawCircle(sx2, sy2, 3 * orbPulse);
      g.endFill();
      g.beginFill(0xffffff, 0.85);
      g.drawCircle(sx2 - this.facingX * 1, sy2 - this.facingY * 1, 1);
      g.endFill();
    }

    // ── Attack effect (magic arc) ──
    this.attackGfx.clear();
    if (this.attackDuration > 0 && !isDowned) {
      const r = this.attackRange * 0.45;
      const progress = this.attackDuration / 0.12;
      const baseAngle = Math.atan2(this.facingY, this.facingX);
      const sweepStart = baseAngle - 0.7;
      const sweepEnd = baseAngle + 0.7;
      const currentSweep = sweepStart + (sweepEnd - sweepStart) * (1 - progress);

      this.attackGfx.lineStyle(5, 0xff88ff, 0.35 * progress);
      this.attackGfx.arc(0, 0, r * 0.8, sweepStart, currentSweep);
      this.attackGfx.lineStyle(2, 0xffffff, 0.85 * progress);
      this.attackGfx.arc(0, 0, r * 0.8, sweepStart, currentSweep);

      const tipX = Math.cos(currentSweep) * r * 0.8;
      const tipY = Math.sin(currentSweep) * r * 0.8;
      this.attackGfx.lineStyle(0);
      this.attackGfx.beginFill(0xffaaff, 0.85 * progress);
      this.attackGfx.drawCircle(tipX, tipY, 4.5 * progress);
      this.attackGfx.endFill();
      // Sparkle dots along the arc
      for (let i = 0; i < 4; i++) {
        const a = sweepStart + (sweepEnd - sweepStart) * (i / 4);
        const sx = Math.cos(a) * r * 0.82;
        const sy = Math.sin(a) * r * 0.82;
        this.attackGfx.beginFill(0xffffff, 0.55 * progress);
        this.attackGfx.drawCircle(sx, sy, 1.8 * progress);
        this.attackGfx.endFill();
      }
    }

    // ── HP Bar ──
    this.hpBarGfx.clear();
    const hpRatio = this.hp / this.maxHp;
    if (!isDowned && !isReviving && hpRatio < 1) {
      const bw = 28, bh = 4, bx = -bw / 2, by = -28;
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
      this.hpBarGfx.drawRoundedRect(-barW / 2 - 1, -28, barW + 2, barH + 2, 2);
      this.hpBarGfx.endFill();
      this.hpBarGfx.beginFill(0x44ddaa, 0.7);
      this.hpBarGfx.drawRoundedRect(-barW / 2, -27, barW * reviveProgress, barH, 2);
      this.hpBarGfx.endFill();
    }
  }
}
