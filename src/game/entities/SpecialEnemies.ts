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
    super(x, y, hp, speed, 25, 40, 30, 40, 40, './images/enemy1.png');
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
      // Chase player
      if (dist < 300 && dist > 100) {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
      // Start telegraph when close enough
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
        this.stunTime = 1.5; // stun on wall hit
        this.chargeState = 'idle';
      } else {
        this.x += mx; this.y += my;
        // Hit player during charge
        if (dist < this.attackRange) {
          player.takeDamage(this.damage * 1.5);
        }
      }
      if (this.chargeTimer <= 0) this.chargeState = 'idle';
    }
    this.syncGfx();
  }

  protected render() {
    super.render();
    if (this.hitFlash <= 0 && this.chargeState !== 'telegraph') {
      this.sprite.tint = 0xff8844; // orange tint
    }
    // Telegraph visual
    this.telegraphGfx.clear();
    if (this.chargeState === 'telegraph') {
      this.sprite.tint = 0xff0000;
      // Arrow showing charge direction
      const len = 60;
      this.telegraphGfx.lineStyle(3, 0xff0000, 0.7);
      this.telegraphGfx.moveTo(0, 0);
      this.telegraphGfx.lineTo(this.chargeDirX * len, this.chargeDirY * len);
      // Warning circle
      this.telegraphGfx.lineStyle(2, 0xff4444, 0.4);
      this.telegraphGfx.drawCircle(0, 0, 20);
    }
  }
}

/** Bomber: approaches, starts ticking, explodes. */
export class BomberEnemy extends Enemy {
  bombState: 'approach' | 'ticking' | 'exploded' = 'approach';
  private bombTimer = 0;
  private readonly fuseTime = 2.0;
  private readonly explosionRadius = 90;
  private readonly explosionDamage = 35;
  private tickGfx: Graphics;
  exploded = false; // flag for GameScene to emit particles

  constructor(x: number, y: number, hp = 80, speed = 90) {
    super(x, y, hp, speed, 10, 50, 25, 32, 32, './images/enemy3.png');
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
      // Still chase slowly
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

  protected render() {
    super.render();
    this.tickGfx.clear();
    if (this.bombState === 'ticking') {
      const progress = 1 - this.bombTimer / this.fuseTime;
      // Flashing red, faster as fuse runs out
      const flashRate = 3 + progress * 12;
      const flash = Math.sin(this.floatTimer * flashRate) > 0;
      this.sprite.tint = flash ? 0xff0000 : 0xff8800;
      // Growing danger circle
      this.tickGfx.lineStyle(2, 0xff0000, 0.3 + progress * 0.4);
      this.tickGfx.drawCircle(0, 0, this.explosionRadius * progress);
      // Scale pulsing
      const scale = (this.w / 16) * (1 + progress * 0.3);
      this.sprite.scale.set(scale);
    } else if (this.hitFlash <= 0) {
      this.sprite.tint = 0xffaa00;
    }
  }
}

/** Shield: blocks frontal attacks, must be hit from behind. */
export class ShieldEnemy extends Enemy {
  shieldAngle = 0; // angle facing player
  private shieldGfx: Graphics;

  constructor(x: number, y: number, hp = 180, speed = 55) {
    super(x, y, hp, speed, 22, 36, 35, 38, 38, './images/enemy2.png');
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
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Shield blocks ~120 degree arc in front
    return Math.abs(diff) < Math.PI / 3;
  }

  protected render() {
    super.render();
    if (this.hitFlash <= 0) this.sprite.tint = 0x88aacc;
    // Draw shield arc
    this.shieldGfx.clear();
    const sr = this.w * 0.7;
    const sa = this.shieldAngle - Math.PI / 3;
    const ea = this.shieldAngle + Math.PI / 3;
    this.shieldGfx.lineStyle(4, 0x4488ff, 0.7);
    this.shieldGfx.arc(0, 0, sr, sa, ea);
    this.shieldGfx.beginFill(0x4488ff, 0.15);
    this.shieldGfx.moveTo(0, 0);
    this.shieldGfx.arc(0, 0, sr, sa, ea);
    this.shieldGfx.lineTo(0, 0);
    this.shieldGfx.endFill();
  }
}

/** Summoner: spawns minions periodically. */
export class SummonerEnemy extends Enemy {
  summonTimer = 0;
  readonly summonInterval = 5;
  pendingSummon = false; // flag for GameScene to spawn minions

  constructor(x: number, y: number, hp = 200, speed = 40) {
    super(x, y, hp, speed, 15, 36, 50, 40, 40, './images/enemy3.png');
    this.summonTimer = 2; // initial delay
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

    // Keep distance
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

    // Summon timer
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

  protected render() {
    super.render();
    if (this.hitFlash <= 0) {
      this.sprite.tint = 0xcc44ff; // purple tint
    }
    // Summon aura when close to summoning
    if (this.summonTimer < 1.5 && this.summonTimer > 0) {
      const gfx = this.hpBarGfx; // reuse for overlay drawing
      const alpha = (1 - this.summonTimer / 1.5) * 0.3;
      gfx.beginFill(0xcc44ff, alpha);
      gfx.drawCircle(0, 0, this.w);
      gfx.endFill();
    }
  }
}
