import { Graphics, Container } from 'pixi.js';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

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

  readonly gfx: Graphics;
  readonly container: Container;

  protected color: number;

  constructor(
    x: number,
    y: number,
    hp = 50,
    speed = 80,
    damage = 10,
    attackRange = 36,
    xpReward = 20,
    w = 28,
    h = 28,
    color = 0xcc3333,
  ) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.damage = damage;
    this.attackRange = attackRange;
    this.xpReward = xpReward;
    this.w = w;
    this.h = h;
    this.color = color;

    this.gfx = new Graphics();
    this.container = new Container();
    this.container.addChild(this.gfx);
    this.render();
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Chase player when in range
    if (dist < 320 && dist > this.attackRange * 0.8) {
      const mx = (dx / dist) * this.speed * dt;
      const my = (dy / dist) * this.speed * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    }

    // Attack when close
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 1.8;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.container.visible = false;
    }
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    const fill = this.hitFlash > 0 ? 0xffffff : this.color;

    this.gfx.clear();
    this.gfx.beginFill(fill);
    this.gfx.drawRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 4);
    this.gfx.endFill();

    // Eye
    this.gfx.beginFill(0xffff00);
    this.gfx.drawCircle(-5, -3, 4);
    this.gfx.drawCircle(5, -3, 4);
    this.gfx.endFill();
    this.gfx.beginFill(0x000000);
    this.gfx.drawCircle(-5, -3, 2);
    this.gfx.drawCircle(5, -3, 2);
    this.gfx.endFill();

    // HP bar
    this.gfx.beginFill(0x330000);
    this.gfx.drawRect(-this.w / 2, -this.h / 2 - 10, this.w, 5);
    this.gfx.endFill();
    this.gfx.beginFill(hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xffcc00 : 0xff3333);
    this.gfx.drawRect(-this.w / 2, -this.h / 2 - 10, this.w * hpRatio, 5);
    this.gfx.endFill();
  }
}

export class Boss extends Enemy {
  phase = 1;
  isAngry = false;
  phaseTransitioned = false;
  wanderTimer = 0;
  wanderX = 0;
  wanderY = 0;

  constructor(x: number, y: number) {
    super(x, y, 600, 55, 25, 52, 300, 52, 52, 0x990033);
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // Phase 2 at 50% HP
    if (!this.isAngry && this.hp < this.maxHp * 0.5) {
      this.isAngry = true;
      this.speed = 110;
      this.damage = 40;
      this.phaseTransitioned = true;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Phase 2: charge at player occasionally
    if (this.isAngry) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1.5 + Math.random() * 1.5;
        this.wanderX = dx / dist;
        this.wanderY = dy / dist;
      }
      const mx = this.wanderX * this.speed * dt * 1.4;
      const my = this.wanderY * this.speed * dt * 1.4;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    } else {
      // Phase 1: steady chase
      if (dist > this.attackRange * 0.8) {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
    }

    // Attack
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = this.isAngry ? 1.0 : 1.6;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    const fill = this.hitFlash > 0 ? 0xffffff : (this.isAngry ? 0xcc0000 : 0x990033);

    this.gfx.clear();

    // Body
    this.gfx.beginFill(fill);
    this.gfx.drawRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
    this.gfx.endFill();

    // Crown
    const cw = this.w * 0.7;
    const ch = 12;
    const cx = -cw / 2;
    const cy = -this.h / 2 - ch;
    this.gfx.beginFill(0xffcc00);
    this.gfx.drawRect(cx, cy + 4, cw, ch - 4);
    this.gfx.drawRect(cx, cy, 8, ch);
    this.gfx.drawRect(cx + cw / 2 - 4, cy - 4, 8, ch + 4);
    this.gfx.drawRect(cx + cw - 8, cy, 8, ch);
    this.gfx.endFill();

    // Eyes (angry in phase 2)
    const eyeColor = this.isAngry ? 0xff4400 : 0xff0000;
    this.gfx.beginFill(eyeColor);
    this.gfx.drawCircle(-10, -4, 7);
    this.gfx.drawCircle(10, -4, 7);
    this.gfx.endFill();
    this.gfx.beginFill(0xffffff);
    this.gfx.drawCircle(-10, -4, 3);
    this.gfx.drawCircle(10, -4, 3);
    this.gfx.endFill();

    // HP bar (thick)
    this.gfx.beginFill(0x330000);
    this.gfx.drawRect(-this.w / 2, -this.h / 2 - 22, this.w, 8);
    this.gfx.endFill();
    this.gfx.beginFill(hpRatio > 0.5 ? 0xff6600 : 0xff2222);
    this.gfx.drawRect(-this.w / 2, -this.h / 2 - 22, this.w * hpRatio, 8);
    this.gfx.endFill();
  }
}
