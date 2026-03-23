import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '../../input';
import type { WorldMap } from '../maps/WorldMap';

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

  facingX = 1;
  facingY = 0;

  private sprite: Sprite;
  readonly attackGfx: Graphics;
  readonly shadowGfx: Graphics;
  readonly container: Container;

  // Bob animation
  private bobTimer = 0;

  justLeveledUp = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
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

  update(dt: number, input: InputManager, map: WorldMap) {
    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (input.skillPressed && this.dashCooldown <= 0 && this.dashTime <= 0) {
      this.dashTime = 0.18;
      this.dashCooldown = 1.0;
      this.invincibleTime = Math.max(this.invincibleTime, 0.18);
    }
    this.dashTime = Math.max(0, this.dashTime - dt);
    const dashing = this.dashTime > 0;

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
      this.attackCooldown = 0.45;
      this.attackDuration = 0.14;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  getAttackHitbox(): { cx: number; cy: number; r: number } | null {
    if (this.attackDuration <= 0) return null;
    return {
      cx: this.x + this.facingX * this.attackRange * 0.6,
      cy: this.y + this.facingY * this.attackRange * 0.6,
      r: this.attackRange * 0.55,
    };
  }

  takeDamage(amount: number) {
    if (this.invincibleTime > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTime = 1.2;
  }

  addXp(amount: number) {
    this.xp += amount;
    const needed = this.level * 50;
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.maxHp += 20;
      this.hp = Math.min(this.hp + 30, this.maxHp);
      this.attackDamage += 5;
      this.justLeveledUp = true;
    }
  }

  get dead() {
    return this.hp <= 0;
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

    // Tint: blue when dashing, white when attacking, normal otherwise
    if (dashing) {
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

    // Dash speed lines
    this.attackGfx.clear();
    if (dashing) {
      // Speed lines behind player
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

    // Attack slash arc
    if (this.attackDuration > 0) {
      const ax = this.facingX * this.attackRange * 0.6;
      const ay = this.facingY * this.attackRange * 0.6;
      const r = this.attackRange * 0.55;
      const progress = this.attackDuration / 0.14;

      // Glow circle
      this.attackGfx.beginFill(0xffee44, 0.35 * progress);
      this.attackGfx.drawCircle(ax, ay, r);
      this.attackGfx.endFill();

      // Slash arc
      this.attackGfx.lineStyle(3, 0xffffff, 0.9 * progress);
      this.attackGfx.drawCircle(ax, ay, r * 0.7);

      // Star burst
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + this.bobTimer;
        const sx = ax + Math.cos(angle) * r * 0.8;
        const sy = ay + Math.sin(angle) * r * 0.8;
        this.attackGfx.lineStyle(2, 0xffcc00, 0.7 * progress);
        this.attackGfx.moveTo(ax, ay);
        this.attackGfx.lineTo(sx, sy);
      }
    }
  }
}
