import { Graphics, RenderTexture, Sprite, Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';

export const TILE_SIZE = 48;
export const MAP_COLS = 50;
export const MAP_ROWS = 40;

export const TILE = {
  GRASS: 0,
  WALL: 1,
  BOSS_FLOOR: 2,
} as const;
type TileType = (typeof TILE)[keyof typeof TILE];

const TILE_COLORS: Record<TileType, number> = {
  [TILE.GRASS]: 0x3d8b3d,
  [TILE.WALL]: 0x445566,
  [TILE.BOSS_FLOOR]: 0x2a1440,
};

const TILE_BORDER: Record<TileType, number> = {
  [TILE.GRASS]: 0x2d6b2d,
  [TILE.WALL]: 0x334455,
  [TILE.BOSS_FLOOR]: 0x1a0a2a,
};

export class WorldMap {
  readonly data: TileType[][];
  readonly container: Container;
  readonly pixelWidth = MAP_COLS * TILE_SIZE;
  readonly pixelHeight = MAP_ROWS * TILE_SIZE;

  // Boss room entry row
  readonly bossRowStart = 30;

  constructor(renderer: Renderer) {
    this.data = this.buildMap();
    this.container = new Container();
    this.renderToTexture(renderer);
  }

  private buildMap(): TileType[][] {
    const m: TileType[][] = Array.from({ length: MAP_ROWS }, () =>
      new Array<TileType>(MAP_COLS).fill(TILE.GRASS),
    );

    // Perimeter walls
    for (let c = 0; c < MAP_COLS; c++) {
      m[0][c] = TILE.WALL;
      m[MAP_ROWS - 1][c] = TILE.WALL;
    }
    for (let r = 0; r < MAP_ROWS; r++) {
      m[r][0] = TILE.WALL;
      m[r][MAP_COLS - 1] = TILE.WALL;
    }

    // Field obstacle clusters [row, col, rows, cols]
    const obstacles: [number, number, number, number][] = [
      [3, 4, 2, 4],
      [6, 15, 3, 3],
      [8, 7, 4, 2],
      [12, 26, 2, 4],
      [5, 36, 4, 2],
      [10, 41, 3, 2],
      [7, 45, 3, 2],
      [15, 12, 2, 5],
      [18, 30, 4, 2],
      [2, 22, 3, 3],
      [20, 8, 3, 3],
      [22, 40, 2, 4],
      [14, 5, 3, 2],
      [16, 20, 2, 6],
      [4, 28, 3, 2],
      [19, 15, 2, 3],
    ];
    for (const [r, c, dr, dc] of obstacles) {
      for (let dy = 0; dy < dr; dy++) {
        for (let dx = 0; dx < dc; dx++) {
          const row = r + dy;
          const col = c + dx;
          if (row >= 1 && row < 29 && col >= 1 && col < MAP_COLS - 1) {
            m[row][col] = TILE.WALL;
          }
        }
      }
    }

    // Dividing wall between field and boss room (row 29)
    for (let c = 0; c < MAP_COLS; c++) m[29][c] = TILE.WALL;
    // Door gap (3 tiles wide, centered)
    m[29][23] = TILE.GRASS;
    m[29][24] = TILE.GRASS;
    m[29][25] = TILE.GRASS;

    // Boss room floor
    for (let r = 30; r < MAP_ROWS - 1; r++) {
      for (let c = 1; c < MAP_COLS - 1; c++) {
        m[r][c] = TILE.BOSS_FLOOR;
      }
    }

    // Boss room inner walls (decorative pillars)
    const pillars: [number, number][] = [
      [32, 10], [32, 39], [36, 10], [36, 39],
      [32, 24], [36, 24],
    ];
    for (const [r, c] of pillars) {
      m[r][c] = TILE.WALL;
      m[r][c + 1] = TILE.WALL;
      m[r + 1][c] = TILE.WALL;
      m[r + 1][c + 1] = TILE.WALL;
    }

    return m;
  }

  private renderToTexture(renderer: Renderer) {
    const gfx = new Graphics();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.data[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // Tile fill
        gfx.beginFill(TILE_COLORS[tile]);
        gfx.drawRect(x, y, TILE_SIZE, TILE_SIZE);
        gfx.endFill();

        // Tile border (subtle)
        gfx.beginFill(TILE_BORDER[tile]);
        gfx.drawRect(x, y, TILE_SIZE, 1);
        gfx.drawRect(x, y, 1, TILE_SIZE);
        gfx.endFill();
      }
    }

    // Door indicator (bright gap on dividing wall)
    gfx.beginFill(0x88ff88, 0.4);
    gfx.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    gfx.endFill();

    // "BOSS ROOM" text hints (arrow decoration on door)
    gfx.beginFill(0xffaa00);
    const doorCx = 24.5 * TILE_SIZE;
    const doorCy = 28.5 * TILE_SIZE;
    gfx.drawPolygon([
      doorCx - 12, doorCy - 8,
      doorCx + 12, doorCy - 8,
      doorCx, doorCy + 8,
    ]);
    gfx.endFill();

    const rt = RenderTexture.create({ width: this.pixelWidth, height: this.pixelHeight });
    renderer.render(gfx, { renderTexture: rt });

    const sprite = new Sprite(rt);
    this.container.addChild(sprite);
  }

  isColliding(cx: number, cy: number, w: number, h: number): boolean {
    const half = 2; // shrink hitbox slightly for smoother movement
    const corners: [number, number][] = [
      [cx - w / 2 + half, cy - h / 2 + half],
      [cx + w / 2 - half, cy - h / 2 + half],
      [cx - w / 2 + half, cy + h / 2 - half],
      [cx + w / 2 - half, cy + h / 2 - half],
    ];
    for (const [px, py] of corners) {
      const tc = Math.floor(px / TILE_SIZE);
      const tr = Math.floor(py / TILE_SIZE);
      if (tc < 0 || tr < 0 || tc >= MAP_COLS || tr >= MAP_ROWS) return true;
      if (this.data[tr][tc] === TILE.WALL) return true;
    }
    return false;
  }

  getTileAt(wx: number, wy: number): TileType {
    const tc = Math.floor(wx / TILE_SIZE);
    const tr = Math.floor(wy / TILE_SIZE);
    if (tc < 0 || tr < 0 || tc >= MAP_COLS || tr >= MAP_ROWS) return TILE.WALL;
    return this.data[tr][tc];
  }
}
