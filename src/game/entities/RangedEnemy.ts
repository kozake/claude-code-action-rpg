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
    x: number, y: number, hp = 120, speed = 60, damage = 12,
    xpReward = 30, spriteUrl = './images/enemy2.png',
    shootInterval = 2.2, shootRange = 280,
    projectileDmg = 18, projectileColor = 0x00ccff,
  ) {
    super(x, y, hp, speed, damage, 40, xpReward, 36, 36, spriteUrl);
    this.shootInterval = shootInterval;
    this.shootRange = shootRange;
    this.projectileDmg = projectileDmg;
    this.projectileColor = projectileColor;
    this.shootCooldown = Math.random() * shootInterval;
  }

  update(dt: number, player: Player, map: WorldMap, fire?: FireFn) {
    if (this.dead) return;
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
      player.takeDamage(this.damage);
      this.attackCooldown = 1.5;
    }
    if (fire && dist < this.shootRange && this.shootCooldown <= 0) {
      const speed = 200;
      fire(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, this.projectileDmg, this.projectileColor, 6);
      this.shootCooldown = this.shootInterval;
    }
    this.syncGfx();
  }

  protected render() {
    super.render();
    if (this.hitFlash <= 0) { this.sprite.tint = 0xaaddff; }
  }
}
