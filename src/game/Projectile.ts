import { Graphics, Container } from 'pixi.js';
import type { Player } from './entities/Player';
import type { Enemy } from './entities/Enemy';

interface ProjEntry {
  x: number; y: number; vx: number; vy: number;
  damage: number; radius: number; color: number;
  age: number; lifetime: number; gfx: Graphics;
  pulseTimer: number;
  isPlayerProj: boolean;
  isCompanionProj: boolean;
}

export class ProjectileSystem {
  readonly container: Container;
  private list: ProjEntry[] = [];

  get count() { return this.list.length; }

  constructor() { this.container = new Container(); }

  add(x: number, y: number, vx: number, vy: number, damage: number,
    color = 0xff4400, radius = 7, lifetime = 4) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius, color, age: 0, lifetime, gfx,
      pulseTimer: Math.random() * Math.PI * 2, isPlayerProj: false, isCompanionProj: false });
  }

  /** Add a player-owned projectile (ranged slash skill) */
  addPlayerProjectile(x: number, y: number, vx: number, vy: number, damage: number) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius: 8, color: 0x88ddff, age: 0, lifetime: 1.5,
      gfx, pulseTimer: 0, isPlayerProj: true, isCompanionProj: false });
  }

  /** Add a companion magic projectile (pink, with sparkle trail) */
  addCompanionProjectile(x: number, y: number, vx: number, vy: number, damage: number) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius: 6, color: 0xff88ff, age: 0, lifetime: 1.6,
      gfx, pulseTimer: Math.random() * Math.PI * 2, isPlayerProj: false, isCompanionProj: true });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.lifetime) {
        this.container.removeChild(p.gfx); this.list.splice(i, 1); continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.pulseTimer += dt * 6;
      const pulse = 1 + Math.sin(p.pulseTimer) * 0.2;
      const r = p.radius * pulse;
      p.gfx.clear();

      if (p.isCompanionProj) {
        // Pink magic sparkle projectile
        // Trail
        p.gfx.beginFill(0xff44ff, 0.12);
        p.gfx.drawCircle(p.x - p.vx * dt * 3, p.y - p.vy * dt * 3, r * 1.8);
        p.gfx.endFill();
        // Outer glow
        p.gfx.beginFill(0xff88ff, 0.28);
        p.gfx.drawCircle(p.x, p.y, r * 2.0);
        p.gfx.endFill();
        // Mid
        p.gfx.beginFill(0xff44ee, 0.85);
        p.gfx.drawCircle(p.x, p.y, r);
        p.gfx.endFill();
        // Core white
        p.gfx.beginFill(0xffffff, 0.9);
        p.gfx.drawCircle(p.x, p.y, r * 0.38);
        p.gfx.endFill();
        // Sparkle cross
        const s = r * 0.7;
        p.gfx.lineStyle(1.2, 0xffffff, 0.6);
        p.gfx.moveTo(p.x - s, p.y); p.gfx.lineTo(p.x + s, p.y);
        p.gfx.moveTo(p.x, p.y - s); p.gfx.lineTo(p.x, p.y + s);
        p.gfx.lineStyle(0);
      } else if (p.isPlayerProj) {
        // Cyan player slash projectile
        p.gfx.beginFill(p.color, 0.15);
        p.gfx.drawCircle(p.x - p.vx * dt * 2, p.y - p.vy * dt * 2, r * 1.5);
        p.gfx.endFill();
        p.gfx.beginFill(p.color, 0.3);
        p.gfx.drawCircle(p.x, p.y, r * 1.8);
        p.gfx.endFill();
        p.gfx.beginFill(p.color, 1.0);
        p.gfx.drawCircle(p.x, p.y, r);
        p.gfx.endFill();
        p.gfx.beginFill(0xffffff, 0.6);
        p.gfx.drawCircle(p.x, p.y, r * 0.4);
        p.gfx.endFill();
      } else {
        // Enemy projectile (standard)
        p.gfx.beginFill(p.color, 0.3);
        p.gfx.drawCircle(p.x, p.y, r * 1.8);
        p.gfx.endFill();
        p.gfx.beginFill(p.color, 1.0);
        p.gfx.drawCircle(p.x, p.y, r);
        p.gfx.endFill();
        p.gfx.beginFill(0xffffff, 0.6);
        p.gfx.drawCircle(p.x, p.y, r * 0.4);
        p.gfx.endFill();
      }
    }
  }

  checkHitPlayer(player: Player): boolean {
    let hit = false;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.isPlayerProj || p.isCompanionProj) continue; // Skip friendly projectiles
      const dx = player.x - p.x, dy = player.y - p.y;
      const hitR = p.radius + player.w * 0.3;
      if (dx * dx + dy * dy < hitR * hitR) {
        player.takeDamage(p.damage, p.x, p.y);
        this.container.removeChild(p.gfx); this.list.splice(i, 1);
        hit = true;
      }
    }
    return hit;
  }

  /** Check player+companion projectiles hitting enemies. Returns list of hit enemies + damage. */
  checkHitEnemies(enemies: Enemy[]): { enemy: Enemy; damage: number }[] {
    const hits: { enemy: Enemy; damage: number }[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.isPlayerProj && !p.isCompanionProj) continue;
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - p.x, dy = enemy.y - p.y;
        const hitR = p.radius + enemy.w * 0.3;
        if (dx * dx + dy * dy < hitR * hitR) {
          hits.push({ enemy, damage: p.damage });
          this.container.removeChild(p.gfx); this.list.splice(i, 1);
          break;
        }
      }
    }
    return hits;
  }

  clear() {
    for (const p of this.list) this.container.removeChild(p.gfx);
    this.list = [];
  }
}
