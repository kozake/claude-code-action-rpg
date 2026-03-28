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
    playerX: number, playerY: number,
    enemies: { x: number; y: number; dead: boolean }[],
    boss: { x: number; y: number; dead: boolean } | null,
    bossTriggered: boolean,
  ) {
    const g = this.dynamic;
    g.clear();

    const TILE_SIZE = 48;

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
