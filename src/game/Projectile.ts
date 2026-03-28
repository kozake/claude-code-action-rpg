import { Graphics, Container } from 'pixi.js';
import type { Player } from './entities/Player';
import type { Enemy } from './entities/Enemy';

interface ProjEntry {
  x: number; y: number; vx: number; vy: number;
  damage: number; radius: number; color: number;
  age: number; lifetime: number; gfx: Graphics;
  pulseTimer: number;
  isPlayerProj: boolean;
}

export class ProjectileSystem {
  readonly container: Container;
  private list: ProjEntry[] = [];

  constructor() { this.container = new Container(); }

  add(x: number, y: number, vx: number, vy: number, damage: number,
    color = 0xff4400, radius = 7, lifetime = 4) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius, color, age: 0, lifetime, gfx,
      pulseTimer: Math.random() * Math.PI * 2, isPlayerProj: false });
  }

  /** Add a player-owned projectile (ranged slash skill) */
  addPlayerProjectile(x: number, y: number, vx: number, vy: number, damage: number) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius: 8, color: 0x88ddff, age: 0, lifetime: 1.5,
      gfx, pulseTimer: 0, isPlayerProj: true });
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
      // Trail
      if (p.isPlayerProj) {
        p.gfx.beginFill(p.color, 0.15);
        p.gfx.drawCircle(p.x - p.vx * dt * 2, p.y - p.vy * dt * 2, r * 1.5);
        p.gfx.endFill();
      }
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

  checkHitPlayer(player: Player): boolean {
    let hit = false;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.isPlayerProj) continue; // Skip player projectiles
      const dx = player.x - p.x, dy = player.y - p.y;
      const hitR = p.radius + player.w * 0.3;
      if (dx * dx + dy * dy < hitR * hitR) {
        player.takeDamage(p.damage);
        this.container.removeChild(p.gfx); this.list.splice(i, 1);
        hit = true;
      }
    }
    return hit;
  }

  /** Check player projectiles hitting enemies. Returns list of hit enemies + damage. */
  checkHitEnemies(enemies: Enemy[]): { enemy: Enemy; damage: number }[] {
    const hits: { enemy: Enemy; damage: number }[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.isPlayerProj) continue;
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
