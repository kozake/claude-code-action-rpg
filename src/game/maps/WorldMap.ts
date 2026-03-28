import { Graphics, RenderTexture, Sprite, Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import type { FloorConfig, TilePalette } from '../DungeonConfig';

export const TILE_SIZE = 48;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  BOSS_FLOOR: 2,
  TRAP: 3,
  STAIRS: 4,
  GRASS: 0, // alias for backward compat
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

export interface Destructible {
  col: number; row: number;
  hp: number; maxHp: number;
  gfx: Graphics;
  broken: boolean;
}

export interface Room {
  x: number; y: number; w: number; h: number;
}

export class WorldMap {
  data: TileType[][];
  readonly container: Container;
  cols: number;
  rows: number;
  pixelWidth: number;
  pixelHeight: number;
  bossRoomLocked = false;
  rooms: Room[] = [];
  stairsCol = -1;
  stairsRow = -1;
  spawnCol = 0;
  spawnRow = 0;

  private palette: TilePalette;
  private doorBarrier: Graphics;
  private torchGlowContainer: Container;
  private torchGlowTimer = 0;
  private torchGlows: Graphics[] = [];
  private torchPositions: [number, number][] = [];
  destructibles: Destructible[] = [];
  private trapTimers = new Map<string, number>();
  private renderer: Renderer;

  constructor(renderer: Renderer, config: FloorConfig) {
    this.renderer = renderer;
    this.cols = config.cols;
    this.rows = config.rows;
    this.pixelWidth = config.cols * TILE_SIZE;
    this.pixelHeight = config.rows * TILE_SIZE;
    this.palette = config.theme.palette;

    if (config.hasBoss) {
      this.data = this.buildBossMap();
    } else {
      this.data = this.generateFloor(config);
    }

    this.container = new Container();
    this.renderToTexture(renderer);

    this.doorBarrier = new Graphics();
    this.container.addChild(this.doorBarrier);

    this.torchGlowContainer = new Container();
    this.container.addChild(this.torchGlowContainer);
    this.createTorchGlows();
    this.createDestructibles();
  }

  showStairs() {
    if (this.stairsCol < 0) return;
    this.data[this.stairsRow][this.stairsCol] = TILE.STAIRS;
    // Re-render the stairs tile visually
    const g = new Graphics();
    const x = this.stairsCol * TILE_SIZE;
    const y = this.stairsRow * TILE_SIZE;
    this.drawStairsTile(g, x, y);
    this.container.addChild(g);
  }

  isOnStairs(wx: number, wy: number): boolean {
    const tc = Math.floor(wx / TILE_SIZE);
    const tr = Math.floor(wy / TILE_SIZE);
    return this.data[tr]?.[tc] === TILE.STAIRS;
  }

  // ── Procedural floor generation ──────────────────────────────

  private generateFloor(config: FloorConfig): TileType[][] {
    const { cols, rows } = config;
    const m: TileType[][] = Array.from({ length: rows }, () =>
      new Array<TileType>(cols).fill(TILE.WALL),
    );

    // Generate rooms
    this.rooms = this.placeRooms(cols, rows, config.roomCount);

    // Carve rooms
    for (const room of this.rooms) {
      for (let r = room.y; r < room.y + room.h; r++) {
        for (let c = room.x; c < room.x + room.w; c++) {
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
            m[r][c] = TILE.FLOOR;
          }
        }
      }
    }

    // Connect rooms with corridors
    for (let i = 1; i < this.rooms.length; i++) {
      this.carveCorridor(m, this.rooms[i - 1], this.rooms[i], cols, rows);
    }

    // Spawn room = first room
    const spawn = this.rooms[0];
    this.spawnCol = spawn.x + Math.floor(spawn.w / 2);
    this.spawnRow = spawn.y + Math.floor(spawn.h / 2);

    // Stairs in last room
    const exit = this.rooms[this.rooms.length - 1];
    this.stairsCol = exit.x + Math.floor(exit.w / 2);
    this.stairsRow = exit.y + Math.floor(exit.h / 2);
    // Don't place stairs tile yet - shown after waves cleared

    // Scatter traps in corridors
    this.placeTrapTiles(m, cols, rows);

    // Place torch positions near walls
    this.torchPositions = this.findTorchPositions(m, cols, rows);

    return m;
  }

  private placeRooms(cols: number, rows: number, count: number): Room[] {
    const rooms: Room[] = [];
    let attempts = 0;
    while (rooms.length < count && attempts < 200) {
      attempts++;
      const w = 5 + Math.floor(Math.random() * 8);  // 5-12
      const h = 5 + Math.floor(Math.random() * 6);  // 5-10
      const x = 1 + Math.floor(Math.random() * (cols - w - 2));
      const y = 1 + Math.floor(Math.random() * (rows - h - 2));
      const room: Room = { x, y, w, h };

      // Check overlap (with 1-tile padding)
      let overlaps = false;
      for (const r of rooms) {
        if (room.x - 1 < r.x + r.w && room.x + room.w + 1 > r.x &&
            room.y - 1 < r.y + r.h && room.y + room.h + 1 > r.y) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) rooms.push(room);
    }

    // Sort by position for corridor connectivity
    rooms.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    return rooms;
  }

  private carveCorridor(m: TileType[][], a: Room, b: Room, cols: number, rows: number) {
    let cx = a.x + Math.floor(a.w / 2);
    let cy = a.y + Math.floor(a.h / 2);
    const tx = b.x + Math.floor(b.w / 2);
    const ty = b.y + Math.floor(b.h / 2);

    // L-shaped corridor: horizontal then vertical
    while (cx !== tx) {
      if (cy > 0 && cy < rows - 1 && cx > 0 && cx < cols - 1) {
        m[cy][cx] = TILE.FLOOR;
        // Make corridor 2 tiles wide
        if (cy + 1 < rows - 1) m[cy + 1][cx] = TILE.FLOOR;
      }
      cx += cx < tx ? 1 : -1;
    }
    while (cy !== ty) {
      if (cy > 0 && cy < rows - 1 && cx > 0 && cx < cols - 1) {
        m[cy][cx] = TILE.FLOOR;
        if (cx + 1 < cols - 1) m[cy][cx + 1] = TILE.FLOOR;
      }
      cy += cy < ty ? 1 : -1;
    }
  }

  private placeTrapTiles(m: TileType[][], cols: number, rows: number) {
    let placed = 0;
    const maxTraps = Math.floor((cols * rows) * 0.008);
    for (let i = 0; i < 500 && placed < maxTraps; i++) {
      const c = 2 + Math.floor(Math.random() * (cols - 4));
      const r = 2 + Math.floor(Math.random() * (rows - 4));
      if (m[r][c] === TILE.FLOOR) {
        // Don't place near spawn
        const ds = Math.abs(c - this.spawnCol) + Math.abs(r - this.spawnRow);
        if (ds > 6) {
          m[r][c] = TILE.TRAP;
          placed++;
        }
      }
    }
  }

  private findTorchPositions(m: TileType[][], cols: number, rows: number): [number, number][] {
    const torches: [number, number][] = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (m[r][c] !== TILE.WALL) continue;
        // Place torch on walls adjacent to floor
        const hasFloor = (
          (m[r - 1]?.[c] === TILE.FLOOR || m[r - 1]?.[c] === TILE.TRAP) ||
          (m[r + 1]?.[c] === TILE.FLOOR || m[r + 1]?.[c] === TILE.TRAP)
        );
        if (hasFloor && (r * 7 + c * 13) % 11 < 2) {
          torches.push([c, r]);
        }
      }
    }
    return torches;
  }

  // ── Boss floor map ───────────────────────────────────────────

  private buildBossMap(): TileType[][] {
    const { cols, rows } = this;
    const m: TileType[][] = Array.from({ length: rows }, () =>
      new Array<TileType>(cols).fill(TILE.WALL),
    );

    // Antechamber (top)
    const anteY = 1, anteH = 5;
    const anteX = Math.floor(cols / 2) - 3, anteW = 7;
    for (let r = anteY; r < anteY + anteH; r++) {
      for (let c = anteX; c < anteX + anteW; c++) {
        m[r][c] = TILE.FLOOR;
      }
    }
    this.rooms = [{ x: anteX, y: anteY, w: anteW, h: anteH }];
    this.spawnCol = anteX + 3;
    this.spawnRow = anteY + 2;

    // Main arena
    const arenaY = anteY + anteH;
    const arenaH = rows - arenaY - 1;
    const arenaX = 2;
    const arenaW = cols - 4;
    for (let r = arenaY; r < arenaY + arenaH; r++) {
      for (let c = arenaX; c < arenaX + arenaW; c++) {
        m[r][c] = TILE.BOSS_FLOOR;
      }
    }
    this.rooms.push({ x: arenaX, y: arenaY, w: arenaW, h: arenaH });

    // Corridor connecting antechamber to arena
    const connX = Math.floor(cols / 2);
    for (let c = connX - 1; c <= connX + 1; c++) {
      m[anteY + anteH][c] = TILE.FLOOR;
    }

    // Decorative pillars in arena
    const pillarPositions = [
      [arenaY + 3, arenaX + 3],
      [arenaY + 3, arenaX + arenaW - 5],
      [arenaY + arenaH - 4, arenaX + 3],
      [arenaY + arenaH - 4, arenaX + arenaW - 5],
    ];
    for (const [pr, pc] of pillarPositions) {
      if (pr >= 0 && pr + 1 < rows && pc >= 0 && pc + 1 < cols) {
        m[pr][pc] = TILE.WALL;
        m[pr][pc + 1] = TILE.WALL;
        m[pr + 1][pc] = TILE.WALL;
        m[pr + 1][pc + 1] = TILE.WALL;
      }
    }

    // Torch positions for boss room
    this.torchPositions = [
      [arenaX, arenaY], [arenaX + arenaW - 1, arenaY],
      [arenaX, arenaY + arenaH - 1], [arenaX + arenaW - 1, arenaY + arenaH - 1],
      [Math.floor(cols / 2), arenaY],
    ];

    this.stairsCol = -1;
    this.stairsRow = -1;

    return m;
  }

  // ── Room centers (for enemy spawning) ────────────────────────

  getRoomCenters(): { x: number; y: number }[] {
    return this.rooms.map(r => ({
      x: (r.x + Math.floor(r.w / 2)) * TILE_SIZE + TILE_SIZE / 2,
      y: (r.y + Math.floor(r.h / 2)) * TILE_SIZE + TILE_SIZE / 2,
    }));
  }

  getSpawnPosition(): { x: number; y: number } {
    return {
      x: this.spawnCol * TILE_SIZE + TILE_SIZE / 2,
      y: this.spawnRow * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  // ── Torch glow ───────────────────────────────────────────────

  private createTorchGlows() {
    for (const [tc, tr] of this.torchPositions) {
      if (tr >= this.rows || tc >= this.cols) continue;
      const g = new Graphics();
      g.x = tc * TILE_SIZE + TILE_SIZE / 2;
      g.y = tr * TILE_SIZE + TILE_SIZE / 2;
      this.torchGlowContainer.addChild(g);
      this.torchGlows.push(g);
    }
  }

  // ── Destructibles ────────────────────────────────────────────

  private createDestructibles() {
    let placed = 0;
    const maxBarrels = Math.max(4, Math.floor(this.rooms.length * 2));
    for (const room of this.rooms) {
      if (placed >= maxBarrels) break;
      for (let i = 0; i < 3 && placed < maxBarrels; i++) {
        const c = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const r = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols &&
            this.data[r][c] === TILE.FLOOR &&
            !(c === this.spawnCol && r === this.spawnRow)) {
          const g = new Graphics();
          this.drawBarrel(g);
          g.x = c * TILE_SIZE + TILE_SIZE / 2;
          g.y = r * TILE_SIZE + TILE_SIZE / 2;
          this.container.addChild(g);
          this.destructibles.push({ col: c, row: r, hp: 2, maxHp: 2, gfx: g, broken: false });
          placed++;
        }
      }
    }
  }

  private drawBarrel(g: Graphics, damaged = false) {
    g.clear();
    g.beginFill(0x000000, 0.25);
    g.drawEllipse(0, 14, 12, 4);
    g.endFill();
    const bodyColor = damaged ? 0x7a4a20 : 0xa06028;
    g.beginFill(bodyColor);
    g.drawRoundedRect(-11, -14, 22, 28, 5);
    g.endFill();
    g.beginFill(damaged ? 0x8a5525 : 0xc07838, 0.5);
    g.drawRoundedRect(-9, -12, 7, 22, 3);
    g.endFill();
    g.beginFill(damaged ? 0x2a2a2a : 0x3a3a3a);
    g.drawRoundedRect(-11, -5, 22, 4, 1);
    g.drawRoundedRect(-11, 5, 22, 4, 1);
    g.endFill();
    g.beginFill(0x666666, 0.4);
    g.drawRect(-11, -5, 22, 1);
    g.drawRect(-11, 5, 22, 1);
    g.endFill();
    if (damaged) {
      g.lineStyle(1.5, 0x3a2010, 0.8);
      g.moveTo(-4, -8); g.lineTo(2, 2);
      g.moveTo(3, -6); g.lineTo(1, 4);
    }
  }

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

  checkTrap(cx: number, cy: number, dt: number): number {
    const col = Math.floor(cx / TILE_SIZE);
    const row = Math.floor(cy / TILE_SIZE);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 0;
    if (this.data[row][col] !== TILE.TRAP) return 0;
    const key = `${col},${row}`;
    const timer = this.trapTimers.get(key) || 0;
    if (timer > 0) {
      this.trapTimers.set(key, timer - dt);
      return 0;
    }
    this.trapTimers.set(key, 1.0);
    return 10;
  }

  updateAnimations(dt: number) {
    this.torchGlowTimer += dt;
    const flames = this.palette.torchFlame;
    for (let i = 0; i < this.torchGlows.length; i++) {
      const g = this.torchGlows[i];
      const flicker = Math.sin(this.torchGlowTimer * 4 + i * 1.7) * 0.5 + 0.5;
      const flicker2 = Math.sin(this.torchGlowTimer * 6.3 + i * 0.9) * 0.3 + 0.7;
      const r = 44 + flicker * 22;
      g.clear();
      g.beginFill(flames[0], 0.03 + flicker * 0.04);
      g.drawCircle(0, 0, r * 1.4);
      g.endFill();
      g.beginFill(flames[1], 0.07 + flicker * 0.05);
      g.drawCircle(0, 0, r);
      g.endFill();
      g.beginFill(flames[2], 0.10 + flicker2 * 0.06);
      g.drawCircle(0, 0, r * 0.45);
      g.endFill();
      g.beginFill(flames[3], 0.08 + flicker * 0.06);
      g.drawCircle(0, -2, r * 0.18);
      g.endFill();
    }
    for (const [key, val] of this.trapTimers) {
      if (val > 0) this.trapTimers.set(key, val - dt);
    }
  }

  lockBossRoom() {
    this.bossRoomLocked = true;
    const g = this.doorBarrier;
    g.clear();
    const mid = Math.floor(this.cols / 2);
    const doorRow = this.rooms.length >= 2 ? this.rooms[0].y + this.rooms[0].h : 6;
    g.beginFill(0x880000, 0.6);
    g.drawRect((mid - 1) * TILE_SIZE, doorRow * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
    g.endFill();
    g.lineStyle(3, 0xff2222, 0.85);
    for (let i = 0; i < 3; i++) {
      const x = (mid - 1 + i) * TILE_SIZE;
      g.moveTo(x, doorRow * TILE_SIZE);
      g.lineTo(x + TILE_SIZE, (doorRow + 1) * TILE_SIZE);
    }
    g.lineStyle(2, 0xff6600, 0.9);
    g.drawRect((mid - 1) * TILE_SIZE, doorRow * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);
  }

  unlockBossRoom() {
    this.bossRoomLocked = false;
    this.doorBarrier.clear();
  }

  isColliding(cx: number, cy: number, w: number, h: number): boolean {
    const half = 2;
    const corners: [number, number][] = [
      [cx - w / 2 + half, cy - h / 2 + half],
      [cx + w / 2 - half, cy - h / 2 + half],
      [cx - w / 2 + half, cy + h / 2 - half],
      [cx + w / 2 - half, cy + h / 2 - half],
    ];
    for (const [px, py] of corners) {
      const tc = Math.floor(px / TILE_SIZE), tr = Math.floor(py / TILE_SIZE);
      if (tc < 0 || tr < 0 || tc >= this.cols || tr >= this.rows) return true;
      if (this.data[tr][tc] === TILE.WALL) return true;
    }
    return false;
  }

  findSafeSpawn(col: number, row: number): { x: number; y: number } {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols &&
        this.data[row]?.[col] !== TILE.WALL) {
      return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
    }
    const visited = new Set<string>();
    const queue: [number, number][] = [[col, row]];
    visited.add(`${col},${row}`);
    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        const key = `${nc},${nr}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
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
    if (tc < 0 || tr < 0 || tc >= this.cols || tr >= this.rows) return TILE.WALL;
    return this.data[tr][tc];
  }

  /** Destroy GPU resources */
  destroy() {
    this.container.destroy({ children: true });
  }

  // ── Tile Drawing (palette-aware) ─────────────────────────────

  private drawFloorTile(g: Graphics, x: number, y: number, row: number, col: number) {
    const v = (row * 7 + col * 13 + row * col) % 3;
    const p = this.palette;
    g.beginFill(p.floorColors[v]);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
    if ((row * 3 + col * 7) % 5 === 0) {
      g.beginFill(p.floorAccent, 0.35);
      const px = x + ((row * 13 + col * 7) % 28) + 4;
      const py = y + ((row * 7 + col * 11) % 26) + 4;
      g.drawRoundedRect(px, py, 7, 6, 2);
      g.endFill();
    }
    if ((row * 5 + col * 11) % 7 === 0) {
      g.beginFill(p.floorColors[2], 0.25);
      const px = x + ((row * 11 + col * 5) % 30) + 4;
      const py = y + ((row * 9 + col * 13) % 24) + 4;
      g.drawRoundedRect(px, py, 5, 9, 2);
      g.endFill();
    }
    g.beginFill(0x000000, 0.06);
    g.drawRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
    g.endFill();
  }

  private drawWallTile(g: Graphics, x: number, y: number, row: number, col: number) {
    const p = this.palette;
    g.beginFill(p.wallBase);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
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
          g.beginFill(p.wallBrick);
          g.drawRect(clippedX, clippedY, clippedW, clippedH);
          g.endFill();
          g.beginFill(p.wallHighlight, 0.55);
          g.drawRect(clippedX, clippedY, clippedW, 2);
          g.drawRect(clippedX, clippedY, 2, clippedH);
          g.endFill();
          g.beginFill(p.wallShadow, 0.4);
          g.drawRect(clippedX, clippedY + clippedH - 1, clippedW, 1);
          g.drawRect(clippedX + clippedW - 1, clippedY, 1, clippedH);
          g.endFill();
        }
      }
    }
    g.beginFill(p.wallSheen, 0.25);
    g.drawRect(x, y, TILE_SIZE, 2);
    g.endFill();
  }

  private drawBossFloorTile(g: Graphics, x: number, y: number, row: number, col: number) {
    g.beginFill(0x110820);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
    const v = (row * 11 + col * 7) % 4;
    if (v < 2) {
      g.beginFill(0x1c0e30, 0.7);
      g.drawRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      g.endFill();
    }
    g.lineStyle(1, 0x5500bb, 0.25);
    g.drawRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.lineStyle(0);
    if ((row + col) % 4 === 0) {
      g.beginFill(0x7700dd, 0.18);
      g.drawCircle(x + 6, y + 6, 2);
      g.drawCircle(x + TILE_SIZE - 6, y + 6, 2);
      g.drawCircle(x + 6, y + TILE_SIZE - 6, 2);
      g.drawCircle(x + TILE_SIZE - 6, y + TILE_SIZE - 6, 2);
      g.endFill();
    }
    if ((row * 3 + col * 5) % 8 === 0) {
      g.beginFill(0x4400aa, 0.12);
      g.drawCircle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 14);
      g.endFill();
    }
  }

  private drawTrapIndicator(g: Graphics, x: number, y: number) {
    const color = this.palette.trapColor;
    const r2 = (color >> 16) & 0xff, g2 = (color >> 8) & 0xff, b2 = color & 0xff;
    const darker = ((r2 >> 1) << 16) | ((g2 >> 1) << 8) | (b2 >> 1);
    g.beginFill(darker, 0.22);
    g.drawRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    g.endFill();
    g.lineStyle(2, color, 0.45);
    const cx = x + TILE_SIZE / 2, cy = y + TILE_SIZE / 2;
    const rad = 14;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      g.lineTo(cx + Math.cos(a + Math.PI / 4) * rad * 0.5, cy + Math.sin(a + Math.PI / 4) * rad * 0.5);
    }
    g.lineStyle(0);
    g.beginFill(color, 0.5);
    g.drawPolygon([cx, cy - 9, cx + 7, cy, cx, cy + 9, cx - 7, cy]);
    g.endFill();
    const lighter = ((Math.min(r2 + 68, 255)) << 16) | ((Math.min(g2 + 68, 255)) << 8) | Math.min(b2 + 68, 255);
    g.beginFill(lighter, 0.6);
    g.drawPolygon([cx, cy - 4, cx + 3, cy, cx, cy + 4, cx - 3, cy]);
    g.endFill();
  }

  private drawStairsTile(g: Graphics, x: number, y: number) {
    // Floor base
    this.drawFloorTile(g, x, y, this.stairsRow, this.stairsCol);
    // Glowing stairs icon
    const cx = x + TILE_SIZE / 2, cy = y + TILE_SIZE / 2;
    const sc = this.palette.stairsColor;
    g.beginFill(sc, 0.3);
    g.drawCircle(cx, cy, 18);
    g.endFill();
    g.beginFill(sc, 0.5);
    g.drawCircle(cx, cy, 12);
    g.endFill();
    // Stair steps
    g.beginFill(0xffffff, 0.7);
    g.drawRect(cx - 8, cy - 6, 16, 3);
    g.drawRect(cx - 6, cy - 1, 12, 3);
    g.drawRect(cx - 4, cy + 4, 8, 3);
    g.endFill();
    // Down arrow
    g.beginFill(0xffffff, 0.9);
    g.drawPolygon([cx - 5, cy + 9, cx + 5, cy + 9, cx, cy + 14]);
    g.endFill();
  }

  private drawTorchStatic(g: Graphics, x: number, y: number) {
    g.beginFill(0x555566);
    g.drawRoundedRect(x - 4, y - 4, 8, 6, 2);
    g.endFill();
    g.beginFill(0x8b6914);
    g.drawRoundedRect(x - 3, y - 18, 6, 18, 2);
    g.endFill();
    g.beginFill(0x4a3008);
    g.drawRoundedRect(x - 6, y - 26, 12, 10, 3);
    g.endFill();
    g.beginFill(0x6a4810, 0.8);
    g.drawRoundedRect(x - 5, y - 25, 10, 5, 2);
    g.endFill();
    const flames = this.palette.torchFlame;
    g.beginFill(flames[0], 0.7);
    g.drawEllipse(x, y - 28, 5, 7);
    g.endFill();
    g.beginFill(flames[1], 0.85);
    g.drawEllipse(x, y - 29, 3, 5);
    g.endFill();
    g.beginFill(flames[2], 0.9);
    g.drawEllipse(x, y - 31, 2, 3);
    g.endFill();
  }

  // ── Render to Texture ────────────────────────────────────────

  private renderToTexture(renderer: Renderer) {
    const c = new Container();
    for (let r = 0; r < this.rows; r++) {
      for (let col = 0; col < this.cols; col++) {
        const tile = this.data[r][col];
        const x = col * TILE_SIZE, y = r * TILE_SIZE;
        const g = new Graphics();
        if (tile === TILE.WALL) {
          this.drawWallTile(g, x, y, r, col);
        } else if (tile === TILE.BOSS_FLOOR) {
          this.drawBossFloorTile(g, x, y, r, col);
        } else if (tile === TILE.TRAP) {
          this.drawFloorTile(g, x, y, r, col);
          this.drawTrapIndicator(g, x, y);
        } else if (tile === TILE.STAIRS) {
          this.drawStairsTile(g, x, y);
        } else {
          this.drawFloorTile(g, x, y, r, col);
        }
        c.addChild(g);
      }
    }

    // Torches
    for (const [tc, tr] of this.torchPositions) {
      if (tr < this.rows && tc < this.cols) {
        const g = new Graphics();
        this.drawTorchStatic(g, tc * TILE_SIZE + TILE_SIZE / 2, tr * TILE_SIZE + TILE_SIZE / 2);
        c.addChild(g);
      }
    }

    const rt = RenderTexture.create({ width: this.pixelWidth, height: this.pixelHeight });
    renderer.render(c, { renderTexture: rt });
    const sprite = new Sprite(rt);
    this.container.addChildAt(sprite, 0);
  }
}
