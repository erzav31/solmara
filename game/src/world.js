// Simulasi dunia: pemain, wanted, polisi, misi, save/load.
// Tanpa dependensi DOM — bisa dijalankan headless di Node untuk logic test.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import {
  generateCity, isBlocked, districtAt, snapToRoad, freeRoadPoint,
} from './city.js';
import {
  makeCar, makePed, dist, tryMove, stepCar, moveCar,
  spawnParkedCars, spawnTrafficCar, updateTraffic, updatePedestrians,
  spawnPDCar, spawnFootCop, updatePDCars, updateFootCops,
} from './entities.js';
import { MissionRunner } from './missions.js';
import { AudioEngine } from './audio.js';

const SAVE_KEY = 'solmara-save-v1';

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* abaikan */ }
  return null;
}

export function createWorld(seed = 1, opts = {}) {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const store = storage();
  let saved = null;
  if (opts.loadSave !== false && store) {
    try {
      saved = JSON.parse(store.getItem(SAVE_KEY) || 'null');
    } catch { saved = null; }
  }

  const world = {
    seed,
    rng,
    city,
    time: 0,
    state: 'title', // title | play | pause | busted | wasted | win
    player: {
      x: city.landmarks.garage.x,
      y: city.landmarks.garage.y,
      angle: -Math.PI / 2,
      speed: 0,
      hp: CFG.playerHp,
      cash: saved?.cash ?? 0,
      best: saved?.best ?? 0,
      onFoot: true,
      car: null,
      ammo: CFG.magSize,
      reloading: false,
      reloadT: 0,
      shootCd: 0,
      punchCd: 0,
      crashCd: 0,
      trafficHitCd: 0,
    },
    cars: [],
    peds: [],
    pdCars: [],
    footCops: [],
    bullets: [],
    particles: [],
    wanted: 0,
    heat: 0,
    lastSeenAt: -99,
    coldT: 0,
    markedCar: null,
    completed: saved?.completed ?? [false, false, false, false, false],
    missionIndex: saved?.missionIndex ?? 0,
    win: false,
    cam: { x: city.landmarks.garage.x, y: city.landmarks.garage.y },
    mouseWorld: { x: 0, y: 0 },
    toasts: [],
    bannerData: null,
    audio: new AudioEngine(),
    _store: store,

    toast(text) {
      this.toasts.push({ text, t: 3.2 });
      if (this.toasts.length > 4) this.toasts.shift();
    },
    showBanner(title, sub) {
      this.bannerData = { title, sub: sub || '', t: 3.5 };
    },
    district() {
      return districtAt(this.city, this.player.x, this.player.y);
    },
    save() {
      if (!this._store) return;
      try {
        this._store.setItem(SAVE_KEY, JSON.stringify({
          cash: this.player.cash,
          best: Math.max(this.player.best, this.player.cash),
          completed: this.completed,
          missionIndex: this.missions.index,
        }));
      } catch { /* abaikan */ }
    },
    setWanted(n) {
      // Murni set angka — tanpa memanaskan trail (dipakai decay & respawn).
      this.wanted = Math.max(0, Math.min(CFG.maxWanted, n));
      if (this.wanted === 0) this.heat = 0;
    },
    // Polisi resmi siaga: wanted naik + trail panas (dipakai kejahatan & misi).
    alertWanted(n) {
      this.setWanted(n);
      if (this.wanted > 0) {
        this.heat = 10;
        this.lastSeenAt = this.time;
        this.coldT = 0;
      }
    },
    addCrime(level = 1) {
      if (this.wanted >= CFG.maxWanted) return;
      this.alertWanted(this.wanted + level);
      this.toast(`Wanted naik — ${'★'.repeat(this.wanted)}`);
    },
    damagePlayer(amount, kind) {
      if (this.state !== 'play' || this.player.hp <= 0) return;
      this.player.hp -= amount;
      if (this.player.hp <= 0) {
        this.player.hp = 0;
        this.state = 'wasted';
        this.audio.busted();
        this.showBanner('WASTED', 'Jax akan menunggumu di Rosa Garage');
      }
    },
    bustPlayer() {
      if (this.state !== 'play') return;
      const fine = Math.min(this.player.cash, CFG.bustedFine);
      this.player.cash -= fine;
      this.player.hp = CFG.playerHp;
      this.state = 'busted';
      this.audio.busted();
      this.showBanner('BUSTED', `Denda $${fine} — dibebaskan di Rosa Garage`);
      this.respawn();
    },
    respawn() {
      const g = this.city.landmarks.garage;
      this.player.x = g.x;
      this.player.y = g.y;
      this.player.angle = -Math.PI / 2;
      this.player.speed = 0;
      this.player.onFoot = true;
      this.player.car = null;
      this.player.hp = CFG.playerHp;
      this.player.ammo = CFG.magSize;
      this.player.reloading = false;
      this.setWanted(0);
      this.pdCars.length = 0;
      this.footCops.length = 0;
      this.bullets.length = 0;
      this.save();
    },
    ensureMarkedCar() {
      if (this.markedCar && this.cars.includes(this.markedCar)) return this.markedCar;
      // Bersihkan mobil parkir di sekitar titik curi supaya tidak ketumpuk.
      const spot = freeRoadPoint(this.city, this.rng, this.player.x, this.player.y, 260);
      this.cars = this.cars.filter((c) => Math.hypot(c.x - spot.x, c.y - spot.y) > 80 || c.kind !== 'parked');
      const onAvenue = this.city.avenues.some((ax) => Math.abs(spot.x - ax) <= CFG.roadHalf);
      const angle = onAvenue ? Math.PI / 2 : 0;
      const car = makeCar(spot.x, spot.y, angle, 'marked', '#ffd700');
      car.hp = 200;
      this.cars.push(car);
      this.markedCar = car;
      this.toast('Mobil bertanda emas sudah ditandai di minimap');
      return car;
    },
  };

  world_addHelpers(world);
  world.missions = new MissionRunner(world);
  world.missions.index = world.missionIndex;
  world.missions._buildStages();

  // Isi awal dunia.
  spawnParkedCars(world, 26, [city.landmarks.garage]);
  for (let i = 0; i < 8; i++) spawnTrafficCar(world);
  for (let i = 0; i < 12; i++) {
    const p = freeRoadPoint(city, rng, world.player.x, world.player.y, 500);
    world.peds.push(makePed(p.x, p.y));
  }
  return world;
}

// ---------- Aksi pemain ----------

function nearestParkedCar(world, maxD) {
  const p = world.player;
  let best = null;
  let bestD = maxD;
  for (const c of world.cars) {
    if (c.kind !== 'parked' && c.kind !== 'marked') continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function nearestCar(world, maxD) {
  const p = world.player;
  let best = null;
  let bestD = maxD;
  for (const c of world.cars) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function copNearby(world, range) {
  const p = world.player;
  return (
    world.footCops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < range) ||
    world.pdCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < range)
  );
}

function enterCar(world) {
  const p = world.player;
  const car = nearestCar(world, 70);
  if (!car) return;
  const witnessed = copNearby(world, 260);
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  world.cars.splice(world.cars.indexOf(car), 1);
  world.audio.engineStart();
  if (car.kind === 'parked' || car.kind === 'traffic' || car.kind === 'marked') {
    if (witnessed) world.addCrime(1);
    else world.toast(car.kind === 'marked' ? 'Mobil curian — jangan sampai ketahuan!' : 'Mobil diambil');
  }
}

function exitCar(world) {
  const p = world.player;
  if (!p.car) return;
  const car = p.car;
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  if (!isBlocked(world.city, side.x, side.y)) {
    p.x = side.x;
    p.y = side.y;
  } else {
    p.x = car.x + Math.cos(car.angle) * 40;
    p.y = car.y + Math.sin(car.angle) * 40;
  }
  p.angle = car.angle;
  p.speed = 0;
  p.onFoot = true;
  p.car = null;
  car.speed = 0;
  car.kind = car.kind === 'marked' ? 'marked' : 'parked';
  world.cars.push(car);
  world.audio.setEngine(0, false);
}

function shoot(world) {
  const p = world.player;
  if (p.shootCd > 0 || p.reloading || p.ammo <= 0) return;
  p.shootCd = CFG.shootCooldown;
  p.ammo--;
  const tx = world.mouseWorld.x;
  const ty = world.mouseWorld.y;
  const ang = Math.atan2(ty - p.y, tx - p.x);
  p.angle = ang;
  const bx = p.x + Math.cos(ang) * 26;
  const by = p.y + Math.sin(ang) * 26;
  world.bullets.push({
    x: bx, y: by,
    vx: Math.cos(ang) * CFG.bulletSpeed,
    vy: Math.sin(ang) * CFG.bulletSpeed,
    life: 1.1, from: 'player', damage: CFG.bulletDamage,
  });
  world.audio.shot();
  world.addParticles(bx, by, 4, '#ffd76a');
  if (p.ammo === 0) {
    p.reloading = true;
    p.reloadT = CFG.reloadTime;
    world.audio.reload();
  }
  // Tembakan di depan polisi = kejahatan.
  if (copNearby(world, 500)) world.addCrime(1);
}

function punch(world) {
  const p = world.player;
  if (p.punchCd > 0) return;
  p.punchCd = CFG.punchCooldown;
  world.audio.punch();
  const reach = CFG.punchRange;
  const tx = p.x + Math.cos(p.angle) * reach;
  const ty = p.y + Math.sin(p.angle) * reach;
  let hitSomething = false;
  for (const ped of world.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - tx, ped.y - ty) < 34) {
      ped.hp -= CFG.punchDamage;
      hitSomething = true;
      if (ped.hp <= 0) {
        ped.state = 'down';
        world.addCrime(1);
        world.toast('Pejalan kaki tumbang — polisi dipanggil!');
      }
      world.addParticles(ped.x, ped.y, 5, '#ff6b6b');
    }
  }
  for (const cop of world.footCops) {
    if (Math.hypot(cop.x - tx, cop.y - ty) < 34) {
      cop.hp -= CFG.punchDamage;
      hitSomething = true;
      world.addCrime(1);
      world.addParticles(cop.x, cop.y, 5, '#74b9ff');
      if (cop.hp <= 0) world.footCops.splice(world.footCops.indexOf(cop), 1);
    }
  }
  if (!hitSomething) world.addParticles(tx, ty, 2, '#dfe6e9');
}

function world_addHelpers(world) {
  world.addParticles = function (x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 140;
      world.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3,
        color,
      });
    }
    if (world.particles.length > 300) world.particles.splice(0, world.particles.length - 300);
  };
}

// ---------- Step utama ----------

export function stepWorld(world, input, dt) {
  const p = world.player;
  if (world.state !== 'play') return;
  world.time += dt;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.crashCd = Math.max(0, p.crashCd - dt);
  p.trafficHitCd = Math.max(0, p.trafficHitCd - dt);
  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloading = false;
      p.ammo = CFG.magSize;
    }
  }

  const ax = input.axis();
  if (p.onFoot) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const spd = run ? CFG.runSpeed : CFG.walkSpeed;
    let mx = ax.x;
    let my = ax.y;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      tryMove(world.city, p, p.x + mx * spd * dt, p.y + my * spd * dt, 12);
    }
    if (input.hit('KeyE')) {
      // Di dekat Rosa Garage dan belum ada misi aktif: E memulai misi.
      const g = world.city.landmarks.garage;
      const nearGarage = Math.hypot(p.x - g.x, p.y - g.y) < 90;
      if (!world.missions.active && world.missions.index < 5 && nearGarage && !nearestParkedCar(world, 70)) {
        world.missions.start();
      } else {
        enterCar(world);
      }
    }
    if (input.hit('KeyF') || input.mouseClicked) shoot(world);
    if (input.hit('Space')) punch(world);
    if (input.hit('KeyR') && p.ammo < CFG.magSize && !p.reloading) {
      p.reloading = true;
      p.reloadT = CFG.reloadTime;
      world.audio.reload();
    }
  } else if (p.car) {
    const car = p.car;
    const handbrake = input.down('Space');
    const throttle = ax.y < 0 ? 1 : ax.y > 0 ? -1 : 0;
    const steer = ax.x;
    stepCar(car, throttle, steer, handbrake, dt);
    const moved = moveCar(world.city, car, dt);
    if (!moved && Math.abs(car.speed) > 200 && p.crashCd <= 0) {
      p.crashCd = CFG.crashCooldown;
      world.damagePlayer(CFG.crashDamage, 'crash');
      world.audio.crash();
      world.addParticles(car.x, car.y, 8, '#ffa502');
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    world.audio.setEngine(Math.abs(car.speed) / CFG.carMax, true);
    if (input.hit('KeyE')) exitCar(world);
    if (input.hit('KeyF') || input.mouseClicked) {
      // Menembak dari jendela mobil: peluru dari posisi pemain.
      shoot(world);
    }
  }

  // Peluru.
  for (const b of [...world.bullets]) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || isBlocked(world.city, b.x, b.y);
    if (!dead) {
      for (const ped of world.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.hp -= b.damage;
          dead = true;
          world.addParticles(b.x, b.y, 5, '#ff6b6b');
          if (ped.hp <= 0) {
            ped.state = 'down';
            world.addCrime(1);
          }
          break;
        }
      }
    }
    if (!dead) {
      for (const cop of [...world.footCops]) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
          cop.hp -= b.damage;
          dead = true;
          world.addParticles(b.x, b.y, 5, '#74b9ff');
          if (cop.hp <= 0) world.footCops.splice(world.footCops.indexOf(cop), 1);
          world.addCrime(1);
          break;
        }
      }
    }
    if (!dead) {
      for (const car of [...world.cars, ...world.pdCars]) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.hp -= b.damage;
          dead = true;
          world.addParticles(b.x, b.y, 4, '#fdcb6e');
          if (car.hp <= 0) {
            world.addParticles(car.x, car.y, 18, '#e17055');
            if (car.kind === 'pd') {
              world.pdCars.splice(world.pdCars.indexOf(car), 1);
              world.addCrime(1);
            } else {
              world.cars.splice(world.cars.indexOf(car), 1);
            }
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(world.bullets.indexOf(b), 1);
  }

  // Mobil pemain menabrak pejalan kaki.
  if (!p.onFoot && p.car && Math.abs(p.car.speed) > 150) {
    for (const ped of world.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 28) {
        ped.state = 'down';
        world.addCrime(1);
        world.addParticles(ped.x, ped.y, 8, '#ff6b6b');
        world.toast('Kamu menabrak pejalan kaki!');
      }
    }
  }
  // Mobil traffic menabrak pemain jalan kaki (cooldown 1 dtk — tanpa ini
  // satu sentuhan = mati instan karena damage tiap frame).
  if (p.onFoot && p.trafficHitCd <= 0) {
    for (const car of world.cars) {
      if (car.kind === 'traffic' && Math.abs(car.speed) > 100 && Math.hypot(car.x - p.x, car.y - p.y) < 30) {
        p.trafficHitCd = 1.0;
        world.damagePlayer(15, 'hit');
        p.x += Math.cos(car.angle) * 30;
        p.y += Math.sin(car.angle) * 30;
        break;
      }
    }
  }

  // Wanted / heat.
  if (world.wanted > 0) {
    const seen = world.footCops.some((c) => dist(c, p) < 620) ||
      world.pdCars.some((c) => dist(c, p) < 620);
    if (seen) {
      world.heat = 10;
      world.lastSeenAt = world.time;
      world.coldT = 0;
    } else {
      world.heat = Math.max(0, world.heat - CFG.heatDecay * dt);
      if (world.heat <= 0) {
        world.coldT += dt;
        if (world.coldT >= CFG.wantedDropTime) {
          world.setWanted(world.wanted - 1);
          world.coldT = 0;
          if (world.wanted > 0) world.toast(`Wanted turun — ${'★'.repeat(world.wanted)}`);
          else world.toast('Polisi kehilangan jejakmu');
        }
      }
    }
    // Reinforcement hanya saat trail panas.
    if (world.heat > 0) {
      const wantPD = Math.min(world.wanted, 3);
      while (world.pdCars.length < wantPD) spawnPDCar(world);
      const wantFoot = Math.min(world.wanted, 5);
      while (world.footCops.length < wantFoot) spawnFootCop(world);
    }
  }

  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  updatePDCars(world, dt);
  updateFootCops(world, dt);
  world.missions.update(dt);

  // Partikel.
  for (const pt of [...world.particles]) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) world.particles.splice(world.particles.indexOf(pt), 1);
  }

  // Toast + banner.
  for (const t of [...world.toasts]) {
    t.t -= dt;
    if (t.t <= 0) world.toasts.splice(world.toasts.indexOf(t), 1);
  }
  if (world.bannerData) {
    world.bannerData.t -= dt;
    if (world.bannerData.t <= 0) world.bannerData = null;
  }

  // Kamera mengikuti pemain.
  const tx = Math.max(CFG.viewW / 2, Math.min(CFG.worldW - CFG.viewW / 2, p.x));
  const ty = Math.max(CFG.viewH / 2, Math.min(CFG.worldH - CFG.viewH / 2, p.y));
  world.cam.x += (tx - world.cam.x) * Math.min(1, dt * 5);
  world.cam.y += (ty - world.cam.y) * Math.min(1, dt * 5);
}
