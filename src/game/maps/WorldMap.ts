import { Graphics, RenderTexture, Sprite, Container } from 'pixi.js';
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
    // Shadow
    g.beginFill(0x000000, 0.25);
    g.drawEllipse(0, 14, 12, 4);
    g.endFill();
    // Barrel body
    const bodyColor = damaged ? 0x7a4a20 : 0xa06028;
    g.beginFill(bodyColor);
    g.drawRoundedRect(-11, -14, 22, 28, 5);
    g.endFill();
    // Wood highlight (left side)
    g.beginFill(damaged ? 0x8a5525 : 0xc07838, 0.5);
    g.drawRoundedRect(-9, -12, 7, 22, 3);
    g.endFill();
    // Metal bands
    g.beginFill(damaged ? 0x2a2a2a : 0x3a3a3a);
    g.drawRoundedRect(-11, -5, 22, 4, 1);
    g.drawRoundedRect(-11, 5, 22, 4, 1);
    g.endFill();
    // Band highlight
    g.beginFill(0x666666, 0.4);
    g.drawRect(-11, -5, 22, 1);
    g.drawRect(-11, 5, 22, 1);
    g.endFill();
    if (damaged) {
      // Crack lines
      g.lineStyle(1.5, 0x3a2010, 0.8);
      g.moveTo(-4, -8); g.lineTo(2, 2);
      g.moveTo(3, -6); g.lineTo(1, 4);
    }
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
      const flicker = Math.sin(this.torchGlowTimer * 4 + i * 1.7) * 0.5 + 0.5;
      const flicker2 = Math.sin(this.torchGlowTimer * 6.3 + i * 0.9) * 0.3 + 0.7;
      const r = 44 + flicker * 22;
      g.clear();
      // Outer warm glow
      g.beginFill(0xff8800, 0.03 + flicker * 0.04);
      g.drawCircle(0, 0, r * 1.4);
      g.endFill();
      // Main glow
      g.beginFill(0xff9922, 0.07 + flicker * 0.05);
      g.drawCircle(0, 0, r);
      g.endFill();
      // Inner bright glow
      g.beginFill(0xffdd44, 0.10 + flicker2 * 0.06);
      g.drawCircle(0, 0, r * 0.45);
      g.endFill();
      // Core flame
      g.beginFill(0xffffff, 0.08 + flicker * 0.06);
      g.drawCircle(0, -2, r * 0.18);
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
    // Barrier fill
    g.beginFill(0x880000, 0.6);
    g.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    g.endFill();
    // Energy field lines
    g.lineStyle(3, 0xff2222, 0.85);
    for (let i = 0; i < 4; i++) {
      const x = (23 + i) * TILE_SIZE;
      g.moveTo(x, 29 * TILE_SIZE);
      g.lineTo(x + TILE_SIZE, 30 * TILE_SIZE);
      g.moveTo(x + TILE_SIZE, 29 * TILE_SIZE);
      g.lineTo(x, 30 * TILE_SIZE);
    }
    // Outer border glow
    g.lineStyle(2, 0xff6600, 0.9);
    g.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    // Top shimmer
    g.lineStyle(1, 0xffaa44, 0.5);
    g.moveTo(23 * TILE_SIZE, 29 * TILE_SIZE + 3);
    g.lineTo(26 * TILE_SIZE, 29 * TILE_SIZE + 3);
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

  // ── Procedural tile drawing helpers ────────────────────────────────────────

  private drawGrassTile(g: Graphics, x: number, y: number, row: number, col: number) {
    const v = (row * 7 + col * 13 + row * col) % 3;
    const bases = [0x2e6336, 0x2a5c30, 0x336b3a];
    g.beginFill(bases[v]);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
    // Darker grass patches
    if ((row * 3 + col * 7) % 5 === 0) {
      g.beginFill(0x1d4725, 0.35);
      const px = x + ((row * 13 + col * 7) % 28) + 4;
      const py = y + ((row * 7 + col * 11) % 26) + 4;
      g.drawRoundedRect(px, py, 7, 6, 2);
      g.endFill();
    }
    // Lighter highlight patches
    if ((row * 5 + col * 11) % 7 === 0) {
      g.beginFill(0x4e9458, 0.2);
      const px = x + ((row * 11 + col * 5) % 30) + 4;
      const py = y + ((row * 9 + col * 13) % 24) + 4;
      g.drawRoundedRect(px, py, 5, 9, 2);
      g.endFill();
    }
    // Subtle edge darken at bottom for faux-depth
    g.beginFill(0x000000, 0.06);
    g.drawRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
    g.endFill();
  }

  private drawWallTile(g: Graphics, x: number, y: number, row: number, col: number) {
    // Base stone fill
    g.beginFill(0x3e3e52);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();

    // Brick pattern – alternating rows
    const brickH = 16, brickW = 25;
    for (let by = 0; by * brickH < TILE_SIZE + brickH; by++) {
      const offset = (by % 2 === 0) ? 0 : Math.floor(brickW / 2);
      for (let bx = -brickW; bx < TILE_SIZE + brickW; bx += brickW) {
        const bxAbs = x + bx + ((row % 2) * 12) - (offset % brickW);
        const byAbs = y + by * brickH;
        const clippedX = Math.max(bxAbs + 1, x);
        const clippedY = Math.max(byAbs + 1, y);
        const clippedW = Math.min(bxAbs + brickW - 2, x + TILE_SIZE) - clippedX;
        const clippedH = Math.min(byAbs + brickH - 2, y + TILE_SIZE) - clippedY;
        if (clippedW > 1 && clippedH > 1) {
          // Brick face
          g.beginFill(0x4c4c62);
          g.drawRect(clippedX, clippedY, clippedW, clippedH);
          g.endFill();
          // Top-left highlight
          g.beginFill(0x626278, 0.55);
          g.drawRect(clippedX, clippedY, clippedW, 2);
          g.drawRect(clippedX, clippedY, 2, clippedH);
          g.endFill();
          // Bottom-right shadow
          g.beginFill(0x28283a, 0.4);
          g.drawRect(clippedX, clippedY + clippedH - 1, clippedW, 1);
          g.drawRect(clippedX + clippedW - 1, clippedY, 1, clippedH);
          g.endFill();
        }
      }
    }
    // Top cap sheen
    g.beginFill(0x6a6a84, 0.25);
    g.drawRect(x, y, TILE_SIZE, 2);
    g.endFill();
  }

  private drawBossFloorTile(g: Graphics, x: number, y: number, row: number, col: number) {
    // Deep void base
    g.beginFill(0x110820);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
    // Stone slab variation
    const v = (row * 11 + col * 7) % 4;
    if (v < 2) {
      g.beginFill(0x1c0e30, 0.7);
      g.drawRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      g.endFill();
    }
    // Arcane rune border
    g.lineStyle(1, 0x5500bb, 0.25);
    g.drawRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.lineStyle(0);
    // Corner sigil dots
    if ((row + col) % 4 === 0) {
      g.beginFill(0x7700dd, 0.18);
      g.drawCircle(x + 6, y + 6, 2);
      g.drawCircle(x + TILE_SIZE - 6, y + 6, 2);
      g.drawCircle(x + 6, y + TILE_SIZE - 6, 2);
      g.drawCircle(x + TILE_SIZE - 6, y + TILE_SIZE - 6, 2);
      g.endFill();
    }
    // Center glow hint on certain tiles
    if ((row * 3 + col * 5) % 8 === 0) {
      g.beginFill(0x4400aa, 0.12);
      g.drawCircle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 14);
      g.endFill();
    }
  }

  private drawTrapIndicator(g: Graphics, x: number, y: number) {
    // Warning hazard overlay
    g.beginFill(0xcc3300, 0.22);
    g.drawRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    g.endFill();
    // Diagonal warning stripes
    g.lineStyle(2, 0xff5500, 0.45);
    const cx = x + TILE_SIZE / 2, cy = y + TILE_SIZE / 2;
    const r = 14;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineTo(cx + Math.cos(a + Math.PI / 4) * r * 0.5, cy + Math.sin(a + Math.PI / 4) * r * 0.5);
    }
    g.lineStyle(0);
    // Central spike diamond
    g.beginFill(0xff6600, 0.5);
    g.drawPolygon([cx, cy - 9, cx + 7, cy, cx, cy + 9, cx - 7, cy]);
    g.endFill();
    g.beginFill(0xffaa44, 0.6);
    g.drawPolygon([cx, cy - 4, cx + 3, cy, cx, cy + 4, cx - 3, cy]);
    g.endFill();
  }

  private drawTorchStatic(g: Graphics, x: number, y: number) {
    // Wall bracket
    g.beginFill(0x555566);
    g.drawRoundedRect(x - 4, y - 4, 8, 6, 2);
    g.endFill();
    // Torch pole
    g.beginFill(0x8b6914);
    g.drawRoundedRect(x - 3, y - 18, 6, 18, 2);
    g.endFill();
    // Torch head (cup)
    g.beginFill(0x4a3008);
    g.drawRoundedRect(x - 6, y - 26, 12, 10, 3);
    g.endFill();
    g.beginFill(0x6a4810, 0.8);
    g.drawRoundedRect(x - 5, y - 25, 10, 5, 2);
    g.endFill();
    // Base flame (static - animated glow done separately)
    g.beginFill(0xdd3300, 0.7);
    g.drawEllipse(x, y - 28, 5, 7);
    g.endFill();
    g.beginFill(0xff8800, 0.85);
    g.drawEllipse(x, y - 29, 3, 5);
    g.endFill();
    g.beginFill(0xffee66, 0.9);
    g.drawEllipse(x, y - 31, 2, 3);
    g.endFill();
  }

  private renderToTexture(renderer: Renderer) {
    const c = new Container();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = this.data[r][col];
        const x = col * TILE_SIZE, y = r * TILE_SIZE;
        const g = new Graphics();

        if (tile === TILE.WALL) {
          this.drawWallTile(g, x, y, r, col);
        } else if (tile === TILE.BOSS_FLOOR) {
          this.drawBossFloorTile(g, x, y, r, col);
        } else if (tile === TILE.TRAP) {
          this.drawGrassTile(g, x, y, r, col);
          this.drawTrapIndicator(g, x, y);
        } else {
          this.drawGrassTile(g, x, y, r, col);
        }
        c.addChild(g);
      }
    }

    // Torches (static sprites baked into texture)
    for (const [tc, tr] of TORCH_POSITIONS) {
      if (tr < MAP_ROWS && tc < MAP_COLS) {
        const g = new Graphics();
        this.drawTorchStatic(
          g,
          tc * TILE_SIZE + TILE_SIZE / 2,
          tr * TILE_SIZE + TILE_SIZE / 2,
        );
        c.addChild(g);
      }
    }

    // Door / boss transition indicator
    const doorGfx = new Graphics();
    // Green passage glow
    doorGfx.beginFill(0x55ee77, 0.3);
    doorGfx.drawRect(23 * TILE_SIZE, 29 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    doorGfx.endFill();
    // Downward chevron arrow
    const acx = 24.5 * TILE_SIZE, acy = 28.6 * TILE_SIZE;
    doorGfx.beginFill(0xffee00);
    doorGfx.drawPolygon([acx - 13, acy - 7, acx + 13, acy - 7, acx, acy + 10]);
    doorGfx.endFill();
    doorGfx.beginFill(0xffffff, 0.5);
    doorGfx.drawPolygon([acx - 7, acy - 5, acx + 7, acy - 5, acx, acy + 4]);
    doorGfx.endFill();
    // Boss room border
    doorGfx.lineStyle(2, 0x6600aa, 0.45);
    doorGfx.drawRect(TILE_SIZE, 30 * TILE_SIZE, (MAP_COLS - 2) * TILE_SIZE, (MAP_ROWS - 31) * TILE_SIZE);
    c.addChild(doorGfx);

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
