import { Container, Graphics, Text } from 'pixi.js';
import type { Application } from 'pixi.js';
import { WorldMap, TILE_SIZE } from './maps/WorldMap';
import { Player } from './entities/Player';
import { Enemy, Boss } from './entities/Enemy';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { AttackButton } from '../ui/AttackButton';
import { HUD } from '../ui/HUD';
import { InputManager } from '../input';
import { AudioManager } from '../audio';
import { ParticleSystem } from './Particles';

type GameState = 'title' | 'playing' | 'gameover' | 'win';

// Enemy sprite rotation: alternate between different enemy sprites
const ENEMY_SPRITES = [
  './images/enemy1.png',
  './images/enemy2.png',
  './images/enemy3.png',
];

export class GameScene {
  readonly container: Container;
  private world: Container;
  private ui: Container;

  private map: WorldMap;
  private player: Player;
  private enemies: Enemy[];
  private boss: Boss;
  private particles: ParticleSystem;

  private joystick: VirtualJoystick;
  private attackButton: AttackButton;
  private hud: HUD;
  private input: InputManager;
  private audio: AudioManager;

  private cameraX = 0;
  private cameraY = 0;
  private screenW: number;
  private screenH: number;

  private bossTriggered = false;
  private state: GameState = 'title';

  // Screen shake
  private shakeTime = 0;
  private shakeIntensity = 0;

  // Title screen overlay
  private titleOverlay: Container;

  constructor(app: Application) {
    this.screenW = app.screen.width;
    this.screenH = app.screen.height;

    this.container = new Container();
    this.world = new Container();
    this.ui = new Container();
    this.container.addChild(this.world);
    this.container.addChild(this.ui);

    // Map
    this.map = new WorldMap(app.renderer as import('pixi.js').Renderer);
    this.world.addChild(this.map.container);

    // Player – use findSafeSpawn to guarantee a non-wall tile
    const spawn = this.map.findSafeSpawn(3, 2);
    this.player = new Player(spawn.x, spawn.y);
    this.world.addChild(this.player.container);

    // Enemies in the field area (alternate sprite types)
    const enemyDefs: [number, number, number, number][] = [
      // [tileCol, tileRow, hp, speed]
      [14, 5, 50, 75],
      [22, 8, 55, 80],
      [9, 14, 45, 70],
      [34, 4, 60, 85],
      [38, 13, 50, 80],
      [27, 17, 65, 70],
      [18, 22, 55, 90],
      [42, 7, 45, 75],
      [7, 20, 70, 65],
      [46, 18, 60, 80],
      [30, 10, 50, 85],
      [13, 26, 55, 70],
    ];
    this.enemies = enemyDefs.map(([tc, tr, hp, spd], i) => {
      const spriteUrl = ENEMY_SPRITES[i % ENEMY_SPRITES.length];
      const e = new Enemy(
        tc * TILE_SIZE + TILE_SIZE / 2,
        tr * TILE_SIZE + TILE_SIZE / 2,
        hp, spd, 10, 36, 20, 36, 36,
        spriteUrl,
      );
      this.world.addChild(e.container);
      return e;
    });

    // Boss
    this.boss = new Boss(TILE_SIZE * 25, TILE_SIZE * 35);
    this.world.addChild(this.boss.container);

    // Particle system
    this.particles = new ParticleSystem();
    this.world.addChild(this.particles.container);

    // UI
    this.joystick = new VirtualJoystick(this.screenW, this.screenH);
    this.attackButton = new AttackButton(this.screenW, this.screenH);
    this.hud = new HUD(this.screenW, this.screenH);
    this.input = new InputManager(this.joystick, this.attackButton);
    this.audio = new AudioManager();

    this.input.init();

    this.ui.addChild(this.hud.container);
    this.ui.addChild(this.joystick.container);
    this.ui.addChild(this.attackButton.container);

    // Title overlay
    this.titleOverlay = this.buildTitleOverlay();
    this.ui.addChild(this.titleOverlay);

    // Unlock audio + start on first interaction
    const startGame = () => {
      if (this.state !== 'title') return;
      this.state = 'playing';
      this.titleOverlay.visible = false;
      this.audio.unlock();
      this.audio.playField();
    };
    window.addEventListener('touchstart', startGame, { once: true });
    window.addEventListener('keydown', startGame, { once: true });
    window.addEventListener('click', startGame, { once: true });
  }

  private buildTitleOverlay(): Container {
    const overlay = new Container();

    const bg = new Graphics();
    bg.beginFill(0x000000, 0.78);
    bg.drawRect(0, 0, this.screenW, this.screenH);
    bg.endFill();
    overlay.addChild(bg);

    const title = new Text('⚔ Action RPG ⚔', {
      fontSize: 36,
      fill: 0xffdd44,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 6,
      align: 'center',
    });
    title.anchor.set(0.5);
    title.x = this.screenW / 2;
    title.y = this.screenH / 2 - 80;
    overlay.addChild(title);

    const sub = new Text('ボスを倒してクリア！\n\nスマホ: 左で移動 / 右⚔で攻撃 / 💨でダッシュ\nPC: WASD で移動 / Space で攻撃 / X でダッシュ\n\nタップまたはキーを押してスタート', {
      fontSize: 15,
      fill: 0xffffff,
      align: 'center',
      stroke: 0x000000,
      strokeThickness: 3,
      lineHeight: 22,
    });
    sub.anchor.set(0.5);
    sub.x = this.screenW / 2;
    sub.y = this.screenH / 2 + 30;
    overlay.addChild(sub);

    return overlay;
  }

  /** Trigger a brief screen shake */
  private shake(intensity: number, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeTime = duration;
  }

  update(delta: number) {
    const dt = delta / 60;

    if (this.state === 'title') return;
    if (this.state === 'gameover' || this.state === 'win') return;

    this.input.update();

    // Player update
    const wasInvincible = this.player.invincibleTime > 0;
    this.player.update(dt, this.input, this.map);

    // Screen shake when player takes damage
    const tookDamage = !wasInvincible && this.player.invincibleTime > 0;
    if (tookDamage) {
      this.shake(8, 0.3);
      this.particles.emitHit(this.player.x, this.player.y);
    }

    // Check player attack hits
    const hitbox = this.player.getAttackHitbox();
    if (hitbox) {
      for (const enemy of this.enemies) {
        if (!enemy.dead && this.circleHit(hitbox, enemy)) {
          const wasDead = enemy.dead;
          enemy.takeDamage(this.player.attackDamage);
          if (!wasDead) {
            this.particles.emitHit(hitbox.cx, hitbox.cy);
            this.particles.showDamage(enemy.x, enemy.y, this.player.attackDamage, false);
            if (enemy.dead) {
              this.particles.emitDeath(enemy.x, enemy.y, 0x44cc44);
              this.player.addXp(enemy.xpReward);
            }
          }
        }
      }
      if (!this.boss.dead && this.circleHit(hitbox, this.boss)) {
        const wasPh2 = this.boss.isAngry;
        const wasDeadBoss = this.boss.dead;
        this.boss.takeDamage(this.player.attackDamage);
        if (!wasDeadBoss) {
          this.particles.emitHit(hitbox.cx, hitbox.cy);
          this.particles.showDamage(this.boss.x, this.boss.y, this.player.attackDamage, true);
          if (!wasPh2 && this.boss.isAngry) {
            this.shake(15, 0.5);
            this.particles.emitBossRage(this.boss.x, this.boss.y);
            this.hud.triggerFlash(0xff0000, 0.8);
            this.hud.showMessage('⚠ PHASE 2 ⚠', 2);
          }
          if (this.boss.dead) {
            this.particles.emitDeath(this.boss.x, this.boss.y, 0x9900aa);
            this.particles.emitDeath(this.boss.x, this.boss.y, 0xff4400);
            this.state = 'win';
            this.audio.stop();
            this.hud.showMessage('🎉 YOU WIN!\nボスを倒した！\n\nリロードして再プレイ', 9999);
          }
        }
      }
    }

    // Level up message
    if (this.player.justLeveledUp) {
      this.player.justLeveledUp = false;
      this.particles.showLevelUp(this.player.x, this.player.y - 20);
      this.hud.showMessage(`✨ LEVEL UP! Lv.${this.player.level}`, 2);
    }

    // Enemy updates
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player, this.map);
    }

    // Boss
    if (!this.boss.dead) {
      this.boss.update(dt, this.player, this.map);
    }

    // Check boss room entry
    const playerRow = Math.floor(this.player.y / TILE_SIZE);
    if (!this.bossTriggered && playerRow >= this.map.bossRowStart) {
      this.bossTriggered = true;
      this.audio.playBoss();
      this.shake(10, 0.4);
      this.hud.triggerFlash(0x440000, 0.6);
      this.hud.showMessage('⚠ BOSS ROOM ⚠', 3);
    }
    // Return to field music if player goes back
    if (this.bossTriggered && playerRow < this.map.bossRowStart && !this.boss.dead) {
      this.bossTriggered = false;
      this.audio.playField();
    }

    // Game over
    if (this.player.dead) {
      this.state = 'gameover';
      this.audio.stop();
      this.hud.showMessage('💀 GAME OVER\n\nリロードして再プレイ', 9999);
    }

    // Camera with shake
    this.updateCamera(dt);

    // Update particles (pass camera position for container offset)
    this.particles.update(dt, this.cameraX, this.cameraY);

    // HUD
    this.hud.update(
      dt,
      this.player,
      this.bossTriggered && !this.boss.dead ? this.boss : null,
    );
  }

  private circleHit(
    hb: { cx: number; cy: number; r: number },
    entity: { x: number; y: number; w: number; h: number },
  ): boolean {
    const closestX = Math.max(entity.x - entity.w / 2, Math.min(hb.cx, entity.x + entity.w / 2));
    const closestY = Math.max(entity.y - entity.h / 2, Math.min(hb.cy, entity.y + entity.h / 2));
    const dx = hb.cx - closestX;
    const dy = hb.cy - closestY;
    return dx * dx + dy * dy <= hb.r * hb.r;
  }

  private updateCamera(dt: number) {
    const targetX = this.player.x - this.screenW / 2;
    const targetY = this.player.y - this.screenH / 2;
    const maxX = this.map.pixelWidth - this.screenW;
    const maxY = this.map.pixelHeight - this.screenH;
    this.cameraX = Math.max(0, Math.min(maxX, targetX));
    this.cameraY = Math.max(0, Math.min(maxY, targetY));

    // Apply screen shake
    let shakeOffX = 0;
    let shakeOffY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const intensity = this.shakeIntensity * (this.shakeTime / 0.25);
      shakeOffX = (Math.random() - 0.5) * intensity * 2;
      shakeOffY = (Math.random() - 0.5) * intensity * 2;
    }

    this.world.x = -this.cameraX + shakeOffX;
    this.world.y = -this.cameraY + shakeOffY;
  }

  onResize(w: number, h: number) {
    this.screenW = w;
    this.screenH = h;
    this.hud.onResize(w, h);
    this.joystick.onResize(w, h);
    this.attackButton.onResize(w, h);

    // Resize title overlay bg
    if (this.titleOverlay.children[0] instanceof Graphics) {
      const bg = this.titleOverlay.children[0] as Graphics;
      bg.clear();
      bg.beginFill(0x000000, 0.78);
      bg.drawRect(0, 0, w, h);
      bg.endFill();
    }
  }
}
