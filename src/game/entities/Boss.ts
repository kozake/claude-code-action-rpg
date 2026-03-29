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
  private shotInterval = 2.5;

  // Attack telegraph (existing phase-3 targeted)
  telegraphTimer = 0;
  telegraphX = 0;
  telegraphY = 0;
  telegraphR = 0;

  // Ground slam attack
  groundSlamCooldown = 0;
  groundSlamTelegraphTimer = 0;
  groundSlamX = 0;   // world coords
  groundSlamY = 0;
  groundSlamR = 80;
  groundSlamActive = false; // GameScene checks this flag

  // Spiral barrage
  private spiralAngle = 0;
  private spiralCooldown = 0;

  // Roar animation (set by GameScene during intro)
  roarAnimTimer = 0;

  private telegraphGfx: Graphics;
  private auraGfx: Graphics;
  private crownGfx: Graphics;

  // Dash attack
  private dashCooldown = 0;
  private dashActive = false;
  private dashVx = 0;
  private dashVy = 0;
  private dashTimer = 0;

  constructor(x: number, y: number) {
    super(x, y, 12000, 85, 70, 75, 500, 64, 64);

    this.crownGfx = new Graphics();
    this.container.addChild(this.crownGfx);

    this.auraGfx = new Graphics();
    this.container.addChildAt(this.auraGfx, 0);

    this.telegraphGfx = new Graphics();
    this.container.addChild(this.telegraphGfx);
  }

  update(dt: number, player: Player, map: WorldMap, fire?: FireFn) {
    if (this.dead) { super.update(dt, player, map); return; }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.spiralCooldown = Math.max(0, this.spiralCooldown - dt);
    this.groundSlamCooldown = Math.max(0, this.groundSlamCooldown - dt);
    this.groundSlamTelegraphTimer = Math.max(0, this.groundSlamTelegraphTimer - dt);
    this.roarAnimTimer = Math.max(0, this.roarAnimTimer - dt);
    this.floatTimer += dt * (this.isEnraged ? 7 : this.isAngry ? 5 : 2);
    this.updateKnockback(dt, map);
    this.telegraphTimer = Math.max(0, this.telegraphTimer - dt);

    // Phase transitions (tighter thresholds)
    if (!this.isAngry && this.hp < this.maxHp * 0.50) {
      this.isAngry = true; this.phase = 2;
      this.speed = 165; this.damage = 130; this.shotInterval = 1.0;
      this.phaseTransitioned = true;
    }
    if (!this.isEnraged && this.hp < this.maxHp * 0.25) {
      this.isEnraged = true; this.phase = 3;
      this.speed = 210; this.damage = 175; this.shotInterval = 0.6;
      this.phase3Transitioned = true;
    }

    if (this.stunTime > 0) { this.syncGfx(); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Movement
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

    // Melee attack
    if (dist < this.attackRange && this.attackCooldown <= 0) {
      player.takeDamage(this.damage, this.x, this.y);
      this.attackCooldown = this.isEnraged ? 0.3 : this.isAngry ? 0.55 : 0.9;
    }

    // Spread/burst projectiles
    if (fire && this.shotCooldown <= 0) {
      this.fireProjectiles(dx, dy, dist, fire);
      this.shotCooldown = this.shotInterval;
      if (this.isEnraged) {
        this.telegraphTimer = 1.0;
        this.telegraphX = player.x - this.x;
        this.telegraphY = player.y - this.y;
        this.telegraphR = 80;
      }
    }

    // Spiral barrage (all phases, increases in density)
    if (fire && this.spiralCooldown <= 0) {
      const count = this.isEnraged ? 5 : this.isAngry ? 4 : 3;
      const spd   = this.isEnraged ? 230 : this.isAngry ? 195 : 165;
      for (let i = 0; i < count; i++) {
        const a = this.spiralAngle + (i / count) * Math.PI * 2;
        fire(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd,
          this.isEnraged ? 45 : 35, 0x8800ff, 7);
        // Phase 3: double spiral (offset by PI)
        if (this.isEnraged) {
          const a2 = a + Math.PI;
          fire(this.x, this.y, Math.cos(a2) * spd * 0.85, Math.sin(a2) * spd * 0.85,
            35, 0xcc00cc, 6);
        }
      }
      this.spiralAngle += this.isEnraged ? 0.55 : this.isAngry ? 0.4 : 0.28;
      this.spiralCooldown = this.isEnraged ? 0.18 : this.isAngry ? 0.3 : 0.55;
    }

    // Ground slam attack (phase 2+)
    if ((this.isAngry || this.isEnraged) && this.groundSlamCooldown <= 0
        && this.groundSlamTelegraphTimer <= 0 && !this.groundSlamActive) {
      // Place warning at player's current position
      this.groundSlamX = player.x;
      this.groundSlamY = player.y;
      this.groundSlamTelegraphTimer = 1.8;
      this.groundSlamCooldown = this.isEnraged ? 3.5 : 5.5;
    }

    // When telegraph expires → trigger explosion (GameScene handles the damage)
    if (this.groundSlamTelegraphTimer > 0 && this.groundSlamTelegraphTimer <= dt * 1.5) {
      this.groundSlamActive = true;
    }

    // Dash attack (Phase 2+)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.dashActive) {
      this.dashTimer -= dt;
      const ds = (this.isEnraged ? 620 : 450) * dt;
      const mx = this.dashVx * ds;
      const my = this.dashVy * ds;
      if (!map.isColliding(this.x + mx, this.y, this.w, this.h)) this.x += mx;
      if (!map.isColliding(this.x, this.y + my, this.w, this.h)) this.y += my;
      // Deal damage on contact during dash
      const ddx = player.x - this.x, ddy = player.y - this.y;
      if (ddx * ddx + ddy * ddy < (this.w + player.w) * (this.w + player.w) * 0.5) {
        player.takeDamage(Math.round(this.damage * 1.6), this.x, this.y);
      }
      if (this.dashTimer <= 0) {
        this.dashActive = false;
        this.dashCooldown = this.isEnraged ? 2.0 : 3.5;
      }
    } else if ((this.isAngry || this.isEnraged) && this.dashCooldown <= 0 && dist > 150 && dist < 600) {
      this.dashActive = true;
      this.dashTimer = 0.35;
      this.dashVx = dx / dist;
      this.dashVy = dy / dist;
      this.dashCooldown = this.isEnraged ? 2.0 : 3.5;
    }

    this.syncGfx();
  }

  private fireProjectiles(dx: number, dy: number, _dist: number, fire: FireFn) {
    const ba = Math.atan2(dy, dx);
    const ps = 285;
    if (this.isEnraged) {
      // 16-way omnidirectional burst
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        fire(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, 55, 0xff00ff, 9);
      }
      // 9-shot targeted spread
      const sp = 0.22;
      for (let i = -4; i <= 4; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * (ps + 60), Math.sin(a) * (ps + 60), 60, 0xff3300, 10);
      }
      // Secondary delayed ring
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
        fire(this.x, this.y, Math.cos(a) * (ps * 0.7), Math.sin(a) * (ps * 0.7), 40, 0xcc00cc, 8);
      }
    } else if (this.isAngry) {
      // 11-shot spread
      const sp = 0.2;
      for (let i = -5; i <= 5; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, 42, 0xff6600, 9);
      }
      // 8-way burst
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        fire(this.x, this.y, Math.cos(a) * (ps * 0.65), Math.sin(a) * (ps * 0.65), 32, 0xff4400, 7);
      }
    } else {
      // 7-shot spread
      const sp = 0.2;
      for (let i = -3; i <= 3; i++) {
        const a = ba + i * sp;
        fire(this.x, this.y, Math.cos(a) * ps * 0.85, Math.sin(a) * ps * 0.85, 32, 0xff8800, 8);
      }
    }
  }

  protected drawBody(g: Graphics, isHit: boolean) {
    const w = this.w, h = this.h;
    const phaseScale = this.isEnraged ? 1.3 : this.isAngry ? 1.15 : 1.0;
    const pulse = this.isEnraged
      ? 1 + Math.sin(this.floatTimer * 3) * 0.08
      : this.isAngry
        ? 1 + Math.sin(this.floatTimer * 2) * 0.05
        : 1.0;
    const sc = phaseScale * pulse;

    // Roar animation: spread wings wider
    const roarSpread = this.roarAnimTimer > 0
      ? 1 + Math.min(1, (2.0 - this.roarAnimTimer) / 1.0) * 0.7
      : 1.0;

    if (isHit) {
      g.beginFill(0xffffff, 0.95);
      g.drawEllipse(0, 4, w * 0.5 * sc, h * 0.55 * sc);
      g.drawCircle(0, -h * 0.4 * sc, w * 0.38 * sc);
      g.drawEllipse(-w * 0.7 * sc * roarSpread, 0, w * 0.3 * sc, h * 0.25 * sc);
      g.drawEllipse(w * 0.7 * sc * roarSpread, 0, w * 0.3 * sc, h * 0.25 * sc);
      g.endFill();
      return;
    }

    // Color scheme based on phase
    let bodyColor: number, accColor: number, eyeColor: number, wingColor: number;
    if (this.isEnraged) {
      const pulseTint = Math.sin(this.floatTimer * 3) > 0;
      bodyColor = pulseTint ? 0x1a0025 : 0x250035;
      accColor = 0x9900cc;
      eyeColor = 0xff00ff;
      wingColor = 0x6600aa;
    } else if (this.isAngry) {
      bodyColor = 0x2a0808;
      accColor = 0xaa2200;
      eyeColor = 0xff4422;
      wingColor = 0x880000;
    } else {
      bodyColor = 0x1a1a32;
      accColor = 0x3344aa;
      eyeColor = 0xff2222;
      wingColor = 0x222244;
    }

    // ── Wings (spread wider during roar) ────────────────────────────────────────
    const ws = roarSpread;
    g.beginFill(wingColor, 0.55);
    g.drawPolygon([
      -w * 0.18 * sc, -h * 0.3 * sc,
      -w * 0.85 * sc * ws, -h * 0.55 * sc * (ws > 1 ? ws * 0.9 : 1),
      -w * 0.95 * sc * ws, h * 0.05 * sc,
      -w * 0.55 * sc * ws, h * 0.3 * sc,
      -w * 0.18 * sc, h * 0.05 * sc,
    ]);
    g.drawPolygon([
      w * 0.18 * sc, -h * 0.3 * sc,
      w * 0.85 * sc * ws, -h * 0.55 * sc * (ws > 1 ? ws * 0.9 : 1),
      w * 0.95 * sc * ws, h * 0.05 * sc,
      w * 0.55 * sc * ws, h * 0.3 * sc,
      w * 0.18 * sc, h * 0.05 * sc,
    ]);
    g.endFill();
    // Wing membranes
    g.lineStyle(1.5, accColor, 0.3);
    g.moveTo(-w * 0.2 * sc, -h * 0.25 * sc);
    g.lineTo(-w * 0.8 * sc * ws, -h * 0.5 * sc);
    g.moveTo(-w * 0.2 * sc, 0);
    g.lineTo(-w * 0.75 * sc * ws, h * 0.15 * sc);
    g.moveTo(w * 0.2 * sc, -h * 0.25 * sc);
    g.lineTo(w * 0.8 * sc * ws, -h * 0.5 * sc);
    g.moveTo(w * 0.2 * sc, 0);
    g.lineTo(w * 0.75 * sc * ws, h * 0.15 * sc);
    g.lineStyle(0);

    // ── Main body ──────────────────────────────────────────────────────────────
    g.beginFill(bodyColor);
    g.drawEllipse(0, 4 * sc, w * 0.5 * sc, h * 0.55 * sc);
    g.endFill();
    g.beginFill(accColor, 0.3);
    g.drawEllipse(-w * 0.14 * sc, -2 * sc, w * 0.22 * sc, h * 0.38 * sc);
    g.endFill();

    // Scale pattern
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const sx = col * w * 0.15 * sc + (row % 2 === 0 ? 0 : w * 0.07 * sc);
        const sy = row * h * 0.14 * sc - h * 0.1 * sc;
        g.beginFill(accColor, 0.22);
        g.drawPolygon([
          sx, sy - 5 * sc,
          sx + 6 * sc, sy + 2 * sc,
          sx, sy + 6 * sc,
          sx - 6 * sc, sy + 2 * sc,
        ]);
        g.endFill();
      }
    }

    // ── Head ──────────────────────────────────────────────────────────────────
    const headY = -h * 0.42 * sc;
    const headR = w * 0.38 * sc;
    g.beginFill(bodyColor);
    g.drawCircle(0, headY, headR);
    g.endFill();
    g.beginFill(accColor, 0.25);
    g.drawCircle(-headR * 0.28, headY - headR * 0.15, headR * 0.6);
    g.endFill();

    // Horns (spread during roar)
    const hornBaseY = headY - headR * 0.7;
    const hornSpread = roarSpread > 1 ? 1 + (roarSpread - 1) * 0.5 : 1;
    g.beginFill(bodyColor);
    g.drawPolygon([
      -headR * 0.45 * hornSpread, hornBaseY,
      -headR * 0.75 * hornSpread, hornBaseY - h * 0.3 * sc,
      -headR * 1.1 * hornSpread, hornBaseY - h * 0.45 * sc,
      -headR * 0.82 * hornSpread, hornBaseY - h * 0.47 * sc,
      -headR * 0.52 * hornSpread, hornBaseY - h * 0.3 * sc,
      -headR * 0.25 * hornSpread, hornBaseY,
    ]);
    g.drawPolygon([
      headR * 0.45 * hornSpread, hornBaseY,
      headR * 0.75 * hornSpread, hornBaseY - h * 0.3 * sc,
      headR * 1.1 * hornSpread, hornBaseY - h * 0.45 * sc,
      headR * 0.82 * hornSpread, hornBaseY - h * 0.47 * sc,
      headR * 0.52 * hornSpread, hornBaseY - h * 0.3 * sc,
      headR * 0.25 * hornSpread, hornBaseY,
    ]);
    g.endFill();
    g.beginFill(accColor, 0.35);
    g.drawPolygon([
      -headR * 0.55 * hornSpread, hornBaseY - h * 0.08 * sc,
      -headR * 0.85 * hornSpread, hornBaseY - h * 0.38 * sc,
      -headR * 0.62 * hornSpread, hornBaseY - h * 0.38 * sc,
      -headR * 0.35 * hornSpread, hornBaseY - h * 0.08 * sc,
    ]);
    g.drawPolygon([
      headR * 0.55 * hornSpread, hornBaseY - h * 0.08 * sc,
      headR * 0.85 * hornSpread, hornBaseY - h * 0.38 * sc,
      headR * 0.62 * hornSpread, hornBaseY - h * 0.38 * sc,
      headR * 0.35 * hornSpread, hornBaseY - h * 0.08 * sc,
    ]);
    g.endFill();

    // Eyes — flash white during roar
    const eyeY = headY - headR * 0.1;
    const eyeX = headR * 0.35;
    let renderEyeColor = eyeColor;
    let renderEyeIntensity = 1.0;
    if (this.roarAnimTimer > 0) {
      const roarProgress = 1 - this.roarAnimTimer / 2.0;
      if (roarProgress > 0.3) {
        const flash = (roarProgress - 0.3) / 0.7;
        renderEyeColor = 0xffffff;
        renderEyeIntensity = 0.5 + flash * 0.5;
      }
    }
    g.beginFill(renderEyeColor, 0.25 * renderEyeIntensity);
    g.drawCircle(-eyeX, eyeY, 9 * sc);
    g.drawCircle(eyeX, eyeY, 9 * sc);
    g.endFill();
    g.beginFill(renderEyeColor, 0.55 * renderEyeIntensity);
    g.drawCircle(-eyeX, eyeY, 6 * sc);
    g.drawCircle(eyeX, eyeY, 6 * sc);
    g.endFill();
    g.beginFill(0xffffff, 0.9);
    g.drawCircle(-eyeX, eyeY, 3.5 * sc);
    g.drawCircle(eyeX, eyeY, 3.5 * sc);
    g.endFill();
    g.beginFill(0x110000);
    g.drawEllipse(-eyeX + sc, eyeY + sc, 2 * sc, 3 * sc);
    g.drawEllipse(eyeX + sc, eyeY + sc, 2 * sc, 3 * sc);
    g.endFill();

    // Claws
    g.beginFill(bodyColor);
    for (let i = -1; i <= 1; i++) {
      const clawX = i * w * 0.28 * sc;
      const clawY = h * 0.52 * sc;
      g.drawPolygon([
        clawX - 5 * sc, clawY,
        clawX, clawY + 10 * sc,
        clawX + 5 * sc, clawY,
      ]);
    }
    g.endFill();

    // ── Crown ──────────────────────────────────────────────────────────────────
    if (!this.crownGfx) return;
    this.crownGfx.clear();
    this.crownGfx.y = this.bodyGfx.y;
    const cy = headY - headR - 4 * sc;
    const cw = 48 * sc, ch = 18 * sc;
    const cx = -cw / 2;
    this.crownGfx.beginFill(0xcc9900);
    this.crownGfx.drawRoundedRect(cx, cy + ch * 0.4, cw, ch * 0.6, 3);
    this.crownGfx.endFill();
    const pts: [number, number, number][] = [
      [cx + cw * 0.1, cy + ch * 0.4, ch * 0.9],
      [cx + cw * 0.5, cy, ch * 1.15],
      [cx + cw * 0.9, cy + ch * 0.4, ch * 0.9],
    ];
    for (const [px, py, ph] of pts) {
      this.crownGfx.beginFill(0xffdd00);
      this.crownGfx.drawPolygon([px - 7 * sc, py + ph, px, py - 4 * sc, px + 7 * sc, py + ph]);
      this.crownGfx.endFill();
      this.crownGfx.beginFill(0xffee88, 0.5);
      this.crownGfx.drawPolygon([px - 4 * sc, py + ph * 0.8, px, py, px + 4 * sc, py + ph * 0.8]);
      this.crownGfx.endFill();
    }
    this.crownGfx.beginFill(0xff2222);
    this.crownGfx.drawCircle(cx + cw * 0.28, cy + ch * 0.65, 4 * sc);
    this.crownGfx.endFill();
    this.crownGfx.beginFill(0x2244ff);
    this.crownGfx.drawCircle(cx + cw * 0.72, cy + ch * 0.65, 4 * sc);
    this.crownGfx.endFill();
    this.crownGfx.beginFill(0x22ff88);
    this.crownGfx.drawCircle(cx + cw * 0.5, cy + ch * 0.65, 4 * sc);
    this.crownGfx.endFill();
    this.crownGfx.beginFill(0xffffff, 0.6);
    this.crownGfx.drawCircle(cx + cw * 0.28 - 1, cy + ch * 0.65 - 1, 1.5 * sc);
    this.crownGfx.drawCircle(cx + cw * 0.72 - 1, cy + ch * 0.65 - 1, 1.5 * sc);
    this.crownGfx.drawCircle(cx + cw * 0.5 - 1, cy + ch * 0.65 - 1, 1.5 * sc);
    this.crownGfx.endFill();
  }

  protected render() {
    const hpRatio = this.hp / this.maxHp;
    const floatAmt = this.isEnraged ? 6 : this.isAngry ? 4 : 2;

    this.shadowGfx.clear();
    const phaseScale = this.isEnraged ? 1.3 : this.isAngry ? 1.15 : 1.0;
    this.shadowGfx.beginFill(0x000000, 0.32);
    this.shadowGfx.drawEllipse(0, this.h * 0.5 - 4, this.w * 0.58 * phaseScale, 9);
    this.shadowGfx.endFill();

    this.bodyGfx.y = Math.sin(this.floatTimer) * floatAmt - 4;
    this.bodyGfx.clear();
    this.drawBody(this.bodyGfx, this.hitFlash > 0);

    // Aura effect
    if (this.auraGfx) {
      this.auraGfx.clear();
      if (this.isEnraged) {
        this.auraGfx.beginFill(0xaa00ff, 0.08 + Math.sin(this.floatTimer * 4) * 0.05);
        this.auraGfx.drawCircle(0, 0, this.w * 1.1);
        this.auraGfx.endFill();
        this.auraGfx.beginFill(0xdd00ff, 0.10 + Math.sin(this.floatTimer * 6) * 0.05);
        this.auraGfx.drawCircle(0, 0, this.w * 0.72);
        this.auraGfx.endFill();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.floatTimer * 2;
          const r = this.w * 0.88;
          this.auraGfx.beginFill(0xee44ff, 0.45);
          this.auraGfx.drawCircle(Math.cos(a) * r, Math.sin(a) * r, 4);
          this.auraGfx.endFill();
        }
      } else if (this.isAngry) {
        this.auraGfx.beginFill(0xff2200, 0.07 + Math.sin(this.floatTimer * 3) * 0.04);
        this.auraGfx.drawCircle(0, 0, this.w * 0.85);
        this.auraGfx.endFill();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + this.floatTimer * 1.5;
          const r = this.w * 0.7;
          this.auraGfx.beginFill(0xff6633, 0.35);
          this.auraGfx.drawCircle(Math.cos(a) * r, Math.sin(a) * r, 3.5);
          this.auraGfx.endFill();
        }
      } else if (this.roarAnimTimer > 0) {
        // Roar aura: expanding red ring
        const roarProgress = 1 - this.roarAnimTimer / 2.0;
        const ringR = this.w * (0.8 + roarProgress * 1.2);
        this.auraGfx.beginFill(0xff2200, 0.15 * (1 - roarProgress));
        this.auraGfx.drawCircle(0, 0, ringR);
        this.auraGfx.endFill();
        this.auraGfx.lineStyle(3, 0xff4400, 0.5 * (1 - roarProgress));
        this.auraGfx.drawCircle(0, 0, ringR);
        this.auraGfx.lineStyle(0);
      }
    }

    // Telegraph circles
    if (this.telegraphGfx) {
      this.telegraphGfx.clear();
      // Phase-3 targeted telegraph
      if (this.telegraphTimer > 0) {
        const progress = 1 - this.telegraphTimer / 1.0;
        const alpha = 0.12 + progress * 0.28;
        this.telegraphGfx.beginFill(0xff0000, alpha);
        this.telegraphGfx.drawCircle(this.telegraphX, this.telegraphY, this.telegraphR * progress);
        this.telegraphGfx.endFill();
        this.telegraphGfx.lineStyle(2.5, 0xff4444, alpha + 0.1);
        this.telegraphGfx.drawCircle(this.telegraphX, this.telegraphY, this.telegraphR);
        this.telegraphGfx.lineStyle(0);
      }
      // Ground slam warning (world-relative offset)
      if (this.groundSlamTelegraphTimer > 0) {
        const elapsed = 1.8 - this.groundSlamTelegraphTimer;
        const progress = elapsed / 1.8;
        const alpha = 0.1 + progress * 0.4;
        const offX = this.groundSlamX - this.x;
        const offY = this.groundSlamY - this.y;
        // Pulsing fill
        const fillAlpha = alpha * (0.5 + Math.sin(this.floatTimer * 12) * 0.3);
        this.telegraphGfx.beginFill(0xff4400, fillAlpha);
        this.telegraphGfx.drawCircle(offX, offY, this.groundSlamR);
        this.telegraphGfx.endFill();
        // Ring border (thickens as time runs out)
        this.telegraphGfx.lineStyle(2 + progress * 4, 0xff6600, alpha + 0.2);
        this.telegraphGfx.drawCircle(offX, offY, this.groundSlamR);
        this.telegraphGfx.lineStyle(0);
        // Cross marker at center
        this.telegraphGfx.lineStyle(2, 0xffdd00, 0.7);
        this.telegraphGfx.moveTo(offX - 12, offY); this.telegraphGfx.lineTo(offX + 12, offY);
        this.telegraphGfx.moveTo(offX, offY - 12); this.telegraphGfx.lineTo(offX, offY + 12);
        this.telegraphGfx.lineStyle(0);
      }
    }

    // Boss HP bar (over head)
    this.hpBarGfx.clear();
    const bw = this.w + 28, bh = 10, bx = -bw / 2;
    const phScale = this.isEnraged ? 1.3 : this.isAngry ? 1.15 : 1.0;
    const by = -this.h * 0.5 * phScale - 38;
    this.hpBarGfx.beginFill(0x110000, 0.8);
    this.hpBarGfx.drawRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 4);
    this.hpBarGfx.endFill();
    const fc = hpRatio > 0.5 ? 0xff6600 : hpRatio > 0.25 ? 0xff2200 : 0xaa00ff;
    this.hpBarGfx.beginFill(fc);
    this.hpBarGfx.drawRoundedRect(bx, by, bw * hpRatio, bh, 3);
    this.hpBarGfx.endFill();
    this.hpBarGfx.beginFill(0xffffff, 0.2);
    this.hpBarGfx.drawRoundedRect(bx, by, bw * hpRatio, 3, 2);
    this.hpBarGfx.endFill();
    // Phase threshold markers at 50% and 25%
    this.hpBarGfx.lineStyle(1.5, 0xffffff, 0.6);
    this.hpBarGfx.moveTo(bx + bw * 0.5, by); this.hpBarGfx.lineTo(bx + bw * 0.5, by + bh);
    this.hpBarGfx.moveTo(bx + bw * 0.25, by); this.hpBarGfx.lineTo(bx + bw * 0.25, by + bh);
    this.hpBarGfx.lineStyle(0);
    this.hpBarGfx.lineStyle(1, 0xffffff, 0.35);
    this.hpBarGfx.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
    this.hpBarGfx.lineStyle(0);
  }
}
