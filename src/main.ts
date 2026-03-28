import { Application } from 'pixi.js';
import { GameScene } from './game/GameScene';

// Disable all default touch behaviors globally
document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

const app = new Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x0a0c18,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  antialias: true,
});

document.body.appendChild(app.view as HTMLCanvasElement);

const scene = new GameScene(app);
app.stage.addChild(scene.container);

app.ticker.add((delta: number) => {
  scene.update(delta);
});

window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  scene.onResize(window.innerWidth, window.innerHeight);
});
