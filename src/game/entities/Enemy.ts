import { Graphics, Container } from 'pixi.js';
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

  // Spawn / death animation
  spawnTimer = 0.4;
  deathTimer = 0;
  get fullyDead() { return this.dead && this.deathTimer <= 0; }

  // Knockback
  kbVx = 0;
  kbVy = 0;
  stunTime = 0;

  protected bodyGfx: Graphics;
  protected hpBarGfx: Graphics;
  readonly shadowGfx: Graphics;
  readonly container: Container;
  protected floatTimer: number;

  constructor(
    x: number, y: number, hp = 100, speed = 85, damage = 18,
    attackRange = 36, xpReward = 20, w = 36, h = 36,
  ) {
    this.x = x; this.y = y; this.hp = hp; this.maxHp = hp;
    this.speed = speed; this.damage = damage;
    this.attackRange = attackRange; this.xpReward = xpReward;
    this.w = w; this.h = h;
    this.floatTimer = Math.random() * Math.PI * 2;

    this.container = new Container();

    // Shadow
    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);

    // Body (procedural graphics)
    this.bodyGfx = new Graphics();
    this.container.addChild(this.bodyGfx);

    // HP bar (always on top of body)
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

  /** If the enemy is somehow inside a wall, push them to nearest open space. */
  protected escapeWall(map: WorldMap) {
    if (!map.isColliding(this.x, this.y, this.w, this.h)) return;
    const step = 6;
    for (const [ex, ey] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]] as [number,number][]) {
      if (!map.isColliding(this.x + ex * step, this.y + ey * step, this.w, this.h)) {
        this.x += ex * step; this.y += ey * step; return;
      }
    }
  }

  /** Check if enemy hit a wall during knockback. Returns true if wall collision. */
  updateKnockback(dt: number, map: WorldMap): boolean {
    this.escapeWall(map);
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
    if (this.dead) {
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        const t = this.deathTimer / 0.3;
        this.container.alpha = t;
        this.container.scale.set(0.3 + t * 0.7);
        this.container.rotation += dt * 8;
        if (this.deathTimer <= 0) this.container.visible = false;
      }
      return;
    }
    // Spawn animation
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      const t = Math.max(0, this.spawnTimer / 0.4);
      this.container.alpha = 1 - t;
      this.container.scale.set(0.3 + (1 - t) * 0.7);
      this.syncGfx();
      return;
    }
    this.container.alpha = 1;
    this.container.scale.set(1);
    this.container.rotation = 0;
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
      player.takeDamage(this.damage, this.x, this.y);
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
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathTimer = 0.3; }
  }

  /** Draw the enemy body. Subclasses override to customize appearance. */
  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 0, this.w * 0.45, this.h * 0.5);
      g.drawCircle(0, -this.h * 0.38, this.w * 0.3);
      g.endFill();
      return;
    }
    this.drawDemonBody(g, 0xaa1a1a, 0xdd3333, 0xff5544);
  }

  /** Generic demon body helper used by subclasses */
  protected drawDemonBody(
    g: Graphics,
    bodyColor: number,
    highlightColor: number,
    eyeColor: number,
  ) {
    const hw = this.w * 0.44;
    const hh = this.h * 0.5;

    // Body oval
    g.beginFill(bodyColor);
    g.drawEllipse(0, 2, hw, hh);
    g.endFill();

    // Body highlight (left side sheen)
    g.beginFill(highlightColor, 0.45);
    g.drawEllipse(-hw * 0.25, 0, hw * 0.4, hh * 0.7);
    g.endFill();

    // Head
    g.beginFill(bodyColor);
    g.drawCircle(0, -hh * 0.62, hw * 0.6);
    g.endFill();

    // Head sheen
    g.beginFill(highlightColor, 0.35);
    g.drawCircle(-hw * 0.18, -hh * 0.72, hw * 0.28);
    g.endFill();

    // Horns
    const hornX = hw * 0.38;
    const hornY = -hh * 0.9;
    g.beginFill(bodyColor);
    g.drawPolygon([-hornX, hornY + 4, -hornX - 4, hornY - 10, -hornX + 4, hornY + 2]);
    g.drawPolygon([hornX, hornY + 4, hornX - 4, hornY + 2, hornX + 4, hornY - 10]);
    g.endFill();
    // Horn tips (slightly lighter)
    g.beginFill(highlightColor, 0.5);
    g.drawPolygon([-hornX - 2, hornY - 4, -hornX - 4, hornY - 10, -hornX + 2, hornY - 4]);
    g.drawPolygon([hornX + 2, hornY - 4, hornX + 4, hornY - 10, hornX - 2, hornY - 4]);
    g.endFill();

    // Eyes (glowing)
    const eyeY = -hh * 0.68;
    const eyeX = hw * 0.22;
    // Glow halo
    g.beginFill(eyeColor, 0.3);
    g.drawCircle(-eyeX, eyeY, 5);
    g.drawCircle(eyeX, eyeY, 5);
    g.endFill();
    // Eye whites
    g.beginFill(eyeColor);
    g.drawCircle(-eyeX, eyeY, 3.5);
    g.drawCircle(eyeX, eyeY, 3.5);
    g.endFill();
    // Pupils
    g.beginFill(0x110000);
    g.drawCircle(-eyeX + 0.8, eyeY + 0.5, 1.8);
    g.drawCircle(eyeX + 0.8, eyeY + 0.5, 1.8);
    g.endFill();

    // Claws / feet hint at bottom
    g.beginFill(bodyColor);
    g.drawEllipse(-hw * 0.35, hh * 0.75, hw * 0.2, hw * 0.12);
    g.drawEllipse(hw * 0.35, hh * 0.75, hw * 0.2, hw * 0.12);
    g.endFill();
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    const floatY = Math.sin(this.floatTimer) * 2;

    // Shadow
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.28);
    this.shadowGfx.drawEllipse(0, this.h * 0.5 - 3, this.w * 0.38, 5);
    this.shadowGfx.endFill();

    // Animate body position vertically (float)
    this.bodyGfx.y = floatY - 2;
    this.bodyGfx.clear();
    this.drawBody(this.bodyGfx, this.hitFlash > 0);

    // HP bar
    this.hpBarGfx.clear();
    if (hpRatio < 1) {
      const bw = this.w + 6, bh = 5, bx = -bw / 2, by = -this.h * 0.5 - 14;
      // Background track
      this.hpBarGfx.beginFill(0x111111, 0.7);
      this.hpBarGfx.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
      this.hpBarGfx.endFill();
      // Fill
      const fc = hpRatio > 0.5 ? 0x33ee55 : hpRatio > 0.25 ? 0xffcc00 : 0xff3322;
      this.hpBarGfx.beginFill(fc);
      this.hpBarGfx.drawRoundedRect(bx, by, bw * hpRatio, bh, 2);
      this.hpBarGfx.endFill();
      // Top sheen
      this.hpBarGfx.beginFill(0xffffff, 0.25);
      this.hpBarGfx.drawRoundedRect(bx, by, bw * hpRatio, 2, 1);
      this.hpBarGfx.endFill();
    }
  }
}
