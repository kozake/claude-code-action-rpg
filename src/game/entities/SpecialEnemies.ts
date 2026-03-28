import { Graphics } from 'pixi.js';
import { Enemy } from './Enemy';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

/** Charger: telegraphs, then rushes in a line. Stuns on wall hit. */
export class ChargerEnemy extends Enemy {
  private chargeState: 'idle' | 'telegraph' | 'charging' = 'idle';
  private chargeTimer = 0;
  private chargeDirX = 0;
  private chargeDirY = 0;
  private telegraphGfx: Graphics;
  private chargeSpeed = 450;

  constructor(x: number, y: number, hp = 140, speed = 70) {
    super(x, y, hp, speed, 50, 40, 30, 40, 40);
    this.telegraphGfx = new Graphics();
    this.container.addChild(this.telegraphGfx);
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.floatTimer += dt * 3;
    const hitWall = this.updateKnockback(dt, map);

    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.chargeState === 'idle') {
      if (dist < 300 && dist > 100) {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
      if (dist < 250 && dist > 40) {
        this.chargeState = 'telegraph';
        this.chargeTimer = 0.8;
        this.chargeDirX = dx / dist;
        this.chargeDirY = dy / dist;
      }
    } else if (this.chargeState === 'telegraph') {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeState = 'charging';
        this.chargeTimer = 0.5;
      }
    } else if (this.chargeState === 'charging') {
      this.chargeTimer -= dt;
      const mx = this.chargeDirX * this.chargeSpeed * dt;
      const my = this.chargeDirY * this.chargeSpeed * dt;
      const blocked =
        map.isColliding(this.x + mx, this.y, this.w, this.h) ||
        map.isColliding(this.x, this.y + my, this.w, this.h);

      if (blocked) {
        this.stunTime = 1.5;
        this.chargeState = 'idle';
      } else {
        this.x += mx; this.y += my;
        if (dist < this.attackRange) {
          player.takeDamage(this.damage * 1.5);
        }
      }
      if (this.chargeTimer <= 0) this.chargeState = 'idle';
    }
    this.syncGfx();
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 2, this.w * 0.46, this.h * 0.5);
      g.drawCircle(0, -this.h * 0.38, this.w * 0.3);
      g.endFill();
      return;
    }

    if (this.chargeState === 'telegraph') {
      // Flash between red and orange during telegraph
      const flash = Math.sin(this.floatTimer * 12) > 0;
      this.drawDemonBody(g, flash ? 0xcc1100 : 0xcc5500, flash ? 0xff3300 : 0xff8800, flash ? 0xff6644 : 0xffaa44);
    } else if (this.chargeState === 'charging') {
      // Bright orange while charging
      this.drawDemonBody(g, 0xcc4400, 0xff7722, 0xffaa44);
    } else {
      // Normal: orange bull
      this.drawDemonBody(g, 0xcc5500, 0xff7700, 0xffaa44);
    }

    // Forward-facing horns (thicker/wider for charger)
    const hw = this.w * 0.44;
    const hh = this.h * 0.5;
    const hornY = -hh * 0.72;
    g.beginFill(0xffaa44);
    // Wide spread horns
    g.drawPolygon([-hw * 0.55, hornY + 2, -hw * 0.72, hornY - 14, -hw * 0.3, hornY]);
    g.drawPolygon([hw * 0.55, hornY + 2, hw * 0.3, hornY, hw * 0.72, hornY - 14]);
    g.endFill();

    // Telegraph visual
    if (!this.telegraphGfx) return;
    this.telegraphGfx.clear();
    if (this.chargeState === 'telegraph') {
      const progress = 1 - this.chargeTimer / 0.8;
      const alpha = 0.5 + Math.sin(this.floatTimer * 15) * 0.3;
      // Charge arrow indicator
      const len = 55 + progress * 20;
      this.telegraphGfx.lineStyle(4, 0xff2200, 0.65 * alpha);
      this.telegraphGfx.moveTo(0, 0);
      this.telegraphGfx.lineTo(this.chargeDirX * len, this.chargeDirY * len);
      // Arrow head
      const perpX = -this.chargeDirY * 8, perpY = this.chargeDirX * 8;
      this.telegraphGfx.beginFill(0xff4400, 0.55 * alpha);
      this.telegraphGfx.drawPolygon([
        this.chargeDirX * (len + 12), this.chargeDirY * (len + 12),
        this.chargeDirX * len + perpX, this.chargeDirY * len + perpY,
        this.chargeDirX * len - perpX, this.chargeDirY * len - perpY,
      ]);
      this.telegraphGfx.endFill();
      // Warning pulse circle
      this.telegraphGfx.lineStyle(2, 0xff4444, 0.35 * progress);
      this.telegraphGfx.drawCircle(0, 0, 20 + progress * 10);
    }
  }
}

/** Bomber: approaches, starts ticking, explodes. */
export class BomberEnemy extends Enemy {
  bombState: 'approach' | 'ticking' | 'exploded' = 'approach';
  private bombTimer = 0;
  private readonly fuseTime = 2.0;
  private readonly explosionRadius = 90;
  private readonly explosionDamage = 70;
  private tickGfx: Graphics;
  exploded = false;

  constructor(x: number, y: number, hp = 80, speed = 90) {
    super(x, y, hp, speed, 20, 50, 25, 32, 32);
    this.tickGfx = new Graphics();
    this.container.addChild(this.tickGfx);
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.floatTimer += dt * 4;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.bombState === 'approach') {
      if (dist > 50) {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
      if (dist < 60) {
        this.bombState = 'ticking';
        this.bombTimer = this.fuseTime;
      }
    } else if (this.bombState === 'ticking') {
      this.bombTimer -= dt;
      if (dist > 20) {
        const mx = (dx / dist) * this.speed * 0.3 * dt;
        const my = (dy / dist) * this.speed * 0.3 * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
      if (this.bombTimer <= 0) {
        this.explode(player);
      }
    }
    this.syncGfx();
  }

  private explode(player: Player) {
    this.bombState = 'exploded';
    this.exploded = true;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.explosionRadius) {
      player.takeDamage(this.explosionDamage);
    }
    this.dead = true;
    this.container.visible = false;
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (!this.tickGfx) return;
    this.tickGfx.clear();

    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawCircle(0, 0, this.w * 0.45);
      g.endFill();
      return;
    }

    const ticking = this.bombState === 'ticking';
    const progress = ticking ? 1 - this.bombTimer / this.fuseTime : 0;
    const flash = ticking && Math.sin(this.floatTimer * (3 + progress * 12)) > 0;

    // Bomb body (round)
    const bodyColor = flash ? 0xdd2200 : (ticking ? 0xcc5500 : 0xcc8800);
    const highlightColor = flash ? 0xff5533 : (ticking ? 0xff8833 : 0xffcc44);
    g.beginFill(bodyColor);
    g.drawCircle(0, 2, this.w * 0.44);
    g.endFill();
    // Shine
    g.beginFill(highlightColor, 0.4);
    g.drawCircle(-this.w * 0.14, -this.w * 0.05, this.w * 0.22);
    g.endFill();
    // Dark band/stripes
    g.lineStyle(3, 0x221100, 0.5);
    g.drawCircle(0, 2, this.w * 0.44);
    g.lineStyle(2, 0x221100, 0.4);
    g.moveTo(-this.w * 0.4, 2); g.lineTo(this.w * 0.4, 2);
    g.lineStyle(0);

    // Fuse rope
    g.lineStyle(2.5, 0x887744, 0.9);
    g.moveTo(0, -this.w * 0.44);
    g.bezierCurveTo(4, -this.w * 0.6, 8, -this.w * 0.7, 6, -this.w * 0.85);
    g.lineStyle(0);
    // Fuse spark
    if (!ticking || Math.sin(this.floatTimer * 20) > 0) {
      g.beginFill(0xffee22, 0.9);
      g.drawCircle(6, -this.w * 0.85, 3);
      g.endFill();
      g.beginFill(0xffffff, 0.6);
      g.drawCircle(5.5, -this.w * 0.87, 1.5);
      g.endFill();
    }

    // Eyes (angry)
    g.beginFill(ticking ? 0xff2200 : 0xffaa44);
    g.drawCircle(-5, 0, 3);
    g.drawCircle(5, 0, 3);
    g.endFill();
    g.beginFill(0x110000);
    g.drawCircle(-4, 0.5, 1.5);
    g.drawCircle(6, 0.5, 1.5);
    g.endFill();

    // Ticking danger circle
    if (ticking) {
      this.tickGfx.lineStyle(2.5, 0xff2200, 0.25 + progress * 0.4);
      this.tickGfx.drawCircle(0, 0, this.explosionRadius * Math.min(progress * 1.2, 1));

      // Scale pulse based on ticking
      const pulse = 1 + progress * 0.35 * Math.abs(Math.sin(this.floatTimer * (3 + progress * 10)));
      this.bodyGfx.scale.set(pulse);
    } else {
      this.bodyGfx.scale.set(1);
    }
  }
}

/** Shield: blocks frontal attacks, must be hit from behind. */
export class ShieldEnemy extends Enemy {
  shieldAngle = 0;
  private shieldGfx: Graphics;

  constructor(x: number, y: number, hp = 180, speed = 55) {
    super(x, y, hp, speed, 44, 36, 35, 38, 38);
    this.shieldGfx = new Graphics();
    this.container.addChild(this.shieldGfx);
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * 2;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.shieldAngle = Math.atan2(dy, dx);

    if (dist < 300 && dist > this.attackRange * 0.8) {
      const mx = (dx / dist) * this.speed * dt;
      const my = (dy / dist) * this.speed * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    }
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 1.8;
    }
    this.syncGfx();
  }

  /** Check if an attack from (ax, ay) is blocked by shield */
  isBlocked(ax: number, ay: number): boolean {
    const attackAngle = Math.atan2(ay - this.y, ax - this.x);
    let diff = attackAngle - this.shieldAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < Math.PI / 3;
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 2, this.w * 0.44, this.h * 0.5);
      g.drawCircle(0, -this.h * 0.38, this.w * 0.3);
      g.endFill();
    } else {
      // Gray armored knight
      this.drawDemonBody(g, 0x4a4a6a, 0x7878aa, 0x99aadd);
      // Armor plates overlay
      g.beginFill(0x5a5a7a, 0.5);
      g.drawRoundedRect(-this.w * 0.35, -this.h * 0.25, this.w * 0.7, this.h * 0.5, 3);
      g.endFill();
    }

    // Shield arc
    if (!this.shieldGfx) return;
    this.shieldGfx.clear();
    const sr = this.w * 0.72;
    const sa = this.shieldAngle - Math.PI / 3;
    const ea = this.shieldAngle + Math.PI / 3;
    // Shield glow fill
    this.shieldGfx.beginFill(0x3377ff, 0.12);
    this.shieldGfx.moveTo(0, 0);
    this.shieldGfx.arc(0, 0, sr, sa, ea);
    this.shieldGfx.lineTo(0, 0);
    this.shieldGfx.endFill();
    // Shield outer edge
    this.shieldGfx.lineStyle(4, 0x55aaff, 0.75);
    this.shieldGfx.arc(0, 0, sr, sa, ea);
    // Inner rim
    this.shieldGfx.lineStyle(1.5, 0xaaddff, 0.4);
    this.shieldGfx.arc(0, 0, sr - 6, sa, ea);
    this.shieldGfx.lineStyle(0);
    // Shield boss (center ornament)
    const midA = (sa + ea) / 2;
    const bx = Math.cos(midA) * sr * 0.72, by = Math.sin(midA) * sr * 0.72;
    this.shieldGfx.beginFill(0x88ccff, 0.7);
    this.shieldGfx.drawCircle(bx, by, 4);
    this.shieldGfx.endFill();
  }
}

/** Summoner: spawns minions periodically. */
export class SummonerEnemy extends Enemy {
  summonTimer = 0;
  readonly summonInterval = 5;
  pendingSummon = false;

  constructor(x: number, y: number, hp = 200, speed = 40) {
    super(x, y, hp, speed, 30, 36, 50, 40, 40);
    this.summonTimer = 2;
  }

  update(dt: number, player: Player, map: WorldMap) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.floatTimer += dt * 2;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 150) {
      const mx = -(dx / dist) * this.speed * dt;
      const my = -(dy / dist) * this.speed * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    } else if (dist > 250 && dist < 400) {
      const mx = (dx / dist) * this.speed * 0.5 * dt;
      const my = (dy / dist) * this.speed * 0.5 * dt;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
    }

    this.summonTimer -= dt;
    if (this.summonTimer <= 0 && dist < 400) {
      this.pendingSummon = true;
      this.summonTimer = this.summonInterval;
    }

    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage);
      this.attackCooldown = 2;
    }
    this.syncGfx();
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 2, this.w * 0.44, this.h * 0.5);
      g.drawCircle(0, -this.h * 0.38, this.w * 0.3);
      g.endFill();
    } else {
      // Purple dark mage
      this.drawDemonBody(g, 0x3a0055, 0x8800cc, 0xdd44ff);

      // Robe overlay (wide flowing shape)
      g.beginFill(0x2a0040, 0.6);
      g.drawEllipse(0, 6, this.w * 0.55, this.h * 0.55);
      g.endFill();

      // Magical rune circles
      const nearSummon = this.summonTimer < 1.5 && this.summonTimer > 0;
      const alpha = nearSummon ? (1 - this.summonTimer / 1.5) * 0.6 : 0.15;
      g.lineStyle(1.5, 0xcc44ff, alpha + 0.1);
      g.drawCircle(0, 0, this.w * 0.65);
      g.lineStyle(1, 0x8800cc, alpha * 0.7);
      g.drawCircle(0, 0, this.w * 0.5);
      g.lineStyle(0);

      // Summoning pulse ring (when about to summon)
      if (nearSummon) {
        const summonProgress = 1 - this.summonTimer / 1.5;
        g.beginFill(0xcc44ff, summonProgress * 0.25);
        g.drawCircle(0, 0, this.w * 0.9 * summonProgress);
        g.endFill();
        // Star points
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + this.floatTimer * 2;
          const r = this.w * 0.6;
          g.beginFill(0xee66ff, 0.5 * summonProgress);
          g.drawCircle(Math.cos(a) * r, Math.sin(a) * r, 4);
          g.endFill();
        }
      }
    }
  }
}
