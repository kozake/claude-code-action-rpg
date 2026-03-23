import { Application, Assets, settings, SCALE_MODES } from 'pixi.js';
import { GameScene } from './game/GameScene';

// Pixel-art crisp scaling
settings.SCALE_MODE = SCALE_MODES.NEAREST;

// Disable all default touch behaviors globally
document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

const app = new Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x1a1a2e,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  antialias: false,
});

document.body.appendChild(app.view as HTMLCanvasElement);

(async () => {
  // Preload all sprite assets before starting the game
  await Assets.load([
    './images/floor0.png',
    './images/floor1.png',
    './images/floor2.png',
    './images/wall.png',
    './images/boss_floor.png',
    './images/torch.png',
    './images/player.png',
    './images/enemy1.png',
    './images/enemy2.png',
    './images/enemy3.png',
    './images/boss.png',
  ]);

  const scene = new GameScene(app);
  app.stage.addChild(scene.container);

  app.ticker.add((delta: number) => {
    scene.update(delta);
  });

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    scene.onResize(window.innerWidth, window.innerHeight);
  });
})();
