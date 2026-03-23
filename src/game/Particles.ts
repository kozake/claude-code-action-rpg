import { Graphics, Container, Text } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  gravity: number;
}

interface DamageNum {
  text: Text;
  vy: number;
  life: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private damageNums: DamageNum[] = [];
  readonly container: Container;
  private gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  /** Emit burst of particles at world position */
  emit(
    x: number,
    y: number,
    count: number,
    color: number,
    speed = 120,
    gravity = 300,
    lifeBase = 0.4,
    lifeVariance = 0.3,
    sizeBase = 3,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = lifeBase + Math.random() * lifeVariance;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.3,
        life,
        maxLife: life,
        color,
        size: sizeBase * (0.5 + Math.random()),
        gravity,
      });
    }
  }

  /** Emit hit sparks (small yellow/white sparks) */
  emitHit(x: number, y: number) {
    this.emit(x, y, 5, 0xffdd44, 100, 200, 0.25, 0.15, 2);
    this.emit(x, y, 2, 0xffffff, 80, 200, 0.2, 0.1, 2);
  }

  /** Emit enemy death explosion */
  emitDeath(x: number, y: number, color: number) {
    this.emit(x, y, 10, color, 160, 280, 0.5, 0.4, 4);
    this.emit(x, y, 6, 0xffffff, 120, 250, 0.3, 0.2, 3);
    this.emit(x, y, 4, 0xffcc44, 80, 200, 0.6, 0.3, 3);
  }

  /** Emit boss phase 2 transition burst */
  emitBossRage(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      this.emit(x, y, 8, 0xff2200, 200, 350, 0.6, 0.4, 5);
      this.emit(x, y, 4, 0xff8800, 150, 300, 0.5, 0.3, 4);
    }
    this.emit(x, y, 6, 0xffffff, 250, 400, 0.4, 0.3, 6);
  }

  /** Show floating damage number at world position */
  showDamage(x: number, y: number, amount: number, isBoss = false) {
    const style = {
      fontSize: isBoss ? 22 : 15,
      fill: isBoss ? 0xff4444 : 0xffee00,
      fontWeight: 'bold' as const,
      stroke: 0x000000,
      strokeThickness: 4,
    };
    const t = new Text(`-${amount}`, style);
    t.anchor.set(0.5);
    t.x = x + (Math.random() - 0.5) * 20;
    t.y = y - 20;
    this.container.addChild(t);
    this.damageNums.push({ text: t, vy: -90, life: 1.0 });
  }

  /** Show level up effect */
  showLevelUp(x: number, y: number) {
    const t = new Text('LEVEL UP!', {
      fontSize: 18,
      fill: 0x88ff44,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 4,
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y - 40;
    this.container.addChild(t);
    this.damageNums.push({ text: t, vy: -60, life: 1.5 });

    this.emit(x, y, 12, 0x88ff44, 150, 250, 0.7, 0.3, 4);
    this.emit(x, y, 6, 0xffff44, 120, 200, 0.6, 0.3, 3);
  }

  update(dt: number, cameraX: number, cameraY: number) {
    this.container.x = -cameraX;
    this.container.y = -cameraY;

    this.gfx.clear();

    // Update particles
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 3; // friction
      p.vy += p.gravity * dt;

      const alpha = (p.life / p.maxLife) * 0.9;
      const size = p.size * (p.life / p.maxLife);

      this.gfx.beginFill(p.color, alpha);
      this.gfx.drawRect(p.x - size / 2, p.y - size / 2, size, size);
      this.gfx.endFill();
      return true;
    });

    // Update damage numbers
    this.damageNums = this.damageNums.filter((d) => {
      d.life -= dt;
      if (d.life <= 0) {
        d.text.destroy();
        return false;
      }
      d.vy += 40 * dt; // slow down rise
      d.text.y += d.vy * dt;
      d.text.alpha = Math.min(1, d.life * 2);
      return true;
    });
  }
}
