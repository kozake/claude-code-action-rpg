import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

type FireFn = (x: number, y: number, vx: number, vy: number, dmg: number, color?: number, radius?: number) => void;

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
    hp = 100,
    speed = 85,
    damage = 18,
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

  update(dt: number, player: Player, map: WorldMap, _fire?: FireFn) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * 2.5;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Chase player when in range
    if (dist < 360 && dist > this.attackRange * 0.8) {
      const mx = (dx / dist) * this.speed * dt;
      const my = (dy / dist) * this.speed * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    }

    // Attack when close
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 1.5;
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

// ---------------------------------------------------------------------------
// Ranged Enemy – stays at distance and fires projectiles
// ---------------------------------------------------------------------------
export class RangedEnemy extends Enemy {
  private shootCooldown = 0;
  private readonly shootInterval: number;
  private readonly shootRange: number;
  private readonly projectileDmg: number;
  private readonly projectileColor: number;

  constructor(
    x: number,
    y: number,
    hp = 120,
    speed = 60,
    damage = 12,
    xpReward = 30,
    spriteUrl = './images/enemy2.png',
    shootInterval = 2.2,
    shootRange = 280,
    projectileDmg = 18,
    projectileColor = 0x00ccff,
  ) {
    super(x, y, hp, speed, damage, 40, xpReward, 36, 36, spriteUrl);
    this.shootInterval = shootInterval;
    this.shootRange = shootRange;
    this.projectileDmg = projectileDmg;
    this.projectileColor = projectileColor;
    this.shootCooldown = Math.random() * shootInterval; // stagger initial shots
  }

  update(dt: number, player: Player, map: WorldMap, fire?: FireFn) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.floatTimer += dt * 2.5;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Try to keep a comfortable shooting distance (120-250px)
    const idealDist = 200;
    if (dist < 360) {
      let mx = 0, my = 0;
      if (dist < idealDist - 30) {
        // Too close – back away
        mx = -(dx / dist) * this.speed * dt;
        my = -(dy / dist) * this.speed * dt;
      } else if (dist > idealDist + 30) {
        // Too far – approach
        mx = (dx / dist) * this.speed * 0.7 * dt;
        my = (dy / dist) * this.speed * 0.7 * dt;
      }
      if (mx !== 0 || my !== 0) {
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
    }

    // Melee fallback if player somehow gets very close
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 1.5;
    }

    // Ranged attack
    if (fire && dist < this.shootRange && this.shootCooldown <= 0) {
      const speed = 200;
      fire(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, this.projectileDmg, this.projectileColor, 6);
      this.shootCooldown = this.shootInterval;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  protected render() {
    super.render();
    // Blue tint to distinguish ranged enemies
    if (this.hitFlash <= 0) {
      this.sprite.tint = 0xaaddff;
    }
  }
}

// ---------------------------------------------------------------------------
// Boss
// ---------------------------------------------------------------------------
export class Boss extends Enemy {
  phase = 1;
  isAngry = false;
  isEnraged = false; // phase 3
  phaseTransitioned = false;
  phase3Transitioned = false;
  wanderTimer = 0;
  wanderX = 0;
  wanderY = 0;

  private shotCooldown = 0;
  private shotInterval = 3.0;

  // Crown decoration
  private crownGfx: Graphics;

  constructor(x: number, y: number) {
    super(x, y, 1500, 60, 30, 60, 500, 64, 64, './images/boss.png');
    // Add crown graphic on top
    this.crownGfx = new Graphics();
    this.container.addChild(this.crownGfx);
    this.drawCrown();
  }

  private drawCrown() {
    const cw = 44;
    const ch = 16;
    const cx = -cw / 2;
    const cy = -this.h / 2 - ch - 4;

    this.crownGfx.clear();
    this.crownGfx.beginFill(0xffcc00);
    this.crownGfx.drawRect(cx, cy + 5, cw, ch - 5);
    this.crownGfx.drawRect(cx, cy, 10, ch);
    this.crownGfx.drawRect(cx + cw / 2 - 5, cy - 6, 10, ch + 6);
    this.crownGfx.drawRect(cx + cw - 10, cy, 10, ch);
    this.crownGfx.endFill();

    // Jewels
    this.crownGfx.beginFill(0xff2222);
    this.crownGfx.drawCircle(cx + cw / 4, cy + 9, 3);
    this.crownGfx.endFill();
    this.crownGfx.beginFill(0x2222ff);
    this.crownGfx.drawCircle(cx + cw * 3 / 4, cy + 9, 3);
    this.crownGfx.endFill();
  }

  update(dt: number, player: Player, map: WorldMap, fire?: FireFn) {
    if (this.dead) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.floatTimer += dt * (this.isEnraged ? 7 : this.isAngry ? 5 : 2);

    // Phase 2 at 50% HP
    if (!this.isAngry && this.hp < this.maxHp * 0.5) {
      this.isAngry = true;
      this.phase = 2;
      this.speed = 120;
      this.damage = 45;
      this.shotInterval = 2.0;
      this.phaseTransitioned = true;
    }

    // Phase 3 at 25% HP
    if (!this.isEnraged && this.hp < this.maxHp * 0.25) {
      this.isEnraged = true;
      this.phase = 3;
      this.speed = 160;
      this.damage = 60;
      this.shotInterval = 1.2;
      this.phase3Transitioned = true;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.isAngry || this.isEnraged) {
      // Phase 2/3: charge toward player with periodic direction refresh
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = this.isEnraged ? 0.8 + Math.random() * 0.7 : 1.2 + Math.random() * 1.2;
        this.wanderX = dx / dist;
        this.wanderY = dy / dist;
      }
      const chargeSpeed = this.isEnraged ? this.speed * 1.5 : this.speed * 1.3;
      const mx = this.wanderX * chargeSpeed * dt;
      const my = this.wanderY * chargeSpeed * dt;
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

    // Melee attack
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = this.isEnraged ? 0.7 : this.isAngry ? 1.0 : 1.5;
    }

    // Projectile attacks
    if (fire && this.shotCooldown <= 0) {
      this.fireProjectiles(dx, dy, dist, fire);
      this.shotCooldown = this.shotInterval;
    }

    this.container.x = this.x;
    this.container.y = this.y;
    this.render();
  }

  private fireProjectiles(dx: number, dy: number, dist: number, fire: FireFn) {
    const baseAngle = Math.atan2(dy, dx);
    const projSpeed = 220;

    if (this.isEnraged) {
      // Phase 3: 8-way burst + aimed spread-5
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        fire(this.x, this.y, Math.cos(a) * projSpeed, Math.sin(a) * projSpeed, 22, 0xff00ff, 8);
      }
      // Also fire aimed spread of 3
      const spread = 0.35;
      for (let i = -1; i <= 1; i++) {
        const a = baseAngle + i * spread;
        fire(this.x, this.y, Math.cos(a) * (projSpeed + 40), Math.sin(a) * (projSpeed + 40), 25, 0xff3300, 9);
      }
    } else if (this.isAngry) {
      // Phase 2: spread-5 toward player
      const spread = 0.28;
      for (let i = -2; i <= 2; i++) {
        const a = baseAngle + i * spread;
        fire(this.x, this.y, Math.cos(a) * projSpeed, Math.sin(a) * projSpeed, 20, 0xff6600, 8);
      }
    } else {
      // Phase 1: spread-3 toward player
      const spread = 0.22;
      for (let i = -1; i <= 1; i++) {
        const a = baseAngle + i * spread;
        fire(this.x, this.y, Math.cos(a) * projSpeed * 0.9, Math.sin(a) * projSpeed * 0.9, 15, 0xff8800, 7);
      }
    }
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;

    // Drop shadow (larger for boss)
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.35);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.5, 8);
    this.shadowGfx.endFill();

    // Floating with intensity based on phase
    const floatAmt = this.isEnraged ? 6 : this.isAngry ? 4 : 2;
    const floatY = Math.sin(this.floatTimer) * floatAmt;
    this.sprite.y = floatY - 4;

    // Tint by phase
    if (this.hitFlash > 0) {
      this.sprite.tint = 0xffffff;
    } else if (this.isEnraged) {
      // Phase 3: purple-red flicker
      const flicker = Math.sin(this.floatTimer * 3) > 0 ? 0xff00aa : 0xaa00ff;
      this.sprite.tint = flicker;
    } else if (this.isAngry) {
      this.sprite.tint = 0xff6666;
    } else {
      this.sprite.tint = 0xffffff;
    }

    // Scale pulsing in phase 2/3
    if (this.isEnraged) {
      const pulse = 1 + Math.sin(this.floatTimer * 3) * 0.08;
      this.sprite.scale.x = pulse * (this.w / 16);
      this.sprite.scale.y = pulse * (this.h / 16);
    } else if (this.isAngry) {
      const pulse = 1 + Math.sin(this.floatTimer * 2) * 0.05;
      this.sprite.scale.x = pulse * (this.w / 16);
      this.sprite.scale.y = pulse * (this.h / 16);
    } else {
      this.sprite.scale.set(this.w / 16);
    }

    // Crown follows float
    if (this.crownGfx) this.crownGfx.y = this.sprite.y;

    // HP bar (thick, 3-color segments)
    this.hpBarGfx.clear();
    const bw = this.w + 20;
    const bh = 9;
    const bx = -bw / 2;
    const by = -this.h / 2 - 26;
    this.hpBarGfx.beginFill(0x330000);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
    this.hpBarGfx.endFill();
    const fillColor = hpRatio > 0.5 ? 0xff6600 : hpRatio > 0.25 ? 0xff2222 : 0xaa00ff;
    this.hpBarGfx.beginFill(fillColor);
    this.hpBarGfx.drawRect(bx, by, bw * hpRatio, bh);
    this.hpBarGfx.endFill();
    // Phase markers at 50% and 25%
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.6);
    this.hpBarGfx.moveTo(bx + bw * 0.5, by);
    this.hpBarGfx.lineTo(bx + bw * 0.5, by + bh);
    this.hpBarGfx.moveTo(bx + bw * 0.25, by);
    this.hpBarGfx.lineTo(bx + bw * 0.25, by + bh);
    // Border
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.4);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
  }
}
