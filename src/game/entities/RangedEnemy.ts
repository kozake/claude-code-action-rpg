import { Graphics } from 'pixi.js';
import { Enemy, type FireFn } from './Enemy';
import type { Player } from './Player';
import type { WorldMap } from '../maps/WorldMap';

export class RangedEnemy extends Enemy {
  private shootCooldown = 0;
  private readonly shootInterval: number;
  private readonly shootRange: number;
  private readonly projectileDmg: number;
  private readonly projectileColor: number;

  constructor(
    x: number, y: number, hp = 120, speed = 60, damage = 24,
    xpReward = 30,
    shootInterval = 2.2, shootRange = 280,
    projectileDmg = 36, projectileColor = 0x00ccff,
  ) {
    super(x, y, hp, speed, damage, 40, xpReward, 36, 36);
    this.shootInterval = shootInterval;
    this.shootRange = shootRange;
    this.projectileDmg = projectileDmg;
    this.projectileColor = projectileColor;
    this.shootCooldown = Math.random() * shootInterval;
  }

  update(dt: number, player: Player, map: WorldMap, fire?: FireFn) {
    if (this.dead) { super.update(dt, player, map); return; }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.floatTimer += dt * 2.5;
    this.updateKnockback(dt, map);
    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const idealDist = 200;

    if (dist < 360) {
      let mx = 0, my = 0;
      if (dist < idealDist - 30) {
        mx = -(dx / dist) * this.speed * dt;
        my = -(dy / dist) * this.speed * dt;
      } else if (dist > idealDist + 30) {
        mx = (dx / dist) * this.speed * 0.7 * dt;
        my = (dy / dist) * this.speed * 0.7 * dt;
      }
      if (mx !== 0 || my !== 0) {
        if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
        if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      }
    }
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage, this.x, this.y);
      this.attackCooldown = 1.5;
    }
    if (fire && dist < this.shootRange && this.shootCooldown <= 0) {
      const speed = 200;
      fire(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, this.projectileDmg, this.projectileColor, 6);
      this.shootCooldown = this.shootInterval;
    }
    this.syncGfx();
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 2, this.w * 0.44, this.h * 0.5);
      g.drawCircle(0, -this.h * 0.38, this.w * 0.3);
      g.endFill();
      return;
    }
    // Arcane mage: teal-blue robed figure
    this.drawDemonBody(g, 0x1a4488, 0x3388cc, 0x55eeff);

    // Magical orb held in front
    g.beginFill(0x00aaee, 0.25);
    g.drawCircle(this.w * 0.4, 0, 8);
    g.endFill();
    g.beginFill(0x22ddff, 0.8);
    g.drawCircle(this.w * 0.4, 0, 5);
    g.endFill();
    g.beginFill(0xaaeeff);
    g.drawCircle(this.w * 0.4 - 1.5, -1.5, 2);
    g.endFill();
  }
}
