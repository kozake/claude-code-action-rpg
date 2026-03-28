import { Graphics, RenderTexture, Sprite, Container, Texture } from 'pixi.js';
import type { Renderer } from 'pixi.js';

export const TILE_SIZE = 48;
export const MAP_COLS = 50;
export const MAP_ROWS = 40;

export const TILE = {
  GRASS: 0,
  WALL: 1,
  BOSS_FLOOR: 2,
  TRAP: 3,
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

// Destructible object
export interface Destructible {
  col: number; row: number;
  hp: number; maxHp: number;
  gfx: Graphics;
  broken: boolean;
}

const TORCH_POSITIONS: [number, number][] = [
  [8, 0], [20, 0], [32, 0], [44, 0],
  [0, 6], [0, 14], [0, 22],
  [49, 8], [49, 16], [49, 24],
  [8, 28], [20, 28], [32, 28], [44, 28],
  [8, 30], [20, 30], [32, 30], [44, 30],
  [0, 33], [0, 37], [49, 33], [49, 37],
];

// Trap positions in field area
const TRAP_POSITIONS: [number, number][] = [
  [12, 10], [13, 10], [25, 15], [26, 15],
  [35, 8], [36, 8], [15, 20], [40, 20],
  [10, 25], [30, 5], [44, 12], [20, 18],
];

// Destructible barrel/pot positions
const DESTRUCTIBLE_POSITIONS: [number, number][] = [
  [6, 3], [16, 7], [28, 4], [40, 5],
  [11, 16], [33, 12], [45, 16], [22, 22],
  [8, 24], [38, 22], [17, 12], [42, 25],
];

export class WorldMap {
  readonly data: TileType[][];
  readonly container: Container;
  readonly pixelWidth = MAP_COLS * TILE_SIZE;
  readonly pixelHeight = MAP_ROWS * TILE_SIZE;
  readonly bossRowStart = 30;
  bossRoomLocked = false;
  private doorBarrier: Graphics;

  // Torch glow layer (animated)
  private torchGlowContainer: Container;
  private torchGlowTimer = 0;
  private torchGlows: Graphics[] = [];

  // Destructibles
  destructibles: Destructible[] = [];

  // Trap state
  private trapTimers = new Map<string, number>();

  constructor(renderer: Renderer) {
    this.data = this.buildMap();
    this.container = new Container();
    this.renderToTexture(renderer);

    this.doorBarrier = new Graphics();
    this.container.addChild(this.doorBarrier);

    // Torch glow
    this.torchGlowContainer = new Container();
    this.container.addChild(this.torchGlowContainer);
    this.createTorchGlows();

    // Destructibles
    this.createDestructibles();
  }

  private createTorchGlows() {
    for (const [tc, tr] of TORCH_POSITIONS) {
      if (tr >= MAP_ROWS || tc >= MAP_COLS) continue;
      const g = new Graphics();
      g.x = tc * TILE_SIZE + TILE_SIZE / 2;
      g.y = tr * TILE_SIZE + TILE_SIZE / 2;
      this.torchGlowContainer.addChild(g);
      this.torchGlows.push(g);
    }
  }

  private createDestructibles() {
    for (const [col, row] of DESTRUCTIBLE_POSITIONS) {
      if (this.data[row]?.[col] !== TILE.GRASS) continue;
      const g = new Graphics();
      this.drawBarrel(g);
      g.x = col * TILE_SIZE + TILE_SIZE / 2;
      g.y = row * TILE_SIZE + TILE_SIZE / 2;
      this.container.addChild(g);
      this.destructibles.push({ col, row, hp: 2, maxHp: 2, gfx: g, broken: false });
    }
  }

  private drawBarrel(g: Graphics, damaged = false) {
    g.clear();
    const c = damaged ? 0x664422 : 0x885533;
    g.beginFill(c);
    g.drawRoundedRect(-12, -14, 24, 28, 4);
    g.endFill();
    // Bands
    g.lineStyle(2, 0x444444);
    g.moveTo(-12, -6); g.lineTo(12, -6);
    g.moveTo(-12, 6); g.lineTo(12, 6);
    // Highlight
    g.beginFill(0xaa7744, 0.4);
    g.drawRect(-8, -12, 6, 22);
    g.endFill();
  }

  /** Damage a destructible at world position. Returns broken destructible or null. */
  hitDestructible(wx: number, wy: number, radius: number): Destructible | null {
    for (const d of this.destructibles) {
      if (d.broken) continue;
      const dx = wx - (d.col * TILE_SIZE + TILE_SIZE / 2);
      const dy = wy - (d.row * TILE_SIZE + TILE_SIZE / 2);
      if (dx * dx + dy * dy < (radius + 16) * (radius + 16)) {
        d.hp--;
        if (d.hp <= 0) {
          d.broken = true;
          d.gfx.visible = false;
          return d;
        } else {
          this.drawBarrel(d.gfx, true);
        }
      }
    }
    return null;
  }

  /** Check if player is on a trap tile. Returns damage or 0. */
  checkTrap(cx: number, cy: number, dt: number): number {
    const col = Math.floor(cx / TILE_SIZE);
    const row = Math.floor(cy / TILE_SIZE);
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return 0;
    if (this.data[row][col] !== TILE.TRAP) return 0;
    const key = `${col},${row}`;
    const timer = this.trapTimers.get(key) || 0;
    if (timer > 0) {
      this.trapTimers.set(key, timer - dt);
      return 0;
    }
    this.trapTimers.set(key, 1.0); // cooldown
    return 10; // trap damage
  }

  /** Update animated elements */
  updateAnimations(dt: number) {
    this.torchGlowTimer += dt;
    for (let i = 0; i < this.torchGlows.length; i++) {
      const g = this.torchGlows[i];
      const flicker = Math.sin(this.torchGlowTimer * 3 + i * 1.7) * 0.5 + 0.5;
      const r = 40 + flicker * 20;
      g.clear();
      g.beginFill(0xffaa33, 0.06 + flicker * 0.04);
      g.drawCircle(0, 0, r);
      g.endFill();
      g.beginFill(0xffdd66, 0.08 + flicker * 0.05);
      g.drawCircle(0, 0, r * 0.5);
      g.endFill();
    }
    // Update trap timers
    for (const [key, val] of this.trapTimers) {
      if (val > 0) this.trapTimers.set(key, val - dt);
    }
  }

  lockBossRoom() {
    this.bossRoomLocked = true;
    const g = this.doorBarrier;
    g.clear();
    g.beginFill(0xcc0000, 0.75);
    g.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    g.endFill();
    g.lineStyle(3, 0xff4444, 0.9);
    for (let i = 0; i <= 3; i++) {
      const x = (23 + i) * TILE_SIZE;
      g.moveTo(x, 29 * TILE_SIZE);
      g.lineTo(x + TILE_SIZE, 30 * TILE_SIZE);
      g.moveTo(x + TILE_SIZE, 29 * TILE_SIZE);
      g.lineTo(x, 30 * TILE_SIZE);
    }
    g.lineStyle(2, 0xff8800, 1);
    g.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
  }

  unlockBossRoom() {
    this.bossRoomLocked = false;
    this.doorBarrier.clear();
  }

  private buildMap(): TileType[][] {
    const m: TileType[][] = Array.from({ length: MAP_ROWS }, () =>
      new Array<TileType>(MAP_COLS).fill(TILE.GRASS),
    );

    // Perimeter
    for (let c = 0; c < MAP_COLS; c++) { m[0][c] = TILE.WALL; m[MAP_ROWS - 1][c] = TILE.WALL; }
    for (let r = 0; r < MAP_ROWS; r++) { m[r][0] = TILE.WALL; m[r][MAP_COLS - 1] = TILE.WALL; }

    // Obstacles
    const obs: [number, number, number, number][] = [
      [3,4,2,4],[6,15,3,3],[8,7,4,2],[12,26,2,4],[5,36,4,2],
      [10,41,3,2],[7,45,3,2],[15,12,2,5],[18,30,4,2],[2,22,3,3],
      [20,8,3,3],[22,40,2,4],[14,5,3,2],[16,20,2,6],[4,28,3,2],[19,15,2,3],
    ];
    for (const [r, c, dr, dc] of obs) {
      for (let dy = 0; dy < dr; dy++) for (let dx = 0; dx < dc; dx++) {
        const row = r + dy, col = c + dx;
        if (row >= 1 && row < 29 && col >= 1 && col < MAP_COLS - 1) m[row][col] = TILE.WALL;
      }
    }

    // Traps
    for (const [tc, tr] of TRAP_POSITIONS) {
      if (tr >= 1 && tr < 29 && tc >= 1 && tc < MAP_COLS - 1 && m[tr][tc] === TILE.GRASS) {
        m[tr][tc] = TILE.TRAP;
      }
    }

    // Dividing wall
    for (let c = 0; c < MAP_COLS; c++) m[29][c] = TILE.WALL;
    m[29][23] = TILE.GRASS; m[29][24] = TILE.GRASS; m[29][25] = TILE.GRASS;

    // Boss room
    for (let r = 30; r < MAP_ROWS - 1; r++)
      for (let c = 1; c < MAP_COLS - 1; c++) m[r][c] = TILE.BOSS_FLOOR;

    // Pillars
    for (const [r, c] of [[32,10],[32,39],[36,10],[36,39],[32,24],[36,24]] as [number,number][]) {
      m[r][c] = TILE.WALL; m[r][c+1] = TILE.WALL;
      m[r+1][c] = TILE.WALL; m[r+1][c+1] = TILE.WALL;
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

    const c = new Container();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = this.data[r][col];
        const x = col * TILE_SIZE, y = r * TILE_SIZE;
        let tex: Texture;
        if (tile === TILE.WALL) { tex = wallTex; }
        else if (tile === TILE.BOSS_FLOOR) { tex = bossTex; }
        else { tex = floorTextures[(r * 7 + col * 13 + r * col) % 3]; }

        const s = new Sprite(tex);
        s.x = x; s.y = y; s.width = TILE_SIZE; s.height = TILE_SIZE;
        c.addChild(s);

        // Draw trap indicator
        if (tile === TILE.TRAP) {
          const tg = new Graphics();
          tg.beginFill(0x884422, 0.4);
          tg.drawRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16);
          tg.endFill();
          // Spikes
          tg.beginFill(0xaaaaaa, 0.6);
          for (let i = 0; i < 4; i++) {
            const sx = x + 12 + (i % 2) * 20;
            const sy = y + 12 + Math.floor(i / 2) * 20;
            tg.drawPolygon([sx, sy - 5, sx + 4, sy + 3, sx - 4, sy + 3]);
          }
          tg.endFill();
          c.addChild(tg);
        }
      }
    }

    // Torches
    for (const [tc, tr] of TORCH_POSITIONS) {
      if (tr < MAP_ROWS && tc < MAP_COLS) {
        const ts = new Sprite(torchTex);
        ts.anchor.set(0.5);
        ts.x = tc * TILE_SIZE + TILE_SIZE / 2;
        ts.y = tr * TILE_SIZE + TILE_SIZE / 2;
        ts.width = TILE_SIZE * 0.7; ts.height = TILE_SIZE * 0.7;
        c.addChild(ts);
      }
    }

    // Door indicator
    const gfx = new Graphics();
    gfx.beginFill(0xaaff88, 0.5);
    gfx.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    gfx.endFill();
    gfx.beginFill(0xffcc00);
    const doorCx = 24.5 * TILE_SIZE, doorCy = 28.5 * TILE_SIZE;
    gfx.drawPolygon([doorCx - 14, doorCy - 10, doorCx + 14, doorCy - 10, doorCx, doorCy + 10]);
    gfx.endFill();
    gfx.lineStyle(3, 0x660000, 0.6);
    gfx.drawRect(TILE_SIZE, 30 * TILE_SIZE, (MAP_COLS - 2) * TILE_SIZE, (MAP_ROWS - 31) * TILE_SIZE);
    c.addChild(gfx);

    const rt = RenderTexture.create({ width: this.pixelWidth, height: this.pixelHeight });
    renderer.render(c, { renderTexture: rt });
    const sprite = new Sprite(rt);
    this.container.addChild(sprite);
  }

  isColliding(cx: number, cy: number, w: number, h: number): boolean {
    const half = 2;
    const corners: [number, number][] = [
      [cx - w/2 + half, cy - h/2 + half], [cx + w/2 - half, cy - h/2 + half],
      [cx - w/2 + half, cy + h/2 - half], [cx + w/2 - half, cy + h/2 - half],
    ];
    for (const [px, py] of corners) {
      const tc = Math.floor(px / TILE_SIZE), tr = Math.floor(py / TILE_SIZE);
      if (tc < 0 || tr < 0 || tc >= MAP_COLS || tr >= MAP_ROWS) return true;
      if (this.data[tr][tc] === TILE.WALL) return true;
      if (this.bossRoomLocked && tr === 29 && tc >= 23 && tc <= 25) return true;
    }
    return false;
  }

  findSafeSpawn(col: number, row: number): { x: number; y: number } {
    if (this.data[row]?.[col] !== TILE.WALL) {
      return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
    }
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
    const tc = Math.floor(wx / TILE_SIZE), tr = Math.floor(wy / TILE_SIZE);
    if (tc < 0 || tr < 0 || tc >= MAP_COLS || tr >= MAP_ROWS) return TILE.WALL;
    return this.data[tr][tc];
  }
}
