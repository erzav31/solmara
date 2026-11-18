// The simulation: player, cars, pedestrians, police, wanted level, bullets,
// particles, missions and saving. Pure logic — no canvas, no DOM — so the
// headless test can drive it. The browser only feeds it input and draws it.
import { WORLD, ROAD, PLAYER, CAR, WANTED, COP, MISSIONS, LANDMARK_POINTS } from './config.js';
import { Rng, clamp, dist, angleTo, angleDiff } from './random.js';
import { generateCity, collideBuildings, collideWorldBounds, blockWater, nearestRoadPoint } from './city.js';
import { makeCar, makePed, makeCop, stepTrafficCar, stepPed, stepCopFoot, stepCopCar, separateCircles, resetIds } from './entities.js';
import { newMissionState, startMission, updateMission, missionTargetPoint, missionDef } from './missions.js';

function memoryStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

export class World {
  constructor(seed, storage) {
    this.seed = seed || 1;
    this.storage = storage || memoryStorage();
    this.sfx = null;
    this.reset();
  }

  reset() {
    resetIds();
    this.rng = new Rng(this.seed);
    this.city = generateCity(this.seed);
    this.time = 0;
    this.screen = 'title'; // title | play | busted | wasted | win
    this.events = [];
    this.cash = 150;
    this.best = 150;
    this.saveT = 0;
    this.missionRetryT = 0;
    this.spawnT = 0;
    this.lastSeenT = -99;
    this.heat = 0;
    this.wantedStars = 0;
    this.bullets = [];
    this.particles = [];
    this.cops = [];
    this.traffic = [];
    this.peds = [];
    this.markedCar = null;
    this.mission = newMissionState();
    this.loadSave();

    const start = this.city.landmarks.start;
    this.player = {
      x: start.x, y: start.y,
      angle: -Math.PI / 2,
      speed: 0,
      hp: PLAYER.hp,
      radius: PLAYER.radius,
      onFoot: true,
      car: null,
      ammo: PLAYER.ammoMax,
      reloadT: 0,
      shootCd: 0,
      punchCd: 0,
      crashCd: 0,
      dead: false,
    };

    // Parked cars from the city plan, plus traffic and pedestrians.
    for (const spot of this.city.parkedSpots) {
      this.traffic.push(makeCar('parked', spot.x, spot.y, spot.angle, this.rng));
    }
    // The marked car for mission 2 sits by the bank, gold paint. Clear any
    // parked car right next to it so E always grabs the marked one.
    const marked = this.city.landmarks.marked;
    this.markedCar = makeCar('sport', marked.x + 40, marked.y, 0, this.rng);
    this.markedCar.color = '#f2c14e';
    this.markedCar.parked = true;
    this.traffic = this.traffic.filter((c) => Math.hypot(c.x - this.markedCar.x, c.y - this.markedCar.y) > 80);
    this.traffic.push(this.markedCar);
    for (let i = 0; i < 10; i += 1) {
      const p = this.randomRoadPoint();
      const car = makeCar(this.rng.chance(0.25) ? 'sport' : 'sedan', p.x, p.y, 0, this.rng);
      car.dir = this.rng.int(0, 3);
      car.speed = 130;
      car.parked = false;
      this.traffic.push(car);
    }
    for (let i = 0; i < 26; i += 1) {
      const p = this.randomRoadPoint();
      this.peds.push(makePed(p.x + this.rng.range(-30, 30), p.y + this.rng.range(-30, 30), this.rng));
    }
    startMission(this.mission, 0);
  }

  randomRoadPoint() {
    if (this.rng.chance(0.5)) {
      const ax = this.rng.pick(ROAD.avenues.slice(0, -1));
      return { x: ax, y: this.rng.range(150, WORLD.height - 150) };
    }
    return { x: this.rng.range(150, ROAD.beachX - 150), y: this.rng.pick(ROAD.streets) };
  }

  // --- Saving ---
  loadSave() {
    try {
      const raw = this.storage.getItem('solmara-save-v1');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.cash === 'number') this.cash = s.cash;
      if (typeof s.best === 'number') this.best = s.best;
      if (Array.isArray(s.done)) {
        for (const i of s.done) if (!this.mission.done.includes(i)) this.mission.done.push(i);
      }
    } catch (e) { /* corrupt save: start fresh */ }
  }

  save() {
    try {
      this.storage.setItem('solmara-save-v1', JSON.stringify({
        cash: this.cash, best: this.best, done: this.mission.done,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  // --- Helpers ---
  toast(text) {
    this.events.push({ type: 'toast', text });
    this.latestToast = { text, at: this.time };
  }

  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.lastSeenT = this.time;
    if (amount > 0) this.events.push({ type: 'crime', reason, heat: this.heat });
  }

  nearestCop(maxD) {
    let best = null;
    let bestD = maxD || Infinity;
    for (const c of this.cops) {
      const d = dist(c.x, c.y, this.player.x, this.player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  spawnParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.angle();
      const s = this.rng.range(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: this.rng.range(0.3, 0.8), maxLife: 0.8,
        color, size: this.rng.range(2, 5),
      });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  }

  // --- Player actions ---
  tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = 52;
    for (const car of this.traffic) {
      if (car.dead || car.hp <= 0) continue;
      if (!car.parked && car.speed > 40) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return false;
    if (best.driver && best.kind !== 'parked') {
      // The driver flees on foot.
      const driver = makePed(best.x, best.y, this.rng);
      driver.state = 'flee';
      driver.fleeT = 3;
      this.peds.push(driver);
      best.driver = false;
    }
    const witnessed = this.nearestCop(WANTED.witnessRange);
    if (witnessed) {
      this.addHeat(WANTED.stealHeat, 'car-theft');
      this.toast('STOLEN IN FRONT OF THE POLICE — WANTED!');
    } else if (best === this.markedCar) {
      this.toast('Marked car taken. Lose them!');
    }
    best.parked = false;
    best.speed = 0;
    p.car = best;
    p.onFoot = false;
    p.angle = best.angle;
    if (this.sfx) this.sfx.pickup();
    return true;
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    car.parked = true;
    car.speed = 0;
    p.x = car.x - Math.sin(car.angle) * 34;
    p.y = car.y + Math.cos(car.angle) * 34;
    p.onFoot = true;
    p.car = null;
    p.speed = 0;
  }

  shootAt(wx, wy) {
    const p = this.player;
    if (p.reloadT > 0 || p.shootCd > 0) return;
    if (p.ammo <= 0) {
      p.reloadT = PLAYER.reloadSeconds;
      return;
    }
    p.ammo -= 1;
    p.shootCd = PLAYER.shootCooldown;
    const a = angleTo(p.x, p.y, wx, wy);
    p.angle = a;
    this.bullets.push({
      x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: PLAYER.bulletRange / PLAYER.bulletSpeed, from: 'player',
    });
    if (this.sfx) this.sfx.shot();
    if (this.nearestCop(600)) this.addHeat(WANTED.shootSeenHeat, 'gunfire');
  }

  punch() {
    const p = this.player;
    if (p.punchCd > 0 || !p.onFoot) return;
    p.punchCd = PLAYER.punchCooldown;
    const range = PLAYER.punchRange;
    let hit = false;
    const hurt = (t) => {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > range) return;
      t.hp -= PLAYER.punchDamage;
      hit = true;
      this.spawnParticles(t.x, t.y, 6, '#ffd94a', 120);
      if (t.hp <= 0) t.dead = true;
    };
    for (const ped of this.peds) hurt(ped);
    for (const cop of this.cops) {
      if (cop.kind !== 'foot') continue;
      const before = cop.hp;
      hurt(cop);
      if (hit && cop.hp < before) this.addHeat(15, 'assault-cop');
    }
    if (hit && this.sfx) this.sfx.punch();
  }

  // --- Wanted / police ---
  updateWanted(dt) {
    const stars = this.heat <= 0 ? 0 : Math.min(WANTED.maxStars, 1 + Math.floor(this.heat / WANTED.heatPerStar));
    this.wantedStars = stars;
    const seen = this.nearestCop(COP.copViewRange);
    if (seen) this.lastSeenT = this.time;
    if (this.time - this.lastSeenT > WANTED.unseenSeconds && this.heat > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSecond * dt);
    }
    // Spawn to match the heat — but only while the trail is hot. Once the
    // player has been unseen for a while, no reinforcements arrive, the
    // cops on the scene give up, and the heat can decay.
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.2;
      const wantFoot = Math.min(stars * 2, 6);
      const wantCar = stars >= 2 ? Math.min(stars - 1, 4) : 0;
      const foot = this.cops.filter((c) => c.kind === 'foot').length;
      const cars = this.cops.filter((c) => c.kind === 'car').length;
      const trailHot = this.time - this.lastSeenT < 10;
      if (stars > 0 && trailHot && (foot < wantFoot || cars < wantCar)) {
        const p = this.spawnPointNearPlayer();
        if (foot < wantFoot) this.cops.push(makeCop('foot', p.x, p.y));
        else this.cops.push(makeCop('car', p.x, p.y));
        if (this.cops.length > COP.maxCops) this.cops.splice(0, this.cops.length - COP.maxCops);
      }
    }
    // Cops that lost the trail give up and leave, whatever the heat.
    this.cops = this.cops.filter((c) => c.loseT < COP.giveUpSeconds);
  }

  spawnPointNearPlayer() {
    for (let tries = 0; tries < 12; tries += 1) {
      const a = this.rng.angle();
      const d = this.rng.range(COP.spawnRangeMin, COP.spawnRangeMax);
      const x = clamp(this.player.x + Math.cos(a) * d, 60, ROAD.beachX - 60);
      const y = clamp(this.player.y + Math.sin(a) * d, 60, WORLD.height - 60);
      const s = nearestRoadPoint(x, y);
      if (dist(s.x, s.y, this.player.x, this.player.y) > 420) return s;
    }
    return nearestRoadPoint(this.player.x + 600, this.player.y);
  }

  busted() {
    const fine = Math.min(200, Math.floor(this.cash * 0.1));
    this.cash = Math.max(0, this.cash - fine);
    this.best = Math.max(this.best, this.cash);
    this.player.hp = PLAYER.hp;
    if (this.player.car) {
      this.player.car.parked = true;
      this.player.car.speed = 0;
    }
    this.player.onFoot = true;
    this.player.car = null;
    const hq = this.city.landmarks.police;
    this.player.x = hq.x;
    this.player.y = hq.y + 60;
    this.heat = 0;
    this.wantedStars = 0;
    this.cops = [];
    this.screen = 'busted';
    this.events.push({ type: 'busted', fine });
    if (this.sfx) this.sfx.busted();
    this.save();
  }

  wasted() {
    const lost = Math.min(150, this.cash);
    this.cash = Math.max(0, this.cash - lost);
    this.player.hp = PLAYER.hp;
    if (this.player.car) {
      this.player.car.parked = true;
      this.player.car.speed = 0;
    }
    this.player.onFoot = true;
    this.player.car = null;
    const hosp = this.city.landmarks.hospital;
    this.player.x = hosp.x;
    this.player.y = hosp.y + 60;
    this.heat = 0;
    this.wantedStars = 0;
    this.cops = [];
    this.screen = 'wasted';
    this.events.push({ type: 'wasted', lost });
    if (this.sfx) this.sfx.wasted();
    this.save();
  }

  // --- Main step ---
  step(dt, input) {
    this.events = [];
    if (this.screen !== 'play') {
      this.time += dt;
      return this.events;
    }
    this.time += dt;
    const p = this.player;
    p.shootCd -= dt;
    p.punchCd -= dt;
    p.crashCd -= dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) p.ammo = PLAYER.ammoMax;
    }

    if (input.pressedInteract) {
      if (p.onFoot) this.tryEnterCar();
      else this.exitCar();
    }
    if (input.pressedReload && p.ammo < PLAYER.ammoMax && p.reloadT <= 0) {
      p.reloadT = PLAYER.reloadSeconds;
    }
    if ((input.pressedShoot || input.mouseDown) && p.shootCd <= 0) {
      const mx = input.mouseWorldX !== undefined ? input.mouseWorldX : input.mouseX;
      const my = input.mouseWorldY !== undefined ? input.mouseWorldY : input.mouseY;
      this.shootAt(mx, my);
    }
    if (input.pressedPunch) this.punch();

    // --- Player movement ---
    if (p.onFoot) {
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(mx, my);
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (len > 0) {
        mx /= len; my /= len;
        p.x += mx * speed * dt;
        p.y += my * speed * dt;
        p.angle = Math.atan2(my, mx);
        p.speed = speed;
      } else {
        p.speed = 0;
      }
      collideBuildings(this.city, p);
      collideWorldBounds(p, 16);
      blockWater(p, false);
    } else if (p.car) {
      const car = p.car;
      const max = car.kind === 'sport' ? CAR.sportMax : CAR.maxSpeed;
      if (input.up) car.speed += CAR.accel * dt;
      if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 160 * dt;
      if (Math.abs(car.speed) < 8 && !input.up && !input.down) car.speed = 0;
      car.speed = clamp(car.speed, -CAR.reverseMax, max);
      const steer = ((input.right ? 1 : 0) - (input.left ? 1 : 0));
      const grip = input.handbrake ? 0.55 : 1;
      const turn = CAR.turnRate * (input.handbrake ? 1.4 : 1) * clamp(Math.abs(car.speed) / 140, 0, 1);
      car.angle += steer * turn * Math.sign(car.speed) * dt;
      const slide = input.handbrake ? 0.35 : 0;
      const vx = Math.cos(car.angle) * car.speed;
      const vy = Math.sin(car.angle) * car.speed;
      car.x += vx * dt + (slide ? -Math.sin(car.angle) * car.speed * slide * dt * 0.4 : 0);
      car.y += vy * dt + (slide ? Math.cos(car.angle) * car.speed * slide * dt * 0.4 : 0);
      if (input.handbrake && Math.abs(car.speed) > 200 && this.rng.chance(0.5)) {
        this.spawnParticles(car.x, car.y, 1, '#9a9a9a', 40);
      }
      const hitBuilding = collideBuildings(this.city, car);
      if (hitBuilding && Math.abs(car.speed) > 160 && car.crashCd <= 0) {
        car.hp -= 5;
        car.crashCd = CAR.crashCooldown;
        car.speed *= 0.4;
        this.spawnParticles(car.x, car.y, 8, '#ffb347', 160);
        if (this.sfx) this.sfx.crash();
      }
      collideWorldBounds(car, 20);
      blockWater(car, true);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = Math.abs(car.speed);
      void grip;
      if (car.hp <= 0) {
        this.spawnParticles(car.x, car.y, 26, '#ff7b2e', 320);
        if (this.sfx) this.sfx.crash();
        car.dead = true;
        p.hp -= 20;
        p.onFoot = true;
        p.car = null;
        if (p.hp <= 0) { this.wasted(); return this.events; }
      }
    }

    // --- Traffic, pedestrians, police ---
    const blockers = p.onFoot ? [{ x: p.x, y: p.y, parked: false, dead: false }] : [];
    for (const car of this.traffic) {
      if (car.dead || car === p.car) continue;
      stepTrafficCar(car, dt, this.rng, [...this.traffic, ...blockers]);
    }
    const threat = this.bullets.length > 0 ? { x: p.x, y: p.y } : null;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      stepPed(ped, dt, this.rng, threat);
    }
    for (const cop of this.cops) {
      if (cop.dead) continue;
      if (cop.kind === 'foot') {
        const r = stepCopFoot(cop, p, dt);
        if (r === 'bust') { this.busted(); return this.events; }
      } else {
        stepCopCar(cop, p, dt, this.city);
        cop.shootCd -= dt;
        const d = dist(cop.x, cop.y, p.x, p.y);
        // Patrol cars shoot back, but only at close range and with poor aim —
        // a getaway has to stay possible.
        if (this.wantedStars >= 3 && d < 320 && cop.shootCd <= 0) {
          cop.shootCd = 1.6;
          if (this.rng.chance(0.5)) {
            p.hp -= 4;
            this.spawnParticles(p.x, p.y, 4, '#ffe08a', 120);
            if (p.hp <= 0) { this.wasted(); return this.events; }
          } else {
            this.spawnParticles(p.x + this.rng.range(-30, 30), p.y + this.rng.range(-30, 30), 3, '#ffe08a', 100);
          }
        }
        // Ram the player.
        if (d < p.radius + cop.radius + 4 && cop.ramCd <= 0) {
          cop.ramCd = COP.pdRamCooldown;
          if (p.car) {
            p.car.hp -= COP.pdRamDamage;
            p.car.speed *= 0.6;
          } else {
            p.hp -= 10;
            const a = angleTo(cop.x, cop.y, p.x, p.y);
            p.x += Math.cos(a) * 26;
            p.y += Math.sin(a) * 26;
            if (p.hp <= 0) { this.wasted(); return this.events; }
          }
          this.spawnParticles((cop.x + p.x) / 2, (cop.y + p.y) / 2, 8, '#ffb347', 160);
          if (this.sfx) this.sfx.crash();
        }
      }
    }

    // --- Collisions: player car vs traffic, player vs peds ---
    if (p.car) {
      for (const car of this.traffic) {
        if (car === p.car || car.dead) continue;
        const d = dist(p.car.x, p.car.y, car.x, car.y);
        if (d < p.car.radius + car.radius) {
          separateCircles(p.car, car, 0);
          if (Math.abs(p.car.speed) > 120 && p.car.crashCd <= 0) {
            p.car.hp -= 6;
            car.hp -= 6;
            p.car.crashCd = CAR.crashCooldown;
            this.spawnParticles(p.car.x, p.car.y, 8, '#ffb347', 160);
            if (this.sfx) this.sfx.crash();
          }
          if (car.hp <= 0) car.dead = true;
        }
      }
      // Running over pedestrians.
      for (const ped of this.peds) {
        if (ped.dead) continue;
        const d = dist(p.car.x, p.car.y, ped.x, ped.y);
        if (d < p.car.radius + ped.radius && Math.abs(p.car.speed) > 90) {
          ped.hp = 0;
          ped.dead = true;
          ped.state = 'down';
          const seen = this.nearestCop(WANTED.witnessRange);
          this.addHeat(seen ? WANTED.hitPedHeat : 8, 'hit-pedestrian');
          this.toast('You ran over a pedestrian!');
        }
      }
    } else {
      for (const ped of this.peds) {
        if (!ped.dead) separateCircles(p, ped, 0);
      }
    }

    // --- Bullets ---
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      let dead = false;
      // Buildings stop bullets.
      const probe = { x: b.x, y: b.y, radius: 2 };
      if (collideBuildings(this.city, probe)) dead = true;
      const hitList = [...this.peds, ...this.cops];
      for (const t of hitList) {
        if (t.dead) continue;
        if (dist(b.x, b.y, t.x, t.y) < t.radius + 4) {
          t.hp -= PLAYER.bulletDamage;
          this.spawnParticles(b.x, b.y, 5, '#ff5a4e', 140);
          if (t.hp <= 0) {
            t.dead = true;
            if (t.state !== undefined) t.state = 'down';
            const seen = this.nearestCop(WANTED.witnessRange);
            if (t.kind === 'foot' || t.kind === 'car') {
              this.addHeat(WANTED.killCopHeat, 'killed-cop');
              this.toast('You killed a cop. The whole city is coming.');
            } else {
              this.addHeat(seen ? WANTED.hitPedHeat : 8, 'killed-pedestrian');
            }
          }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of this.traffic) {
          if (car === p.car || car.dead) continue;
          if (dist(b.x, b.y, car.x, car.y) < car.radius + 4) {
            car.hp -= PLAYER.bulletDamage;
            this.spawnParticles(b.x, b.y, 5, '#ffb347', 140);
            if (car.hp <= 0) {
              car.dead = true;
              if (car.driver) {
                const driver = makePed(car.x, car.y, this.rng);
                driver.state = 'flee';
                driver.fleeT = 3;
                this.peds.push(driver);
                car.driver = false;
              }
            }
            dead = true;
            break;
          }
        }
      }
      if (dead) b.life = 0;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    // --- Particles ---
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    // --- Wanted, missions, save ---
    this.updateWanted(dt);
    const inMarkedCar = p.car === this.markedCar;
    const ev = updateMission(this.mission, {
      player: p, city: this.city, inMarkedCar, playerHp: p.hp,
    }, dt);
    if (ev === 'done') {
      const def = missionDef(this.mission.done[this.mission.done.length - 1]);
      if (def) {
        this.cash += def.reward;
        this.best = Math.max(this.best, this.cash);
        this.events.push({ type: 'mission-done', name: def.name, reward: def.reward });
        this.toast(`${def.name} complete — +$${def.reward}`);
        if (this.sfx) this.sfx.missionDone();
        if (this.mission.allDone) {
          this.screen = 'win';
          this.events.push({ type: 'win' });
        } else {
          this.missionRetryT = 2.5;
        }
        this.save();
      }
    } else if (ev === 'failed') {
      this.toast('Job failed — Jax will call again.');
      this.missionRetryT = 3;
    } else if (ev === 'stage') {
      this.toast('Objective updated.');
    }
    // Mission 2: force heat while surviving; mission 3: while escaping.
    // Raising the heat also refreshes the trail so reinforcements keep coming.
    const stage = this.mission.active ? this.mission : null;
    if (stage) {
      const def = missionDef(stage.index);
      if (def && def.name === 'Getaway Driver' && stage.stage === 1 && this.heat < 45) {
        this.heat = 45;
        this.lastSeenT = this.time;
      }
      if (def && def.name === 'The Gold Vela' && stage.stage === 2 && this.heat < 55) {
        this.heat = 55;
        this.lastSeenT = this.time;
      }
    }
    if (!this.mission.active && !this.mission.allDone && this.mission.index < MISSIONS.length) {
      this.missionRetryT -= dt;
      if (this.missionRetryT <= 0) {
        startMission(this.mission, this.mission.index);
        const def = missionDef(this.mission.index);
        if (def) this.toast(`New job: ${def.name} — ${def.briefing}`);
      }
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 10;
      this.save();
    }
    return this.events;
  }

  missionTarget() {
    return missionTargetPoint(this.mission, this.city);
  }

  engine01() {
    if (!this.player.car) return 0;
    const max = this.player.car.kind === 'sport' ? CAR.sportMax : CAR.maxSpeed;
    return clamp(Math.abs(this.player.car.speed) / max, 0, 1);
  }
}
