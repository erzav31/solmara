// SOLMARA — Sun Coast Hustle: loop game + state machine layar.
import { CFG } from './config.js';
import { Input } from './input.js';
import { createWorld, stepWorld } from './world.js';
import { createRenderer, drawWorld, drawHUD, drawScreen } from './render.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = CFG.viewW;
canvas.height = CFG.viewH;
const renderer = createRenderer(canvas);
const input = new Input();
input.attach(canvas);
const world = createWorld(seed);

function updateMouseWorld() {
  world.mouseWorld.x = input.mouseX + world.cam.x - CFG.viewW / 2;
  world.mouseWorld.y = input.mouseY + world.cam.y - CFG.viewH / 2;
}

function render() {
  const { ctx } = renderer;
  ctx.clearRect(0, 0, CFG.viewW, CFG.viewH);
  drawWorld(renderer, world);
  if (world.state === 'play' || world.state === 'pause') drawHUD(renderer, world);
  drawScreen(renderer, world);
}

if (shot) {
  // Mode screenshot: scene deterministik, render sekali, tanpa loop.
  setupShot(world, shot);
  updateMouseWorld();
  render();
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateMouseWorld();
    // Transisi layar.
    if (input.hit('Enter')) {
      if (world.state === 'title') {
        world.state = 'play';
        world.audio.resume();
        world.audio.click();
        world.toast('Selamat datang di Solmara — cari Rosa Garage untuk misi');
      } else if (world.state === 'busted' || world.state === 'wasted') {
        world.respawn();
        world.state = 'play';
      } else if (world.win) {
        world.win = false;
      }
    }
    if (input.hit('KeyP') || input.hit('Escape')) {
      if (world.state === 'play') world.state = 'pause';
      else if (world.state === 'pause') world.state = 'play';
    }
    if (world.state === 'play') stepWorld(world, input, dt);
    render();
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
