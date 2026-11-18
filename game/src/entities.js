// Mobil, pejalan kaki, polisi. Semua update menerima `world` apa adanya
// (tanpa import world.js) supaya modul ini bisa dipakai logic test.
import { CFG } from './config.js';
import { isBlocked, isRoadAt, snapToRoad, freeRoadPoint, freeRoadPointMin } from './city.js';

const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#dfe6e9', '#2d3436', '#e17055', '#00b8a9'];
const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#fd79a8', '#e67e22', '#1abc9c'];

let nextId = 1;

export function makeCar(x, y, angle, kind, color) {
  return {
    id: nextId++,
    x, y,
    angle,
    speed: 0,
    kind, // parked | traffic | pd | player
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    hp: kind === 'pd' ? 220 : 120,
    steer: 0,
    crashCd: 0,
    ramCd: 0,
    shootCd: 0,
    len: 46,
    wid: 22,
  };
}

export function makePed(x, y) {
  return {
    id: nextId++,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    state: 'walk', // walk | flee | down
    hp: 50,
    color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
    dir: Math.random() * Math.PI * 2,
    dirT: 0,
    fleeT: 0,
  };
}

export function makeFootCop(x, y) {
  return {
    id: nextId++,
    x, y,
    angle: 0,
    speed: 0,
    state: 'patrol', // patrol | chase | giveup
    hp: 100,
    lastSeen: -99,
    bustT: 0,
    shootCd: 0,
    dir: Math.random() * Math.PI * 2,
    dirT: 0,
  };
}

// Geser lingkaran (radius r) ke (nx, ny); sumbu dipisah supaya geser di dinding.
export function tryMove(city, e, nx, ny, r) {
  if (!isBlocked(city, nx + Math.sign(nx - e.x) * r, e.y) && !isBlocked(city, nx, e.y + r) && !isBlocked(city, nx, e.y - r)) {
    e.x = nx;
  } else if (!isBlocked(city, e.x + Math.sign(nx - e.x) * r, e.y)) {
    e.x = nx;
  }
  if (!isBlocked(city, e.x, ny + Math.sign(ny - e.y) * r) && !isBlocked(city, e.x + r, ny) && !isBlocked(city, e.x - r, ny)) {
    e.y = ny;
  } else if (!isBlocked(city, e.x, e.y + Math.sign(ny - e.y) * r)) {
    e.y = ny;
  }
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Fisika mobil arcade: throttle -1..1, steer -1..1, handbrake = drift.
export function stepCar(car, throttle, steer, handbrake, dt) {
  const maxSpd = CFG.carMax;
  if (throttle > 0) car.speed += CFG.carAccel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CFG.carBrake * dt;
    else car.speed += CFG.carReverse * dt * -throttle;
  } else {
    car.speed -= Math.sign(car.speed) * CFG.carDrag * Math.abs(car.speed) * dt * 2;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (handbrake) car.speed *= Math.max(0, 1 - 2.2 * dt);
  car.speed = Math.max(-CFG.carReverse, Math.min(maxSpd, car.speed));
  const turnRate = CFG.carTurn * Math.min(1, Math.abs(car.speed) / 180) * (handbrake ? 1.7 : 1);
  car.angle += steer * turnRate * Math.sign(car.speed) * dt;
  return car;
}

export function moveCar(city, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = 16;
  // Cek hidung + ekor supaya mobil tidak menembus gedung.
  const noseX = nx + Math.cos(car.angle) * 20;
  const noseY = ny + Math.sin(car.angle) * 20;
  const tailX = nx - Math.cos(car.angle) * 20;
  const tailY = ny - Math.sin(car.angle) * 20;
  if (!isBlocked(city, noseX, noseY) && !isBlocked(city, tailX, tailY) && !isBlocked(city, nx, ny)) {
    car.x = nx;
    car.y = ny;
    return true;
  }
  // Menabrak: berhenti, pantul sedikit.
  if (Math.abs(car.speed) > 120) car.speed *= -0.25;
  else car.speed = 0;
  return false;
}

// Mobil parkir di bahu jalan, sejajar arah jalan (tidak pernah di gedung).
export function spawnParkedCars(world, count, avoid = []) {
  const { city, rng } = world;
  let placed = 0;
  for (let tries = 0; tries < count * 30 && placed < count; tries++) {
    const p = freeRoadPoint(city, rng, rng.range(200, 3000), rng.range(200, 2200), 300);
    if (avoid.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 90)) continue;
    if (world.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 70)) continue;
    // Arah sejajar jalan: kalau di avenue (x dekat jalan vertikal) -> vertikal.
    const onAvenue = city.avenues.some((ax) => Math.abs(p.x - ax) <= CFG.roadHalf);
    const angle = onAvenue ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : rng.chance(0.5) ? 0 : Math.PI;
    const shoulder = onAvenue ? CFG.roadHalf + 12 : 0;
    const px = onAvenue ? p.x + (rng.chance(0.5) ? shoulder : -shoulder) : p.x;
    const py = onAvenue ? p.y : p.y + (rng.chance(0.5) ? CFG.roadHalf + 12 : -CFG.roadHalf - 12);
    if (isBlocked(city, px, py)) continue;
    world.cars.push(makeCar(px, py, angle, 'parked'));
    placed++;
  }
  return placed;
}

export function spawnTrafficCar(world) {
  const { city, rng, player } = world;
  const p = freeRoadPoint(city, rng, player.x, player.y, 700);
  const onAvenue = city.avenues.some((ax) => Math.abs(p.x - ax) <= CFG.roadHalf);
  const angle = onAvenue ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : rng.chance(0.5) ? 0 : Math.PI;
  const car = makeCar(p.x, p.y, angle, 'traffic');
  car.speed = rng.range(140, 220);
  world.cars.push(car);
  return car;
}

export function updateTraffic(world, dt) {
  const { city, player } = world;
  // Jaga ~10 mobil traffic di sekitar pemain.
  const traffic = world.cars.filter((c) => c.kind === 'traffic');
  if (traffic.length < 10) spawnTrafficCar(world);
  for (const car of [...world.cars]) {
    if (car.kind !== 'traffic') continue;
    if (dist(car, player) > 1300) {
      world.cars.splice(world.cars.indexOf(car), 1);
      continue;
    }
    // Jalan lurus di jalannya; di persimpangan kadang belok.
    if (isRoadAt(city, car.x + Math.cos(car.angle) * 60, car.y + Math.sin(car.angle) * 60)) {
      if (Math.random() < dt * 0.12) car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    } else {
      // Keluar jalur: belok balik ke jalan terdekat.
      const p = snapToRoad(city, car.x, car.y);
      car.angle = Math.atan2(p.y - car.y, p.x - car.x);
    }
    if (Math.abs(car.speed) < 140) car.speed = 180;
    moveCar(city, car, dt);
  }
}

export function spawnPedestrian(world) {
  const { city, rng, player } = world;
  const p = freeRoadPoint(city, rng, player.x, player.y, 600);
  const ped = makePed(p.x, p.y);
  world.peds.push(ped);
  return ped;
}

export function updatePedestrians(world, dt) {
  const { player } = world;
  const peds = world.peds.filter((p) => p.state !== 'down');
  if (peds.length < 14) spawnPedestrian(world);
  for (const ped of [...world.peds]) {
    if (ped.state === 'down') continue;
    if (dist(ped, player) > 1100) {
      world.peds.splice(world.peds.indexOf(ped), 1);
      continue;
    }
    const threat = nearestThreat(world, ped);
    if (threat && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeT = 2.5;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (threat) {
        ped.dir = Math.atan2(ped.y - threat.y, ped.x - threat.x);
        ped.speed = 240;
      }
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else {
      ped.dirT -= dt;
      if (ped.dirT <= 0) {
        ped.dir = Math.random() * Math.PI * 2;
        ped.dirT = 1 + Math.random() * 3;
      }
      ped.speed = 55;
    }
    ped.angle = ped.dir;
    const nx = ped.x + Math.cos(ped.dir) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.dir) * ped.speed * dt;
    tryMove(world.city, ped, nx, ny, 10);
  }
}

function nearestThreat(world, ped) {
  const { player } = world;
  // Mobil pemain yang melaju kencang, atau peluru di dekatnya.
  if (!player.onFoot && player.car && Math.abs(player.car.speed) > 200 && dist(ped, player.car) < 160) return player.car;
  for (const b of world.bullets) {
    if (Math.hypot(b.x - ped.x, b.y - ped.y) < 120) return b;
  }
  return null;
}

// ---- Polisi ----
export function spawnPDCar(world) {
  const { city, rng, player } = world;
  const p = freeRoadPointMin(city, rng, player.x, player.y, 350, 650);
  const car = makeCar(p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), 'pd', '#1a1a2e');
  car.speed = 300;
  world.pdCars.push(car);
  return car;
}

export function spawnFootCop(world) {
  const { city, rng, player } = world;
  const p = freeRoadPointMin(city, rng, player.x, player.y, 280, 450);
  const cop = makeFootCop(p.x, p.y);
  world.footCops.push(cop);
  return cop;
}

export function updatePDCars(world, dt) {
  const { player } = world;
  for (const car of [...world.pdCars]) {
    car.crashCd = Math.max(0, car.crashCd - dt);
    car.ramCd = Math.max(0, car.ramCd - dt);
    car.shootCd = Math.max(0, car.shootCd - dt);
    const d = dist(car, player);
    // Wanted 0 = polisi menyerah: menjauh lalu despawn.
    if (world.wanted === 0) {
      const away = Math.atan2(car.y - player.y, car.x - player.x);
      let diff = away - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      stepCar(car, 1, Math.max(-1, Math.min(1, diff * 2)), false, dt);
      moveCar(world.city, car, dt);
      if (d > 900) world.pdCars.splice(world.pdCars.indexOf(car), 1);
      continue;
    }
    const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2));
    const throttle = d > 60 ? 1 : 0.4;
    stepCar(car, throttle, steer, false, dt);
    moveCar(world.city, car, dt);
    // Menabrak pemain: damage + dorong mundur, ada cooldown.
    const target = player.onFoot ? player : player.car;
    if (target && Math.hypot(car.x - target.x, car.y - target.y) < 46 && car.ramCd <= 0) {
      car.ramCd = CFG.pdRamCooldown;
      world.damagePlayer(CFG.pdRamDamage, 'ram');
      if (!player.onFoot && player.car) {
        player.car.speed *= -0.3;
        player.car.x += Math.cos(car.angle) * 24;
        player.car.y += Math.sin(car.angle) * 24;
      }
      world.audio?.crash();
    }
    // Menembak dari dekat, akurasi 50%.
    if (d < CFG.pdShootRange && car.shootCd <= 0 && player.hp > 0) {
      car.shootCd = CFG.pdShootCooldown;
      if (Math.random() < CFG.pdShootAccuracy) {
        world.damagePlayer(CFG.pdShootDamage, 'shot');
      }
      world.audio?.sirenBlip();
    }
    if (d > 1600) world.pdCars.splice(world.pdCars.indexOf(car), 1);
  }
}

export function updateFootCops(world, dt) {
  const { player } = world;
  for (const cop of [...world.footCops]) {
    cop.shootCd = Math.max(0, cop.shootCd - dt);
    const d = dist(cop, player);
    const sees = d < 620 && player.hp > 0;
    if (sees) cop.lastSeen = world.time;
    const lostFor = world.time - cop.lastSeen;
    if (world.wanted > 0 && sees) cop.state = 'chase';
    else if (cop.state === 'chase' && lostFor > CFG.copGiveUpTime) cop.state = 'giveup';
    if (cop.state === 'chase') {
      const ang = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = ang;
      const spd = 235;
      tryMove(world.city, cop, cop.x + Math.cos(ang) * spd * dt, cop.y + Math.sin(ang) * spd * dt, 10);
      // Membekuk: dekat cukup lama.
      if (d < CFG.footCopBustRange) {
        cop.bustT += dt;
        if (cop.bustT >= CFG.footCopBustTime) {
          world.bustPlayer();
          cop.bustT = 0;
        }
      } else {
        cop.bustT = 0;
      }
      // Pukul pemain dari dekat.
      if (d < 42 && cop.shootCd <= 0) {
        cop.shootCd = CFG.footCopCooldown;
        world.damagePlayer(CFG.footCopDamage, 'hit');
      }
    } else if (cop.state === 'patrol') {
      cop.dirT -= dt;
      if (cop.dirT <= 0) {
        cop.dir = Math.random() * Math.PI * 2;
        cop.dirT = 1 + Math.random() * 3;
      }
      tryMove(world.city, cop, cop.x + Math.cos(cop.dir) * 60 * dt, cop.y + Math.sin(cop.dir) * 60 * dt, 10);
    } else {
      // giveup: berjalan menjauh lalu despawn.
      const ang = Math.atan2(cop.y - player.y, cop.x - player.x);
      tryMove(world.city, cop, cop.x + Math.cos(ang) * 120 * dt, cop.y + Math.sin(ang) * 120 * dt, 10);
      if (d > 900) world.footCops.splice(world.footCops.indexOf(cop), 1);
    }
  }
}
