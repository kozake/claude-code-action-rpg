import { Graphics, Container } from 'pixi.js';
import type { Player } from './entities/Player';

interface ProjEntry {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: number;
  age: number;
  lifetime: number;
  gfx: Graphics;
  // visual pulse
  pulseTimer: number;
}

export class ProjectileSystem {
  readonly container: Container;
  private list: ProjEntry[] = [];

  constructor() {
    this.container = new Container();
  }

  /** Add a new enemy/boss projectile */
  add(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    color = 0xff4400,
    radius = 7,
    lifetime = 4,
  ) {
    const gfx = new Graphics();
    this.container.addChild(gfx);
    this.list.push({ x, y, vx, vy, damage, radius, color, age: 0, lifetime, gfx, pulseTimer: Math.random() * Math.PI * 2 });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.lifetime) {
        this.container.removeChild(p.gfx);
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.pulseTimer += dt * 6;

      // Draw
      const pulse = 1 + Math.sin(p.pulseTimer) * 0.2;
      const r = p.radius * pulse;
      p.gfx.clear();
      // Outer glow
      p.gfx.beginFill(p.color, 0.3);
      p.gfx.drawCircle(p.x, p.y, r * 1.8);
      p.gfx.endFill();
      // Core
      p.gfx.beginFill(p.color, 1.0);
      p.gfx.drawCircle(p.x, p.y, r);
      p.gfx.endFill();
      // Bright center
      p.gfx.beginFill(0xffffff, 0.6);
      p.gfx.drawCircle(p.x, p.y, r * 0.4);
      p.gfx.endFill();
    }
  }

  /**
   * Check if any projectile hits the player.
   * Returns true if damage was dealt (player takes damage internally).
   */
  checkHitPlayer(player: Player): boolean {
    let hit = false;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist2 = dx * dx + dy * dy;
      const hitR = p.radius + player.w * 0.3;
      if (dist2 < hitR * hitR) {
        player.takeDamage(p.damage);
        this.container.removeChild(p.gfx);
        this.list.splice(i, 1);
        hit = true;
      }
    }
    return hit;
  }

  clear() {
    for (const p of this.list) this.container.removeChild(p.gfx);
    this.list = [];
  }
}
