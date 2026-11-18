// Boot + game loop: canvas setup, fixed-step simulation, screens,
// mouse-to-world aiming, sound hooks and the ?shot= screenshot mode.
import { World } from './world.js';
import { makeInput, attachInput, clearPressed } from './input.js';
import { SoundFX } from './audio.js';
import { drawWorld, drawHUD, drawScreen, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { STEP, SAVE_KEY } from './config.js';

function storage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

export function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || '1') || 1;
  const shotName = params.get('shot');

  const world = new World(seed, storage() || undefined);
  const sfx = new SoundFX();
  world.sfx = sfx;
  const input = makeInput();
  attachInput(input, canvas);

  let screen = SCREEN_TITLE;
  let paused = false;
  let shotScreen = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  if (shotName) {
    // Screenshot mode: stage a deterministic scene, then render it frozen.
    shotScreen = stageShot(shotName, world);
    screen = shotScreen.screen;
    world.screen = screen === SCREEN_TITLE ? 'title' : 'play';
    drawFrame();
    return { world, screen };
  }

  world.screen = 'title';
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.pressedMute) {
      sfx.setMuted(!sfx.muted);
    }
    if (input.pressedPause && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
      paused = !paused;
      screen = paused ? SCREEN_PAUSE : SCREEN_PLAY;
    }
    if (screen === SCREEN_TITLE && input.pressedConfirm) {
      sfx.unlock();
      world.screen = 'play';
      screen = SCREEN_PLAY;
    } else if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_WIN) && input.pressedConfirm) {
      const keepCash = world.cash;
      const keepBest = world.best;
      const keepDone = [...world.mission.done];
      const wasWin = screen === SCREEN_WIN;
      world.reset();
      world.cash = keepCash;
      world.best = keepBest;
      world.mission.done = keepDone;
      if (wasWin && keepDone.length >= 5) {
        world.mission.allDone = true;
        world.mission.active = false;
        world.mission.index = 5;
      }
      world.screen = 'play';
      screen = SCREEN_PLAY;
      paused = false;
    }
    if (!paused && screen === SCREEN_PLAY) {
      // Aim: screen mouse -> world coordinates (kept separate so the
      // conversion never runs twice on the same values).
      input.mouseWorldX = input.mouseX - canvas.width / 2 + world.player.x;
      input.mouseWorldY = input.mouseY - canvas.height / 2 + world.player.y;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        world.step(STEP, input);
        clearPressed(input);
        acc -= STEP;
        steps += 1;
        if (world.screen !== 'play') break;
      }
      if (steps === 5) acc = 0;
      if (world.screen === 'busted') screen = SCREEN_BUSTED;
      else if (world.screen === 'wasted') screen = SCREEN_WASTED;
      else if (world.screen === 'win') screen = SCREEN_WIN;
      sfx.engine(world.engine01());
      sfx.siren(world.wantedStars > 0);
    } else {
      sfx.engine(0);
      sfx.siren(false);
    }
    clearPressed(input);
    drawFrame();
    if (status) {
      status.textContent = `SOLMARA: $${world.cash}, wanted ${world.wantedStars} stars, ${world.player.onFoot ? 'on foot' : 'driving'}.`;
    }
  }

  function drawFrame() {
    const vw = canvas.width;
    const vh = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, vw, vh);
    const cam = { x: world.player.x, y: world.player.y, w: vw, h: vh };
    ctx.save();
    ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
    drawWorld(ctx, world, cam, world.time);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHUD(ctx, world, vw, vh);
    drawScreen(ctx, world, screen, vw, vh);
  }

  requestAnimationFrame(frame);
  return { world, screen };
}

if (typeof document !== 'undefined') {
  boot();
}

export { SAVE_KEY };
