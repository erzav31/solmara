// Cars, pedestrians and police. All movement is pure simulation — no DOM,
// so the logic test can drive these directly.
import { WORLD, ROAD, CAR, COP } from './config.js';
import { Rng, clamp, angleDiff, dist } from './random.js';
import { isRoadPoint, nearestRoadPoint, collideBuildings, collideWorldBounds, blockWater } from './city.js';

const CAR_COLORS = ['#c94f38', '#3e7a4e', '#c9a13b', '#7a5a9e', '#4a6b8c', '#8c8c8c', '#b8b0a0'];
const SPORT_COLORS = ['#d8232a', '#f2a007', '#1fb6c9'];

let nextId = 1;
export function resetIds() { nextId = 1; }

export function makeCar(kind, x, y, angle, rng) {
  const sport = kind === 'sport';
  return {
    id: nextId,
    kind, // 'sedan' | 'sport' | 'taxi' | 'pd' | 'parked'
    x, y,
    angle: angle || 0,
    speed: 0,
    hp: CAR.hp,
    radius: CAR.radius,
    color: kind === 'pd' ? '#2e6fd8' : kind === 'taxi' ? '#e8c832' : sport ? (rng ? rng.pick(SPORT_COLORS) : SPORT_COLORS[0]) : (rng ? rng.pick(CAR_COLORS) : CAR_COLORS[0]),
    parked: kind === 'parked',
    driver: kind !== 'parked',
    dir: 0, // traffic heading: 0=E 1=S 2=W 3=N
    lane: 0,
    crashCd: 0,
    dead: false,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextId,
    x, y,
    angle: rng ? rng.angle() : 0,
    speed: rng ? rng.range(45, 75) : 55,
    hp: 100,
    radius: 10,
    state: 'walk', // walk | flee | down
    fleeT: 0,
    turnT: 0,
    dead: false,
  };
}

export function makeCop(kind, x, y) {
  return {
    id: nextId,
    kind, // 'foot' | 'car'
    x, y,
    angle: 0,
    speed: 0,
    hp: 100,
    radius: kind === 'car' ? CAR.radius : 12,
    state: 'chase',
    loseT: 0,
    ramCd: 0,
    bustT: 0,
    shootCd: 0,
    dead: false,
  };
}

// --- Traffic: drive along the road grid, turn at intersections. ---
const DIRS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

export function stepTrafficCar(car, dt, rng, others) {
  if (car.parked || car.dead) return;
  const d = DIRS[car.dir];
  const targetSpeed = 150;
  // Slow down for the car ahead.
  let ahead = Infinity;
  for (const o of others) {
    if (o === car || o.parked || o.dead) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const along = dx * d.dx + dy * d.dy;
    const side = Math.abs(dx * d.dy - dy * d.dx);
    if (along > 0 && along < 90 && side < 26) ahead = Math.min(ahead, along);
  }
  const want = ahead < 70 ? 0 : targetSpeed;
  car.speed += clamp(want - car.speed, -500 * dt, 260 * dt);
  car.x += d.dx * car.speed * dt;
  car.y += d.dy * car.speed * dt;
  car.angle = Math.atan2(d.dy, d.dx);

  // At an intersection, sometimes turn onto the crossing road.
  const nearV = ROAD.avenues.some((ax) => Math.abs(car.x - ax) < 14);
  const nearH = ROAD.streets.some((sy) => Math.abs(car.y - sy) < 14);
  if (nearV && nearH && rng.chance(0.35)) {
    const vertical = d.dy !== 0;
    if (vertical) {
      car.dir = rng.chance(0.5) ? 0 : 2;
      car.y = nearestRoadPoint(car.x, car.y).y;
    } else {
      car.dir = rng.chance(0.5) ? 1 : 3;
      car.x = nearestRoadPoint(car.x, car.y).x;
    }
  }
  // Off the map: respawn on a random road edge.
  if (car.x < 40 || car.x > ROAD.beachX - 20 || car.y < 40 || car.y > WORLD.height - 40) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      car.x = rng.pick(ROAD.avenues.slice(0, -1));
      car.y = rng.chance(0.5) ? 90 : WORLD.height - 90;
      car.dir = car.y < 200 ? 1 : 3;
    } else {
      car.y = rng.pick(ROAD.streets);
      car.x = rng.chance(0.5) ? 90 : ROAD.beachX - 120;
      car.dir = car.x < 200 ? 0 : 2;
    }
    car.speed = 120;
  }
}

export function stepPed(ped, dt, rng, threat) {
  if (ped.dead || ped.state === 'down') return;
  ped.turnT -= dt;
  if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 260) {
    ped.state = 'flee';
    ped.fleeT = 1.5;
  }
  if (ped.state === 'flee') {
    if (!threat) {
      ped.state = 'walk';
    } else {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * 1.9 * dt;
      ped.y += Math.sin(a) * ped.speed * 1.9 * dt;
    }
  } else {
    if (ped.turnT <= 0) {
      ped.turnT = rng.range(1.5, 4);
      // Walk along a road: snap the heading to the grid.
      ped.angle = (Math.floor(rng.next() * 4) * Math.PI) / 2;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (!isRoadPoint(ped.x, ped.y) && rng.chance(0.02)) {
      const s = nearestRoadPoint(ped.x, ped.y);
      ped.x += (s.x - ped.x) * 0.1;
      ped.y += (s.y - ped.y) * 0.1;
    }
  }
  collideWorldBounds(ped, 30);
}

// --- Police ---
export function stepCopFoot(cop, player, dt) {
  if (cop.dead) return 'dead';
  const d = dist(cop.x, cop.y, player.x, player.y);
  const run = player.wantedStars >= 3;
  const speed = run ? COP.footRunSpeed : COP.footSpeed;
  if (d > 26) {
    const a = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * speed * dt;
    cop.y += Math.sin(a) * speed * dt;
    cop.bustT = 0;
  } else if (player.onFoot) {
    cop.bustT += dt;
    if (cop.bustT >= COP.bustSeconds) return 'bust';
  }
  if (d > COP.copViewRange) {
    cop.loseT += dt;
    if (cop.loseT > COP.giveUpSeconds) return 'giveup';
  } else {
    cop.loseT = 0;
  }
  return 'chase';
}

export function stepCopCar(cop, player, dt, city) {
  if (cop.dead) return null;
  const d = dist(cop.x, cop.y, player.x, player.y);
  const target = Math.atan2(player.y - cop.y, player.x - cop.x);
  const turn = clamp(angleDiff(cop.angle, target), -3.2 * dt, 3.2 * dt);
  cop.angle += turn;
  const want = d > 90 ? 560 : 380;
  cop.speed += clamp(want - cop.speed, -700 * dt, 520 * dt);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  cop.ramCd -= dt;
  collideBuildings(city, cop);
  collideWorldBounds(cop, 20);
  blockWater(cop, true);
  if (d > COP.copViewRange * 1.6) {
    cop.loseT += dt;
    if (cop.loseT > COP.giveUpSeconds) return 'giveup';
  } else {
    cop.loseT = 0;
  }
  return null;
}

// Simple circle-vs-circle separation; returns damage for `a` when hard.
export function separateCircles(a, b, damage) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.radius + b.radius;
  if (d >= min || d < 0.001) return 0;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  return damage || 0;
}

export { Rng };
