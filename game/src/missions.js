// 5 misi Harbor Crew (kontak: Jax Marlowe). Setiap misi = urutan stage:
// goto (capai titik), steal (curi mobil bertanda), survive (bertahan),
// timed (drop berwaktu). Selesai semua = KING OF SOLMARA.
import { CFG } from './config.js';

export const MISSION_NAMES = [
  'First Fare',
  'Harbor Package',
  'Getaway Driver',
  'The Gold Vela',
  'The Big Score',
];

function stage(type, x, y, label, time = 0) {
  return { type, x, y, label, time, t: time };
}

export class MissionRunner {
  constructor(world) {
    this.world = world;
    this.index = 0; // misi aktif 0..4; 5 = semua selesai
    this.stageIdx = 0;
    this.stages = [];
    this.active = false;
    this.message = '';
    this.failed = false;
    this._buildStages();
  }

  _buildStages() {
    const L = this.world.city.landmarks;
    const defs = [
      // 0 — First Fare: jemput penumpang, antar ke Marina Cafe.
      [
        stage('goto', L.farePickup.x, L.farePickup.y, 'Jemput penumpang di Little Vela'),
        stage('goto', L.fareDropoff.x, L.fareDropoff.y, 'Antar ke Marina Cafe'),
      ],
      // 1 — Harbor Package: ambil paket, antar ke drop.
      [
        stage('goto', L.harborOffice.x, L.harborOffice.y, 'Ambil paket di Harbor Office'),
        stage('goto', L.packageDrop.x, L.packageDrop.y, 'Antar paket ke Palm Court'),
      ],
      // 2 — Getaway Driver: curi mobil bertanda, survive 45 dtk, pulang.
      [
        stage('steal', 0, 0, 'Curi mobil bertanda emas'),
        stage('survive', 0, 0, 'Kabur dari polisi — bertahan!', CFG.getawaySurvive),
        stage('goto', L.garage.x, L.garage.y, 'Kembali ke Rosa Garage'),
      ],
      // 3 — The Gold Vela: ke dermaga, ambil emas, kabur.
      [
        stage('goto', L.yachtDock.x, L.yachtDock.y, 'Ke dermaga marina'),
        stage('goto', L.garage.x, L.garage.y, 'Kabur ke Rosa Garage — emas di tangan!'),
      ],
      // 4 — The Big Score: 3 drop berwaktu 60 dtk, lalu pulang.
      [
        stage('timed', L.dropA.x, L.dropA.y, 'Drop 1/3 — Northgate', CFG.bigScoreDropTime),
        stage('timed', L.dropB.x, L.dropB.y, 'Drop 2/3 — The Yards', CFG.bigScoreDropTime),
        stage('timed', L.dropC.x, L.dropC.y, 'Drop 3/3 — East Docks', CFG.bigScoreDropTime),
        stage('goto', L.garage.x, L.garage.y, 'Kembali ke Rosa Garage'),
      ],
    ];
    this.stages = defs[this.index] || [];
    this.stageIdx = 0;
    this.failed = false;
  }

  get name() {
    return MISSION_NAMES[this.index] || 'Selesai';
  }

  get reward() {
    return CFG.missionRewards[this.index] || 0;
  }

  get current() {
    return this.stages[this.stageIdx] || null;
  }

  start() {
    this.active = true;
    this._buildStages();
    const s = this.current;
    if (s) this.message = s.label;
    this.world.toast(`Misi ${this.index + 1}: ${this.name} — $${this.reward}`);
    if (this.index === 2) this.world.ensureMarkedCar();
    if (this.index === 3) this.world.setWanted(0);
  }

  fail() {
    this.failed = true;
    this.active = false;
    this.world.toast('Misi gagal — coba lagi dari Jax');
    this.world.showBanner('MISI GAGAL', 'Datang lagi ke Rosa Garage');
  }

  _advance() {
    this.stageIdx++;
    const s = this.current;
    if (!s) {
      this._complete();
      return;
    }
    this.message = s.label;
    this.world.toast(s.label);
    // Efek samping masuk stage tertentu.
    if (this.index === 2 && s.type === 'survive') {
      this.world.alertWanted(2);
      this.world.toast('Polisi mengejarmu! Bertahan 45 detik!');
    }
    if (this.index === 3 && this.stageIdx === 1) {
      this.world.alertWanted(3);
      this.world.toast('Emas The Gold Vela di tangan! Kabur!');
      this.world.audio?.pickup();
    }
  }

  _complete() {
    const reward = this.reward;
    this.world.player.cash += reward;
    this.world.audio?.missionDone();
    this.world.showBanner('MISI SELESAI', `${this.name}  +$${reward}`);
    this.world.completed[this.index] = true;
    this.world.save();
    this.index++;
    this.active = false;
    if (this.index >= 5) {
      this.world.win = true;
      this.world.showBanner('KING OF SOLMARA', 'Semua misi Harbor Crew selesai!');
      return;
    }
    // Misi berikut langsung siap di garage.
    this._buildStages();
  }

  update(dt) {
    if (!this.active || this.world.win) return;
    const w = this.world;
    const p = w.player;
    const s = this.current;
    if (!s) return;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    switch (s.type) {
      case 'goto': {
        if (d < 60) this._advance();
        break;
      }
      case 'steal': {
        // Target = mobil bertanda; stage selesai saat pemain di dalamnya.
        const car = w.markedCar;
        if (car) {
          s.x = car.x;
          s.y = car.y;
          if (!p.onFoot && p.car === car) this._advance();
        }
        break;
      }
      case 'survive': {
        s.t -= dt;
        this.message = `Bertahan! ${Math.max(0, Math.ceil(s.t))} dtk`;
        if (s.t <= 0) this._advance();
        break;
      }
      case 'timed': {
        s.t -= dt;
        this.message = `${s.label} — ${Math.max(0, Math.ceil(s.t))} dtk`;
        if (d < 60) {
          w.audio?.pickup();
          this._advance();
        } else if (s.t <= 0) {
          this.fail();
        }
        break;
      }
      default:
        break;
    }
  }

  objectiveText() {
    if (this.index >= 5) return 'Semua misi selesai — KING OF SOLMARA';
    if (!this.active) return `Misi ${this.index + 1}: ${this.name} — mulai di Rosa Garage`;
    return this.message;
  }

  targetPos() {
    const s = this.current;
    if (!s || !this.active) return null;
    return { x: s.x, y: s.y };
  }
}
