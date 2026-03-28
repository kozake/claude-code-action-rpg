import { Graphics, Container, Text } from 'pixi.js';

export type ItemType = 'heart' | 'xpGem' | 'crystal';

interface DroppedItem {
  x: number;
  y: number;
  type: ItemType;
  gfx: Container;
  bobTimer: number;
  lifetime: number;
  sparkleTimer: number;
  collected: boolean;
  // Crystal buff details
  buffDuration?: number;
}

const PICKUP_RADIUS = 36;
const ITEM_LIFETIME = 12; // seconds before disappearing

export class ItemSystem {
  readonly container: Container;
  private items: DroppedItem[] = [];

  constructor() {
    this.container = new Container();
  }

  /** Drop random items at a position (call on enemy death) */
  dropFromEnemy(x: number, y: number, isBoss = false) {
    const roll = Math.random();
    if (isBoss) {
      // Boss always drops lots of items
      this.spawn(x - 20, y, 'heart');
      this.spawn(x + 20, y, 'heart');
      this.spawn(x, y - 20, 'xpGem');
      this.spawn(x, y + 20, 'crystal');
      return;
    }
    if (roll < 0.35) {
      this.spawn(x, y, 'heart');
    } else if (roll < 0.6) {
      this.spawn(x, y, 'xpGem');
    } else if (roll < 0.72) {
      this.spawn(x, y, 'crystal');
    }
    // 28% chance: nothing
  }

  /** Drop from destructible objects */
  dropFromDestructible(x: number, y: number) {
    const roll = Math.random();
    if (roll < 0.5) {
      this.spawn(x, y, 'heart');
    } else if (roll < 0.85) {
      this.spawn(x, y, 'xpGem');
    } else {
      this.spawn(x, y, 'crystal');
    }
  }

  private spawn(x: number, y: number, type: ItemType) {
    const gfx = new Container();
    const g = new Graphics();

    if (type === 'heart') {
      // Red heart
      g.beginFill(0xff3366);
      g.moveTo(0, -4);
      g.bezierCurveTo(-8, -12, -14, -2, 0, 8);
      g.moveTo(0, -4);
      g.bezierCurveTo(8, -12, 14, -2, 0, 8);
      g.endFill();
      // Highlight
      g.beginFill(0xff88aa, 0.6);
      g.drawCircle(-3, -5, 2);
      g.endFill();
    } else if (type === 'xpGem') {
      // Blue diamond
      g.beginFill(0x44aaff);
      g.drawPolygon([0, -10, 8, 0, 0, 10, -8, 0]);
      g.endFill();
      g.beginFill(0x88ddff, 0.5);
      g.drawPolygon([0, -10, 4, -2, 0, 2, -4, -2]);
      g.endFill();
    } else {
      // Golden crystal
      g.beginFill(0xffdd44);
      g.drawPolygon([0, -12, 7, -3, 7, 5, 0, 12, -7, 5, -7, -3]);
      g.endFill();
      g.beginFill(0xffff88, 0.6);
      g.drawPolygon([0, -12, 4, -4, 0, 0, -4, -4]);
      g.endFill();
      // Glow
      g.beginFill(0xffdd44, 0.2);
      g.drawCircle(0, 0, 16);
      g.endFill();
    }

    gfx.addChild(g);
    gfx.x = x;
    gfx.y = y;
    this.container.addChild(gfx);

    this.items.push({
      x, y, type, gfx,
      bobTimer: Math.random() * Math.PI * 2,
      lifetime: ITEM_LIFETIME,
      sparkleTimer: 0,
      collected: false,
    });
  }

  /** Update items and check pickup against player. Returns collected items. */
  update(dt: number, playerX: number, playerY: number): ItemType[] {
    const collected: ItemType[] = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.lifetime -= dt;
      item.bobTimer += dt * 4;
      item.sparkleTimer += dt;

      // Bob animation
      item.gfx.y = item.y + Math.sin(item.bobTimer) * 4;
      item.gfx.x = item.x;

      // Scale pulse
      const pulse = 1 + Math.sin(item.bobTimer * 1.5) * 0.1;
      item.gfx.scale.set(pulse);

      // Blink when about to expire
      if (item.lifetime < 2) {
        item.gfx.alpha = Math.sin(item.lifetime * 8) > 0 ? 1 : 0.3;
      }

      // Check pickup
      const dx = playerX - item.x;
      const dy = playerY - item.y;
      if (dx * dx + dy * dy < PICKUP_RADIUS * PICKUP_RADIUS) {
        collected.push(item.type);
        item.collected = true;
      }

      // Remove if collected or expired
      if (item.collected || item.lifetime <= 0) {
        this.container.removeChild(item.gfx);
        this.items.splice(i, 1);
      }
    }

    return collected;
  }

  clear() {
    for (const item of this.items) {
      this.container.removeChild(item.gfx);
    }
    this.items = [];
  }
}
