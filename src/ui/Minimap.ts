import { Graphics, Container } from 'pixi.js';
import { TILE, type WorldMap } from '../game/maps/WorldMap';

const MM_SCALE = 3; // pixels per tile
const MARGIN = 10;

export class Minimap {
  readonly container: Container;
  private bg: Graphics;
  private dynamic: Graphics;
  private screenW: number;
  private mapCols = 0;
  private mapRows = 0;
  private stairsCol = -1;
  private stairsRow = -1;
  private stairsVisible = false;
  private blinkTimer = 0;

  constructor(screenW: number, _screenH: number, map: WorldMap) {
    this.screenW = screenW;
    this.container = new Container();
    this.container.alpha = 0.7;

    this.bg = new Graphics();
    this.dynamic = new Graphics();
    this.container.addChild(this.bg);
    this.container.addChild(this.dynamic);

    this.buildBackground(map);
    this.updatePosition();
  }

  rebuild(map: WorldMap) {
    this.buildBackground(map);
    this.updatePosition();
    this.stairsVisible = false;
    this.stairsCol = -1;
    this.stairsRow = -1;
  }

  /** Mark stairs as visible for blinking effect */
  showStairs(col: number, row: number) {
    this.stairsCol = col;
    this.stairsRow = row;
    this.stairsVisible = true;
    this.blinkTimer = 0;
  }

  private buildBackground(map: WorldMap) {
    this.mapCols = map.cols;
    this.mapRows = map.rows;
    const mmW = this.mapCols * MM_SCALE;
    const mmH = this.mapRows * MM_SCALE;

    this.bg.clear();
    this.bg.beginFill(0x000000, 0.5);
    this.bg.drawRoundedRect(-2, -2, mmW + 4, mmH + 4, 3);
    this.bg.endFill();

    for (let r = 0; r < this.mapRows; r++) {
      for (let c = 0; c < this.mapCols; c++) {
        const tile = map.data[r][c];
        if (tile === TILE.WALL) {
          this.bg.beginFill(0x666666);
        } else if (tile === TILE.BOSS_FLOOR) {
          this.bg.beginFill(0x331144);
        } else if (tile === TILE.STAIRS) {
          this.bg.beginFill(0x44ddaa);
        } else {
          this.bg.beginFill(0x224422);
        }
        this.bg.drawRect(c * MM_SCALE, r * MM_SCALE, MM_SCALE, MM_SCALE);
        this.bg.endFill();
      }
    }
  }

  private updatePosition() {
    const mmW = this.mapCols * MM_SCALE;
    this.container.x = this.screenW - mmW - MARGIN;
    this.container.y = MARGIN;
  }

  update(
    dt: number,
    playerX: number, playerY: number,
    enemies: { x: number; y: number; dead: boolean }[],
    boss: { x: number; y: number; dead: boolean } | null,
    bossTriggered: boolean,
    companion?: { x: number; y: number; state: string } | null,
  ) {
    const g = this.dynamic;
    g.clear();

    const TILE_SIZE = 48;

    // Stairs blinking & ripple effect
    if (this.stairsVisible && this.stairsCol >= 0) {
      this.blinkTimer += dt;
      const sx = (this.stairsCol + 0.5) * MM_SCALE;
      const sy = (this.stairsRow + 0.5) * MM_SCALE;

      // Pulsing glow
      const pulse = 0.5 + 0.5 * Math.sin(this.blinkTimer * 5);
      g.beginFill(0x44ddaa, 0.3 + 0.4 * pulse);
      g.drawCircle(sx, sy, 5 + pulse * 2);
      g.endFill();

      // Expanding ripple rings
      for (let i = 0; i < 2; i++) {
        const phase = (this.blinkTimer * 1.5 + i * 0.5) % 1.0;
        const rippleR = 4 + phase * 12;
        const rippleAlpha = (1 - phase) * 0.4;
        g.lineStyle(1, 0x44ddaa, rippleAlpha);
        g.drawCircle(sx, sy, rippleR);
        g.lineStyle(0);
      }

      // Bright center dot
      g.beginFill(0x88ffcc, 0.7 + 0.3 * pulse);
      g.drawCircle(sx, sy, 2);
      g.endFill();
    }

    // Enemies as red dots
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = (e.x / TILE_SIZE) * MM_SCALE;
      const ey = (e.y / TILE_SIZE) * MM_SCALE;
      g.beginFill(0xff4444);
      g.drawRect(ex - 1, ey - 1, 2, 2);
      g.endFill();
    }

    // Boss as yellow dot
    if (boss && !boss.dead && bossTriggered) {
      const bx = (boss.x / TILE_SIZE) * MM_SCALE;
      const by = (boss.y / TILE_SIZE) * MM_SCALE;
      g.beginFill(0xffdd00);
      g.drawRect(bx - 2, by - 2, 4, 4);
      g.endFill();
    }

    // Companion as pink dot
    if (companion && companion.state !== 'downed') {
      const cpx = (companion.x / TILE_SIZE) * MM_SCALE;
      const cpy = (companion.y / TILE_SIZE) * MM_SCALE;
      g.beginFill(0xff88cc);
      g.drawCircle(cpx, cpy, 2);
      g.endFill();
    }

    // Player as green dot (on top)
    const px = (playerX / TILE_SIZE) * MM_SCALE;
    const py = (playerY / TILE_SIZE) * MM_SCALE;
    g.beginFill(0x44ff44);
    g.drawCircle(px, py, 2.5);
    g.endFill();
  }

  onResize(screenW: number, _screenH: number) {
    this.screenW = screenW;
    this.updatePosition();
  }
}
