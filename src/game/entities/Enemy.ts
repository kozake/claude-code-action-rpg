import { Graphics, Container, Sprite, Texture } from 'pixi.js';
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

  protected sprite: Sprite;
  protected hpBarGfx: Graphics;
  readonly shadowGfx: Graphics;
  readonly container: Container;

  // Float animation
  protected floatTimer: number;

  constructor(
    x: number,
    y: number,
    hp = 50,
    speed = 80,
    damage = 10,
    attackRange = 36,
    xpReward = 20,
    w = 36,
    h = 36,
    spriteUrl = './images/enemy1.png',
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
    this.floatTimer = Math.random() * Math.PI * 2; // random phase

    this.container = new Container();

    // Drop shadow
    this.shadowGfx = new Graphics();
    this.container.addChild(this.shadowGfx);

    // Character sprite
    this.sprite = new Sprite(Texture.from(spriteUrl));
    this.sprite.anchor.set(0.5);
    this.sprite.width = w;
    this.sprite.height = h;
    this.container.addChild(this.sprite);

    // HP bar on top
    this.hpBarGfx = new Graphics();
    this.container.addChild(this.hpBarGfx);

    this.render();
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * 2.5;

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

    // Drop shadow
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.3);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.4, 5);
    this.shadowGfx.endFill();

    // Floating animation
    const floatY = Math.sin(this.floatTimer) * 2;
    this.sprite.y = floatY - 2;

    // Hit flash: white tint, otherwise normal
    if (this.hitFlash > 0) {
      this.sprite.tint = 0xffffff;
      this.sprite.alpha = 0.8;
    } else {
      this.sprite.tint = 0xffffff;
      this.sprite.alpha = 1.0;
    }

    // HP bar
    this.hpBarGfx.clear();
    if (hpRatio < 1) {
      const bw = this.w + 4;
      const bh = 5;
      const bx = -bw / 2;
      const by = -this.h / 2 - 12;
      // Background
      this.hpBarGfx.beginFill(0x220000);
      this.hpBarGfx.drawRect(bx, by, bw, bh);
      this.hpBarGfx.endFill();
      // Fill
      const fillColor = hpRatio > 0.5 ? 0x44dd44 : hpRatio > 0.25 ? 0xffcc00 : 0xff3333;
      this.hpBarGfx.beginFill(fillColor);
      this.hpBarGfx.drawRect(bx, by, bw * hpRatio, bh);
      this.hpBarGfx.endFill();
    }
  }
}

export class Boss extends Enemy {
  phase = 1;
  isAngry = false;
  phaseTransitioned = false;
  wanderTimer = 0;
  wanderX = 0;
  wanderY = 0;

  // Crown decoration
  private crownGfx: Graphics;

  constructor(x: number, y: number) {
    super(x, y, 600, 55, 25, 56, 300, 60, 60, './images/boss.png');
    // Add crown graphic on top
    this.crownGfx = new Graphics();
    this.container.addChild(this.crownGfx);
    this.drawCrown();
  }

  private drawCrown() {
    const cw = 40;
    const ch = 14;
    const cx = -cw / 2;
    const cy = -this.h / 2 - ch - 4;

    this.crownGfx.clear();
    this.crownGfx.beginFill(0xffcc00);
    this.crownGfx.drawRect(cx, cy + 5, cw, ch - 5);
    this.crownGfx.drawRect(cx, cy, 9, ch);
    this.crownGfx.drawRect(cx + cw / 2 - 4, cy - 5, 9, ch + 5);
    this.crownGfx.drawRect(cx + cw - 9, cy, 9, ch);
    this.crownGfx.endFill();

    // Jewels
    this.crownGfx.beginFill(0xff2222);
    this.crownGfx.drawCircle(cx + cw / 4, cy + 8, 3);
    this.crownGfx.endFill();
    this.crownGfx.beginFill(0x2222ff);
    this.crownGfx.drawCircle(cx + cw * 3 / 4, cy + 8, 3);
    this.crownGfx.endFill();
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * (this.isAngry ? 5 : 2);

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

    // Drop shadow (larger for boss)
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.35);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.5, 8);
    this.shadowGfx.endFill();

    // Floating with intensity based on phase
    const floatAmt = this.isAngry ? 4 : 2;
    const floatY = Math.sin(this.floatTimer) * floatAmt;
    this.sprite.y = floatY - 4;

    // Phase 2: red tint on the boss sprite
    if (this.hitFlash > 0) {
      this.sprite.tint = 0xffffff;
    } else if (this.isAngry) {
      this.sprite.tint = 0xff6666;
    } else {
      this.sprite.tint = 0xffffff;
    }

    // Scale pulsing in phase 2
    if (this.isAngry) {
      const pulse = 1 + Math.sin(this.floatTimer * 2) * 0.05;
      this.sprite.scale.x = pulse * (this.w / 16);
      this.sprite.scale.y = pulse * (this.h / 16);
    } else {
      this.sprite.scale.set(this.w / 16);
    }

    // Crown follows float
    if (this.crownGfx) this.crownGfx.y = this.sprite.y;

    // HP bar (thick)
    this.hpBarGfx.clear();
    const bw = this.w + 16;
    const bh = 8;
    const bx = -bw / 2;
    const by = -this.h / 2 - 24;
    this.hpBarGfx.beginFill(0x330000);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
    this.hpBarGfx.endFill();
    const fillColor = hpRatio > 0.5 ? 0xff6600 : 0xff2222;
    this.hpBarGfx.beginFill(fillColor);
    this.hpBarGfx.drawRect(bx, by, bw * hpRatio, bh);
    this.hpBarGfx.endFill();
    // Border
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.4);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
  }
}
