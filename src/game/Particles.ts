import { Graphics, Container, Text } from 'pixi.js';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: number;
  size: number; gravity: number;
}

interface DamageNum {
  text: Text; vy: number; life: number;
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

  emit(x: number, y: number, count: number, color: number,
    speed = 120, gravity = 300, lifeBase = 0.4, lifeVariance = 0.3, sizeBase = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = lifeBase + Math.random() * lifeVariance;
      this.particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.3,
        life, maxLife: life, color, size: sizeBase * (0.5 + Math.random()), gravity,
      });
    }
  }

  emitHit(x: number, y: number) {
    this.emit(x, y, 5, 0xffdd44, 100, 200, 0.25, 0.15, 2);
    this.emit(x, y, 2, 0xffffff, 80, 200, 0.2, 0.1, 2);
  }

  emitDeath(x: number, y: number, color: number) {
    this.emit(x, y, 10, color, 160, 280, 0.5, 0.4, 4);
    this.emit(x, y, 6, 0xffffff, 120, 250, 0.3, 0.2, 3);
    this.emit(x, y, 4, 0xffcc44, 80, 200, 0.6, 0.3, 3);
  }

  emitBossRage(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      this.emit(x, y, 8, 0xff2200, 200, 350, 0.6, 0.4, 5);
      this.emit(x, y, 4, 0xff8800, 150, 300, 0.5, 0.3, 4);
    }
    this.emit(x, y, 6, 0xffffff, 250, 400, 0.4, 0.3, 6);
  }

  showDamage(x: number, y: number, amount: number, isBoss = false, isCrit = false) {
    const fontSize = isCrit ? 26 : isBoss ? 22 : 15;
    const color = isCrit ? 0xff4444 : isBoss ? 0xff4444 : 0xffee00;
    const t = new Text(`${isCrit ? '💥' : '-'}${amount}`, {
      fontSize, fill: color, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 4,
    });
    t.anchor.set(0.5);
    t.x = x + (Math.random() - 0.5) * 20;
    t.y = y - 20;
    this.container.addChild(t);
    this.damageNums.push({ text: t, vy: isCrit ? -120 : -90, life: isCrit ? 1.3 : 1.0 });
  }

  /** Small dust puff at player's feet while walking */
  emitFootstep(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = 15 + Math.random() * 25;
      const life = 0.2 + Math.random() * 0.15;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + 14,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 10,
        life, maxLife: life,
        color: 0x999988,
        size: 1.5 + Math.random(),
        gravity: 30,
      });
    }
  }

  /** Ambient environment particles based on floor theme */
  private ambientTimer = 0;
  emitAmbient(dt: number, theme: string, cx: number, cy: number, sw: number, sh: number) {
    this.ambientTimer += dt;
    // Limit ambient particles
    const ambientCount = this.particles.filter(p => p.gravity <= 5).length;
    if (ambientCount > 15) return;

    const interval = 0.25;
    if (this.ambientTimer < interval) return;
    this.ambientTimer -= interval;

    const rx = cx + (Math.random() - 0.5) * sw;
    const ry = cy + (Math.random() - 0.5) * sh;

    switch (theme) {
      case 'Stone Labyrinth': {
        // Dust motes drifting down
        const life = 2 + Math.random();
        this.particles.push({
          x: rx, y: ry, vx: (Math.random() - 0.5) * 8, vy: 8 + Math.random() * 5,
          life, maxLife: life, color: 0x888877, size: 1.2, gravity: 3,
        });
        break;
      }
      case 'Fire Cavern': {
        // Rising embers
        const life = 1.5 + Math.random();
        this.particles.push({
          x: rx, y: ry + sh * 0.3, vx: (Math.random() - 0.5) * 15, vy: -30 - Math.random() * 20,
          life, maxLife: life, color: Math.random() > 0.5 ? 0xff6622 : 0xff9944, size: 1.8, gravity: -5,
        });
        break;
      }
      case 'Ice Crypt': {
        // Snowflakes drifting
        const life = 3 + Math.random();
        this.particles.push({
          x: rx, y: ry - sh * 0.3, vx: (Math.random() - 0.5) * 12 + 5, vy: 10 + Math.random() * 8,
          life, maxLife: life, color: Math.random() > 0.5 ? 0xccddff : 0xffffff, size: 1.5, gravity: 2,
        });
        break;
      }
      case 'Shadow Depths': {
        // Dark wisps floating
        const life = 2.5 + Math.random();
        this.particles.push({
          x: rx, y: ry, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
          life, maxLife: life, color: 0x8844aa, size: 2, gravity: 0,
        });
        break;
      }
      case 'Demon Throne': {
        // Golden sparkles
        const life = 1.5 + Math.random();
        this.particles.push({
          x: rx, y: ry, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
          life, maxLife: life, color: Math.random() > 0.5 ? 0xffcc44 : 0xffee88, size: 1.5, gravity: 0,
        });
        break;
      }
    }
  }

  showLevelUp(x: number, y: number) {
    const t = new Text('LEVEL UP!', {
      fontSize: 18, fill: 0x88ff44, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 4,
    });
    t.anchor.set(0.5); t.x = x; t.y = y - 40;
    this.container.addChild(t);
    this.damageNums.push({ text: t, vy: -60, life: 1.5 });
    this.emit(x, y, 12, 0x88ff44, 150, 250, 0.7, 0.3, 4);
    this.emit(x, y, 6, 0xffff44, 120, 200, 0.6, 0.3, 3);
  }

  update(dt: number, cameraX: number, cameraY: number) {
    this.container.x = -cameraX;
    this.container.y = -cameraY;
    this.gfx.clear();

    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 3; p.vy += p.gravity * dt;
      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio * 0.92;
      const size = p.size * lifeRatio;
      // Draw circle particles (smooth, no squares)
      this.gfx.beginFill(p.color, alpha);
      this.gfx.drawCircle(p.x, p.y, size * 0.65);
      this.gfx.endFill();
      // Small white core for sparkle effect
      if (lifeRatio > 0.5 && size > 2) {
        this.gfx.beginFill(0xffffff, alpha * 0.4);
        this.gfx.drawCircle(p.x, p.y, size * 0.22);
        this.gfx.endFill();
      }
      return true;
    });

    this.damageNums = this.damageNums.filter((d) => {
      d.life -= dt;
      if (d.life <= 0) { d.text.destroy(); return false; }
      d.vy += 40 * dt;
      d.text.y += d.vy * dt;
      d.text.alpha = Math.min(1, d.life * 2);
      return true;
    });
  }
}
