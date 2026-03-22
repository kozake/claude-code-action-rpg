import { Graphics, Container } from 'pixi.js';
import type { InputManager } from '../../input';
import type { WorldMap } from '../maps/WorldMap';

export class Player {
  x: number;
  y: number;
  readonly w = 32;
  readonly h = 32;
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

  readonly gfx: Graphics;
  readonly attackGfx: Graphics;
  readonly container: Container;

  justLeveledUp = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.gfx = new Graphics();
    this.attackGfx = new Graphics();
    this.container = new Container();
    this.container.addChild(this.attackGfx);
    this.container.addChild(this.gfx);
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

    if (input.moveX !== 0 || input.moveY !== 0) {
      this.facingX = input.moveX;
      this.facingY = input.moveY;
      // Normalize facing
      const len = Math.sqrt(this.facingX ** 2 + this.facingY ** 2);
      if (len > 0) {
        this.facingX /= len;
        this.facingY /= len;
      }
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
    const alpha = flicker ? 0.3 : 1;
    const dashing = this.dashTime > 0;

    this.gfx.clear();

    // Body
    this.gfx.beginFill(dashing ? 0x88ccff : 0x4488ff, alpha);
    this.gfx.drawRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 6);
    this.gfx.endFill();

    // Direction indicator (eye)
    this.gfx.beginFill(0xffffff, alpha);
    this.gfx.drawCircle(this.facingX * 9, this.facingY * 9, 6);
    this.gfx.endFill();
    this.gfx.beginFill(0x001133, alpha);
    this.gfx.drawCircle(this.facingX * 9 + this.facingX * 2, this.facingY * 9 + this.facingY * 2, 3);
    this.gfx.endFill();

    // Attack slash
    this.attackGfx.clear();
    if (this.attackDuration > 0) {
      const ax = this.facingX * this.attackRange * 0.6;
      const ay = this.facingY * this.attackRange * 0.6;
      const r = this.attackRange * 0.55;
      this.attackGfx.beginFill(0xffee44, 0.6);
      this.attackGfx.drawCircle(ax, ay, r);
      this.attackGfx.endFill();
      this.attackGfx.lineStyle(2, 0xffffff, 0.8);
      this.attackGfx.drawCircle(ax, ay, r);
    }
  }
}
