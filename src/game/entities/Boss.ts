import { Graphics } from 'pixi.js';
import { Enemy, type FireFn } from './Enemy';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

export class Boss extends Enemy {
  phase = 1;
  isAngry = false;
  isEnraged = false;
  phaseTransitioned = false;
  phase3Transitioned = false;
  wanderTimer = 0;
  wanderX = 0;
  wanderY = 0;
  private shotCooldown = 0;
  private shotInterval = 3.0;
  private crownGfx: Graphics;

  // Attack telegraph
  telegraphTimer = 0;
  telegraphX = 0;
  telegraphY = 0;
  telegraphR = 0;
  private telegraphGfx: Graphics;
  private auraGfx: Graphics;

  constructor(x: number, y: number) {
    super(x, y, 1500, 60, 30, 60, 500, 64, 64, './images/boss.png');
    this.crownGfx = new Graphics();
    this.container.addChild(this.crownGfx);
    this.telegraphGfx = new Graphics();
    this.container.addChild(this.telegraphGfx);
    this.auraGfx = new Graphics();
    this.container.addChildAt(this.auraGfx, 0);
    this.drawCrown();
  }

  private drawCrown() {
    const cw = 44, ch = 16, cx = -cw / 2, cy = -this.h / 2 - ch - 4;
    this.crownGfx.clear();
    this.crownGfx.beginFill(0xffcc00);
    this.crownGfx.drawRect(cx, cy + 5, cw, ch - 5);
    this.crownGfx.drawRect(cx, cy, 10, ch);
    this.crownGfx.drawRect(cx + cw / 2 - 5, cy - 6, 10, ch + 6);
    this.crownGfx.drawRect(cx + cw - 10, cy, 10, ch);
    this.crownGfx.endFill();
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
    this.updateKnockback(dt, map);
    this.telegraphTimer = Math.max(0, this.telegraphTimer - dt);

    // Phase transitions
    if (!this.isAngry && this.hp < this.maxHp * 0.5) {
      this.isAngry = true; this.phase = 2;
      this.speed = 120; this.damage = 45; this.shotInterval = 2.0;
      this.phaseTransitioned = true;
    }
    if (!this.isEnraged && this.hp < this.maxHp * 0.25) {
      this.isEnraged = true; this.phase = 3;
      this.speed = 160; this.damage = 60; this.shotInterval = 1.2;
      this.phase3Transitioned = true;
    }

    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.isAngry || this.isEnraged) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = this.isEnraged ? 0.8 + Math.random() * 0.7 : 1.2 + Math.random() * 1.2;
        this.wanderX = dx / dist; this.wanderY = dy / dist;
      }
      const cs = this.isEnraged ? this.speed * 1.5 : this.speed * 1.3;
      const mx = this.wanderX * cs * dt;
      const my = this.wanderY * cs * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    } else {
      if (dist > this.attackRange * 0.8) {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
    }

    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = this.isEnraged ? 0.7 : this.isAngry ? 1.0 : 1.5;
    }

    // Projectiles + telegraph for area attack
    if (fire && this.shotCooldown <= 0) {
      this.fireProjectiles(dx, dy, dist, fire);
      this.shotCooldown = this.shotInterval;
      // Telegraph next area attack
      if (this.isEnraged) {
        this.telegraphTimer = 1.0;
        this.telegraphX = player.x - this.x;
        this.telegraphY = player.y - this.y;
        this.telegraphR = 80;
      }
    }

    this.syncGfx();
  }

  private fireProjectiles(dx: number, dy: number, dist: number, fire: FireFn) {
    const ba = Math.atan2(dy, dx);
    const ps = 220;
    if (this.isEnraged) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        fire(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, 22, 0xff00ff, 8);
      }
      const sp = 0.35;
      for (let i = -1; i <= 1; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * (ps + 40), Math.sin(a) * (ps + 40), 25, 0xff3300, 9);
      }
    } else if (this.isAngry) {
      const sp = 0.28;
      for (let i = -2; i <= 2; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, 20, 0xff6600, 8);
      }
    } else {
      const sp = 0.22;
      for (let i = -1; i <= 1; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * ps * 0.9, Math.sin(a) * ps * 0.9, 15, 0xff8800, 7);
      }
    }
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    this.shadowGfx.clear();
    this.shadowGfx.beginFill(0x000000, 0.35);
    this.shadowGfx.drawEllipse(0, this.h / 2 - 4, this.w * 0.5, 8);
    this.shadowGfx.endFill();

    const floatAmt = this.isEnraged ? 6 : this.isAngry ? 4 : 2;
    this.sprite.y = Math.sin(this.floatTimer) * floatAmt - 4;

    // Tint by phase
    if (this.hitFlash > 0) {
      this.sprite.tint = 0xffffff;
    } else if (this.isEnraged) {
      this.sprite.tint = Math.sin(this.floatTimer * 3) > 0 ? 0xff00aa : 0xaa00ff;
    } else if (this.isAngry) {
      this.sprite.tint = 0xff6666;
    } else {
      this.sprite.tint = 0xffffff;
    }

    // Size increase per phase
    const baseScale = this.w / 16;
    const phaseScale = this.isEnraged ? 1.3 : this.isAngry ? 1.15 : 1.0;
    if (this.isEnraged) {
      const pulse = 1 + Math.sin(this.floatTimer * 3) * 0.08;
      this.sprite.scale.set(baseScale * phaseScale * pulse);
    } else if (this.isAngry) {
      const pulse = 1 + Math.sin(this.floatTimer * 2) * 0.05;
      this.sprite.scale.set(baseScale * phaseScale * pulse);
    } else {
      this.sprite.scale.set(baseScale);
    }

    if (this.crownGfx) this.crownGfx.y = this.sprite.y;

    // Aura effect
    this.auraGfx.clear();
    if (this.isEnraged) {
      this.auraGfx.beginFill(0xaa00ff, 0.12 + Math.sin(this.floatTimer * 4) * 0.06);
      this.auraGfx.drawCircle(0, 0, this.w * 0.9);
      this.auraGfx.endFill();
    } else if (this.isAngry) {
      this.auraGfx.beginFill(0xff2200, 0.08 + Math.sin(this.floatTimer * 3) * 0.04);
      this.auraGfx.drawCircle(0, 0, this.w * 0.7);
      this.auraGfx.endFill();
    }

    // Telegraph warning circle
    this.telegraphGfx.clear();
    if (this.telegraphTimer > 0) {
      const progress = 1 - this.telegraphTimer / 1.0;
      const alpha = 0.15 + progress * 0.25;
      this.telegraphGfx.beginFill(0xff0000, alpha);
      this.telegraphGfx.drawCircle(this.telegraphX, this.telegraphY, this.telegraphR * progress);
      this.telegraphGfx.endFill();
      this.telegraphGfx.lineStyle(2, 0xff4444, alpha);
      this.telegraphGfx.drawCircle(this.telegraphX, this.telegraphY, this.telegraphR);
    }

    // HP bar
    this.hpBarGfx.clear();
    const bw = this.w + 20, bh = 9, bx = -bw / 2, by = -this.h / 2 - 30;
    this.hpBarGfx.beginFill(0x330000);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
    this.hpBarGfx.endFill();
    const fc = hpRatio > 0.5 ? 0xff6600 : hpRatio > 0.25 ? 0xff2222 : 0xaa00ff;
    this.hpBarGfx.beginFill(fc);
    this.hpBarGfx.drawRect(bx, by, bw * hpRatio, bh);
    this.hpBarGfx.endFill();
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.6);
    this.hpBarGfx.moveTo(bx + bw * 0.5, by); this.hpBarGfx.lineTo(bx + bw * 0.5, by + bh);
    this.hpBarGfx.moveTo(bx + bw * 0.25, by); this.hpBarGfx.lineTo(bx + bw * 0.25, by + bh);
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.4);
    this.hpBarGfx.drawRect(bx, by, bw, bh);
  }
}
