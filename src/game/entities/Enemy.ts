import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

export type FireFn = (x: number, y: number, vx: number, vy: number, dmg: number, color?: number, radius?: number) => void;

export class Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown = 0;
  attackRange: number;
  xpReward: number;
  dead = false;
  hitFlash = 0;

  // Knockback
  kbVx = 0;
  kbVy = 0;
  stunTime = 0;

  protected sprite: Sprite;
  protected hpBarGfx: Graphics;
  readonly shadowGfx: Graphics;
  readonly container: Container;
  protected floatTimer: number;

  constructor(
    x: number, y: number, hp = 100, speed = 85, damage = 18,
    attackRange = 36, xpReward = 20, w = 36, h = 36,
    spriteUrl = './images/enemy1.png',
  ) {
    this.x = x; this.y = y; this.hp = hp; this.maxHp = hp;
    this.speed = speed; this.damage = damage;
    this.attackRange = attackRange; this.xpReward = xpReward;
    this.w = w; this.h = h;
    this.floatTimer = Math.random() * Math.PI * 2;

    this.container = new Container();
    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);
    this.sprite = new Sprite(Texture.from(spriteUrl));
    this.sprite.anchor.set(0.5);
    this.sprite.width = w; this.sprite.height = h;
    this.container.addChild(this.sprite);
    this.hpBarGfx = new Graphics();
    this.container.addChild(this.hpBarGfx);
    this.render();
  }

  /** Apply knockback force */
  applyKnockback(fromX: number, fromY: number, force: number) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.kbVx = (dx / dist) * force;
    this.kbVy = (dy / dist) * force;
    this.stunTime = 0.2;
  }

  /** Check if enemy hit a wall during knockback. Returns true if wall collision. */
  updateKnockback(dt: number, map: WorldMap): boolean {
    let hitWall = false;
    if (Math.abs(this.kbVx) > 1 || Math.abs(this.kbVy) > 1) {
      const nx = this.x + this.kbVx * dt;
      const ny = this.y + this.kbVy * dt;
      if (!map.isColliding(nx, this.y, this.w, this.h)) {
        this.x = nx;
      } else { hitWall = true; }
      if (!map.isColliding(this.x, ny, this.w, this.h)) {
        this.y = ny;
      } else { hitWall = true; }
      // Friction
      this.kbVx *= Math.max(0, 1 - dt * 8);
      this.kbVy *= Math.max(0, 1 - dt * 8);
    }
    this.stunTime = Math.max(0, this.stunTime - dt);
    return hitWall;
  }

  update(dt: number, player: Player, map: WorldMap, _fire?: FireFn) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * 2.5;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 360 && dist > this.attackRange * 0.8) {
      const mx = (dx / dist) * this.speed * dt;
      const my = (dy / dist) * this.speed * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    }
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 1.5;
    }
    this.syncGfx();
  }

  protected syncGfx() {
    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.container.visible = false; }
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.3);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.4, 5);
    this.shadowGfx.endFill();

    const floatY = Math.sin(this.floatTimer) * 2;
    this.sprite.y = floatY - 2;

    if (this.hitFlash > 0) {
      this.sprite.tint = 0xffffff; this.sprite.alpha = 0.8;
    } else {
      this.sprite.tint = 0xffffff; this.sprite.alpha = 1.0;
    }

    this.hpBarGfx.clear();
    if (hpRatio < 1) {
      const bw = this.w + 4, bh = 5, bx = -bw / 2, by = -this.h / 2 - 12;
      this.hpBarGfx.beginFill(0x220000);
      this.hpBarGfx.drawRect(bx, by, bw, bh);
      this.hpBarGfx.endFill();
      const fc = hpRatio > 0.5 ? 0x44dd44 : hpRatio > 0.25 ? 0xffcc00 : 0xff3333;
      this.hpBarGfx.beginFill(fc);
      this.hpBarGfx.drawRect(bx, by, bw * hpRatio, bh);
      this.hpBarGfx.endFill();
    }
  }
}
