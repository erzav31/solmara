// Deterministic screenshot scenes (?shot=start|play|chase|end&seed=1).
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a road-following autopilot, so the frame is
// what real play looks like and the same seed always gives the same frame.
import { STEP, ROAD } from './config.js';
import { makeInput, clearPressed } from './input.js';
import { dist, angleDiff, clamp } from './random.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_BUSTED } from './render.js';
import { makeCop } from './entities.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 9;

// Road-following waypoint: first reach the target's avenue along the
// current street, then drive down the avenue to the target.
function waypointFor(world, tx, ty) {
  const p = world.player;
  const targetAvenue = ROAD.avenues.reduce((best, ax) => (Math.abs(ax - tx) < Math.abs(best - tx) ? ax : best), ROAD.avenues[0]);
  if (Math.abs(p.x - targetAvenue) > 48) {
    const street = ROAD.streets.reduce((best, sy) => (Math.abs(sy - p.y) < Math.abs(best - p.y) ? sy : best), ROAD.streets[0]);
    return { x: targetAvenue, y: street };
  }
  return { x: tx, y: ty };
}

function autopilot(world) {
  const input = makeInput();
  const p = world.player;
  if (p.onFoot) {
    // Walk to the nearest car that can be entered.
    let best = null;
    let bestD = Infinity;
    for (const car of world.traffic) {
      if (car.dead || car.hp <= 0) continue;
      if (!car.parked && car.speed > 40) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return input;
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (dx > 12) input.right = true;
    if (dx < -12) input.left = true;
    if (dy > 12) input.down = true;
    if (dy < -12) input.up = true;
    if (bestD < 46) input.pressedInteract = true;
    return input;
  }
  // Driving: steer toward the road waypoint for the mission target.
  const target = world.missionTarget();
  const tx = target ? target.x : p.x + 600;
  const ty = target ? target.y : p.y;
  const wp = waypointFor(world, tx, ty);
  const desired = Math.atan2(wp.y - p.y, wp.x - p.x);
  const diff = angleDiff(p.angle, desired);
  const d = dist(p.x, p.y, wp.x, wp.y);
  if (Math.abs(diff) > 2.4 && d > 120) {
    input.down = true; // reverse out of a bad angle
  } else {
    input.up = true;
  }
  if (diff > 0.12) input.right = true;
  else if (diff < -0.12) input.left = true;
  return input;
}

function runFor(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = drive ? autopilot(world) : makeInput();
    world.step(STEP, input);
    clearPressed(input);
    if (world.screen !== 'play') break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Names: start (title), play (driving to the first job), chase (wanted 3,
 * PD cars on the tail), end (busted). Any other name is start.
 */
export function stageShot(name, world) {
  world.reset();
  world.screen = 'play';
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    runFor(world, START_SECONDS, false);
    world.screen = 'title';
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Put the player in a car, heat the trail to 3 stars, add two PD cars.
    runFor(world, 2, true);
    if (world.player.onFoot) {
      const car = world.traffic.find((c) => c.parked && !c.dead);
      if (car) {
        world.player.x = car.x - 30;
        world.player.y = car.y;
        const input = makeInput();
        input.pressedInteract = true;
        world.step(STEP, input);
      }
    }
    world.heat = 70;
    world.wantedStars = 3;
    for (let i = 0; i < 2; i += 1) {
      const cop = makeCop('car', world.player.x + (i === 0 ? -260 : 200), world.player.y + (i === 0 ? -140 : 180));
      world.cops.push(cop);
    }
    runFor(world, CHASE_SECONDS, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    // Stand still while a foot cop closes in and makes the bust.
    const cop = makeCop('foot', world.player.x + 90, world.player.y + 40);
    world.cops.push(cop);
    runFor(world, 12, false);
    if (world.screen !== 'busted') world.busted();
    return { screen: SCREEN_BUSTED };
  }
  // play: drive to the first job.
  runFor(world, PLAY_SECONDS, true);
  return { screen: world.screen === 'play' ? SCREEN_PLAY : world.screen };
}

export { clamp };
