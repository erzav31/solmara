// Scene deterministik untuk screenshots (?shot=start|play|chase|end&seed=1).
// Setiap scene: set state dunia, jalankan sejumlah frame tetap, lalu render.
import { stepWorld } from './world.js';
import { Input } from './input.js';
import { makeCar } from './entities.js';

function putPlayerInCar(world, x, y, angle, speed) {
  const car = makeCar(x, y, angle, 'player', '#c0392b');
  car.speed = speed;
  const p = world.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = speed;
  return car;
}

function driveFrames(world, frames) {
  const input = new Input();
  input.setKey('KeyW', true);
  for (let i = 0; i < frames; i++) stepWorld(world, input, 1 / 60);
  input.endFrame();
}

export function setupShot(world, name) {
  const p = world.player;
  if (name === 'start') {
    world.state = 'title';
    world.time = 1;
    return;
  }
  if (name === 'play') {
    world.state = 'play';
    // Misi 3 Getaway Driver sedang jalan, wanted 3, ngebut di jalan.
    world.missions.index = 2;
    world.missions.active = true;
    world.missions._buildStages();
    world.missions.stageIdx = 1;
    world.missions.message = 'Kabur dari polisi — bertahan!';
    world.alertWanted(3);
    putPlayerInCar(world, 1500, 1100, 0, 480);
    driveFrames(world, 90);
    return;
  }
  if (name === 'chase') {
    world.state = 'play';
    world.alertWanted(5);
    putPlayerInCar(world, 1500, 1100, 0, 380);
    // Dua mobil PD + satu polisi jalan kaki mengejar dari dekat.
    const pd1 = makeCar(1380, 1100, 0, 'pd', '#1a1a2e');
    pd1.speed = 420;
    const pd2 = makeCar(1500, 980, Math.PI / 2, 'pd', '#1a1a2e');
    pd2.speed = 400;
    world.pdCars.push(pd1, pd2);
    const cop = { x: 1620, y: 1160, angle: 0, speed: 0, state: 'chase', hp: 100, lastSeen: world.time, bustT: 0, shootCd: 0, dir: 0, dirT: 0 };
    world.footCops.push(cop);
    driveFrames(world, 60);
    return;
  }
  if (name === 'end') {
    world.state = 'busted';
    world.bannerData = { title: 'BUSTED', sub: 'Denda $200 — dibebaskan di Rosa Garage', t: 99 };
    world.player.hp = 12;
    world.setWanted(0);
    return;
  }
  world.state = 'title';
}
