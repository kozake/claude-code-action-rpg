import { Graphics, RenderTexture, Sprite, Container, Texture } from 'pixi.js';
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

// Torch decoration positions [col, row] placed on walls near the field
const TORCH_POSITIONS: [number, number][] = [
  [8, 0], [20, 0], [32, 0], [44, 0],
  [0, 6], [0, 14], [0, 22],
  [49, 8], [49, 16], [49, 24],
  [8, 28], [20, 28], [32, 28], [44, 28],
  // Boss room torches
  [8, 30], [20, 30], [32, 30], [44, 30],
  [0, 33], [0, 37], [49, 33], [49, 37],
];

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
    const floorTextures = [
      Texture.from('./images/floor0.png'),
      Texture.from('./images/floor1.png'),
      Texture.from('./images/floor2.png'),
    ];
    const wallTex = Texture.from('./images/wall.png');
    const bossTex = Texture.from('./images/boss_floor.png');
    const torchTex = Texture.from('./images/torch.png');

    const container = new Container();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.data[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        let tex: Texture;
        if (tile === TILE.WALL) {
          tex = wallTex;
        } else if (tile === TILE.BOSS_FLOOR) {
          tex = bossTex;
        } else {
          // Deterministic floor variation based on position
          const v = (r * 7 + c * 13 + r * c) % 3;
          tex = floorTextures[v];
        }

        const s = new Sprite(tex);
        s.x = x;
        s.y = y;
        s.width = TILE_SIZE;
        s.height = TILE_SIZE;
        container.addChild(s);
      }
    }

    // Torch decorations on walls
    for (const [tc, tr] of TORCH_POSITIONS) {
      if (tr < MAP_ROWS && tc < MAP_COLS) {
        const ts = new Sprite(torchTex);
        ts.anchor.set(0.5);
        ts.x = tc * TILE_SIZE + TILE_SIZE / 2;
        ts.y = tr * TILE_SIZE + TILE_SIZE / 2;
        ts.width = TILE_SIZE * 0.7;
        ts.height = TILE_SIZE * 0.7;
        container.addChild(ts);
      }
    }

    // Door indicator (bright gap on dividing wall)
    const gfx = new Graphics();
    gfx.beginFill(0xaaff88, 0.5);
    gfx.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    gfx.endFill();

    // Arrow decoration on door
    gfx.beginFill(0xffcc00);
    const doorCx = 24.5 * TILE_SIZE;
    const doorCy = 28.5 * TILE_SIZE;
    gfx.drawPolygon([
      doorCx - 14, doorCy - 10,
      doorCx + 14, doorCy - 10,
      doorCx, doorCy + 10,
    ]);
    gfx.endFill();

    // Boss room border glow
    gfx.lineStyle(3, 0x660000, 0.6);
    gfx.drawRect(TILE_SIZE, 30 * TILE_SIZE, (MAP_COLS - 2) * TILE_SIZE, (MAP_ROWS - 31) * TILE_SIZE);

    container.addChild(gfx);

    const rt = RenderTexture.create({ width: this.pixelWidth, height: this.pixelHeight });
    renderer.render(container, { renderTexture: rt });

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

  /** Find the nearest non-wall tile to the desired position (BFS). */
  findSafeSpawn(col: number, row: number): { x: number; y: number } {
    if (this.data[row]?.[col] !== TILE.WALL) {
      return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
    }
    // BFS to find nearest non-wall tile
    const visited = new Set<string>();
    const queue: [number, number][] = [[col, row]];
    visited.add(`${col},${row}`);
    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nc = c + dc, nr = r + dr;
        const key = `${nc},${nr}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
        if (this.data[nr][nc] !== TILE.WALL) {
          return { x: nc * TILE_SIZE + TILE_SIZE / 2, y: nr * TILE_SIZE + TILE_SIZE / 2 };
        }
        queue.push([nc, nr]);
      }
    }
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }

  getTileAt(wx: number, wy: number): TileType {
    const tc = Math.floor(wx / TILE_SIZE);
    const tr = Math.floor(wy / TILE_SIZE);
    if (tc < 0 || tr < 0 || tc >= MAP_COLS || tr >= MAP_ROWS) return TILE.WALL;
    return this.data[tr][tc];
  }
}
