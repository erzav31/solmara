// Semua gambar di canvas: kota, entitas, HUD, minimap, layar menu.
// Tanpa aset eksternal — warna dan bentuk digambar dari kode.
import { CFG } from './config.js';
import { districtAt, isPark, isBeach, isWater } from './city.js';
import { MISSION_NAMES } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { ctx, canvas };
}

function sx(world, x) {
  return x - world.cam.x + CFG.viewW / 2;
}
function sy(world, y) {
  return y - world.cam.y + CFG.viewH / 2;
}

export function drawWorld(r, world) {
  const { ctx } = r;
  const cam = world.cam;
  const x0 = cam.x - CFG.viewW / 2 - 40;
  const y0 = cam.y - CFG.viewH / 2 - 40;
  const x1 = cam.x + CFG.viewW / 2 + 40;
  const y1 = cam.y + CFG.viewH / 2 + 40;

  // Tanah dasar.
  ctx.fillStyle = '#79a86b';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  // Pantai + laut (timur).
  if (x1 > CFG.beachX) {
    ctx.fillStyle = '#e8d28a';
    ctx.fillRect(sx(world, CFG.beachX), 0, sx(world, CFG.waterX) - sx(world, CFG.beachX), CFG.viewH);
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(sx(world, CFG.waterX), 0, CFG.viewW - sx(world, CFG.waterX), CFG.viewH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
      ctx.beginPath();
      ctx.moveTo(sx(world, CFG.waterX) + 8, sy(world, wy));
      ctx.lineTo(sx(world, CFG.waterX) + 42, sy(world, wy));
      ctx.stroke();
    }
  }
  // Taman.
  const park = world.city.park;
  ctx.fillStyle = '#4e9a51';
  ctx.fillRect(sx(world, park.x), sy(world, park.y), park.w, park.h);
  // Jalan.
  ctx.fillStyle = '#3d3d3d';
  for (const ax of world.city.avenues) {
    if (ax + CFG.roadHalf < x0 || ax - CFG.roadHalf > x1) continue;
    ctx.fillRect(sx(world, ax - CFG.roadHalf), 0, CFG.roadHalf * 2, CFG.viewH);
  }
  for (const syRoad of world.city.streets) {
    if (syRoad + CFG.roadHalf < y0 || syRoad - CFG.roadHalf > y1) continue;
    ctx.fillRect(0, sy(world, syRoad - CFG.roadHalf), CFG.viewW, CFG.roadHalf * 2);
  }
  // Garis tengah jalan.
  ctx.strokeStyle = '#d8d8c8';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ax of world.city.avenues) {
    if (ax < x0 || ax > x1) continue;
    ctx.beginPath();
    ctx.moveTo(sx(world, ax), 0);
    ctx.lineTo(sx(world, ax), CFG.viewH);
    ctx.stroke();
  }
  for (const syRoad of world.city.streets) {
    if (syRoad < y0 || syRoad > y1) continue;
    ctx.beginPath();
    ctx.moveTo(0, sy(world, syRoad));
    ctx.lineTo(CFG.viewW, sy(world, syRoad));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Dermaga marina.
  ctx.fillStyle = '#8a6f4d';
  for (const d of world.city.docks) {
    ctx.fillRect(sx(world, d.x), sy(world, d.y), d.w, d.h);
  }
  // Yacht The Gold Vela.
  const yacht = world.city.landmarks.yacht;
  ctx.save();
  ctx.translate(sx(world, yacht.x), sy(world, yacht.y));
  ctx.fillStyle = '#f5f6fa';
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d63031';
  ctx.fillRect(-8, -26, 16, 22);
  ctx.restore();
  // Gedung.
  for (const b of world.city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(sx(world, b.x), sy(world, b.y), b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx(world, b.x), sy(world, b.y), b.w, 6);
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(sx(world, b.x + 8 + i * 26), sy(world, b.y + 10 + j * 26), 8, 10);
      }
    }
  }
  // Pohon.
  ctx.fillStyle = '#2d7a33';
  for (const t of world.city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.beginPath();
    ctx.arc(sx(world, t.x), sy(world, t.y), t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Garis panduan misi.
  const target = world.missions.targetPos();
  if (target && world.state === 'play') {
    ctx.strokeStyle = 'rgba(255,215,0,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(sx(world, world.player.x), sy(world, world.player.y));
    ctx.lineTo(sx(world, target.x), sy(world, target.y));
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 14 + Math.sin(world.time * 4) * 4;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx(world, target.x), sy(world, target.y), pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Mobil parkir/traffic.
  for (const car of world.cars) drawCar(r, world, car);
  // Mobil PD.
  for (const car of world.pdCars) drawCar(r, world, car, true);
  // Mobil pemain (tidak ada di world.cars saat dikendarai).
  if (!world.player.onFoot && world.player.car) drawCar(r, world, world.player.car);
  // Pejalan kaki.
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ctx.fillStyle = '#636e72';
      ctx.beginPath();
      ctx.ellipse(sx(world, ped.x), sy(world, ped.y), 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(sx(world, ped.x), sy(world, ped.y), 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(sx(world, ped.x), sy(world, ped.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polisi jalan kaki.
  for (const cop of world.footCops) {
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(sx(world, cop.x), sy(world, cop.y), 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(sx(world, cop.x) - 6, sy(world, cop.y) - 14, 12, 4);
  }
  // Peluru.
  ctx.fillStyle = '#ffd76a';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(sx(world, b.x), sy(world, b.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Partikel.
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(sx(world, pt.x) - 2, sy(world, pt.y) - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  // Pemain jalan kaki.
  const p = world.player;
  if (p.onFoot) {
    ctx.save();
    ctx.translate(sx(world, p.x), sy(world, p.y));
    ctx.rotate(p.angle);
    ctx.fillStyle = '#f5f6fa';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e17055';
    ctx.fillRect(6, -4, 10, 8);
    ctx.restore();
  }
}

function drawCar(r, world, car, isPD = false) {
  const { ctx } = r;
  const x = sx(world, car.x);
  const y = sy(world, car.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 3, car.len, car.wid);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  if (isPD) {
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-6, -car.wid / 2, 12, car.wid);
    const blink = Math.floor(world.time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3838' : '#0984e3';
    ctx.fillRect(-4, -car.wid / 2 - 3, 8, 5);
    ctx.fillStyle = blink ? '#0984e3' : '#ff3838';
    ctx.fillRect(-4, car.wid / 2 - 2, 8, 5);
  } else if (car.kind === 'marked') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-car.len / 2 - 3, -car.wid / 2 - 3, car.len + 6, car.wid + 6, 9);
    ctx.stroke();
  }
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(-2, -car.wid / 2 + 3, 14, car.wid - 6);
  ctx.fillStyle = '#f5f6fa';
  ctx.fillRect(car.len / 2 - 4, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.len / 2 - 4, car.wid / 2 - 8, 3, 5);
  ctx.restore();
}

export function drawHUD(r, world) {
  const { ctx } = r;
  const p = world.player;
  // Panel kiri atas: cash + HP.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 250, 64);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 22, 38);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(22, 48, 150, 12);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(22, 48, 150 * Math.max(0, p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 180, 59);
  // Wanted kanan atas.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(CFG.viewW - 212, 12, 200, 40);
  ctx.font = 'bold 22px monospace';
  for (let i = 0; i < CFG.maxWanted; i++) {
    ctx.fillStyle = i < world.wanted ? '#ffd700' : '#555';
    ctx.fillText('★', CFG.viewW - 198 + i * 34, 42);
  }
  // Misi kiri bawah.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, CFG.viewH - 86, 460, 74);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  const m = world.missions;
  ctx.fillText(`MISI ${Math.min(m.index + 1, 5)}/5 — ${MISSION_NAMES[Math.min(m.index, 4)]}  $${m.reward}`, 22, CFG.viewH - 62);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(m.objectiveText().slice(0, 52), 22, CFG.viewH - 40);
  ctx.fillStyle = '#aaa';
  ctx.fillText(world.district(), 22, CFG.viewH - 20);
  // Kecepatan / status.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, CFG.viewH - 124, 210, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px monospace';
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillText(`${kmh} km/h  •  MOBIL`, 22, CFG.viewH - 103);
  } else {
    ctx.fillText(`JALAN KAKI  •  AMMO ${p.reloading ? '...' : p.ammo}/12`, 22, CFG.viewH - 103);
  }
  drawMinimap(r, world);
  // Toast.
  ctx.font = '13px monospace';
  let ty = 96;
  for (const t of world.toasts) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(t.text).width + 16;
    ctx.fillRect(12, ty, w, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, 20, ty + 17);
    ty += 30;
  }
  // Banner tengah.
  if (world.bannerData) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(CFG.viewW / 2 - 260, 150, 520, 84);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(world.bannerData.title, CFG.viewW / 2, 190);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText(world.bannerData.sub, CFG.viewW / 2, 218);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(r, world) {
  const { ctx } = r;
  const mw = CFG.minimapW;
  const mh = CFG.minimapH;
  const mx = CFG.viewW - mw - 12;
  const my = CFG.viewH - mh - 12;
  const kx = mw / CFG.worldW;
  const ky = mh / CFG.worldH;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#5d8a52';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3a7bd5';
  ctx.fillRect(mx + CFG.waterX * kx, my, (CFG.worldW - CFG.waterX) * kx, mh);
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(mx + CFG.beachX * kx, my, (CFG.waterX - CFG.beachX) * kx, mh);
  ctx.fillStyle = '#4e9a51';
  const park = world.city.park;
  ctx.fillRect(mx + park.x * kx, my + park.y * ky, park.w * kx, park.h * ky);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (const ax of world.city.avenues) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * kx, my);
    ctx.lineTo(mx + ax * kx, my + mh);
    ctx.stroke();
  }
  for (const s of world.city.streets) {
    ctx.beginPath();
    ctx.moveTo(mx, my + s * ky);
    ctx.lineTo(mx + mw, my + s * ky);
    ctx.stroke();
  }
  const target = world.missions.targetPos();
  if (target) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(mx + target.x * kx, my + target.y * ky, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of world.pdCars) {
    ctx.fillStyle = '#ff3838';
    ctx.fillRect(mx + c.x * kx - 2, my + c.y * ky - 2, 4, 4);
  }
  const p = world.player;
  ctx.save();
  ctx.translate(mx + p.x * kx, my + p.y * ky);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(world.district(), mx + 4, my + mh - 6);
}

export function drawScreen(r, world) {
  const { ctx } = r;
  const cx = CFG.viewW / 2;
  if (world.state === 'title') {
    ctx.fillStyle = 'rgba(10,20,40,0.88)';
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 84px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMARA', cx, 220);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('SUN COAST HUSTLE', cx, 268);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Kota terbuka • 5 misi Harbor Crew • Wanted 0–5', cx, 310);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    const blink = Math.floor(world.time * 2) % 2 === 0;
    if (blink) ctx.fillText('TEKAN ENTER UNTUK MAIN', cx, 420);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ccc';
    ctx.fillText('WASD jalan/nyetir  •  E masuk/curi mobil  •  F tembak  •  Space pukul/rem tangan', cx, 470);
    ctx.fillText('Shift lari  •  R reload  •  P jeda  •  Misi dimulai di Rosa Garage (tekan E)', cx, 496);
    ctx.textAlign = 'left';
    return;
  }
  if (world.state === 'pause') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('JEDA', cx, 340);
    ctx.font = '16px monospace';
    ctx.fillText('Tekan P untuk lanjut', cx, 380);
    ctx.textAlign = 'left';
    return;
  }
  if (world.state === 'busted' || world.state === 'wasted') {
    ctx.fillStyle = world.state === 'busted' ? 'rgba(20,40,120,0.75)' : 'rgba(120,20,20,0.75)';
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(world.state === 'busted' ? 'BUSTED' : 'WASTED', cx, 340);
    ctx.font = '18px monospace';
    ctx.fillText('Tekan Enter untuk bangkit lagi di Rosa Garage', cx, 390);
    ctx.textAlign = 'left';
    return;
  }
  if (world.win) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KING OF SOLMARA', cx, 330);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`Semua misi selesai — total $${world.player.cash.toLocaleString('en-US')}`, cx, 380);
    ctx.font = '16px monospace';
    ctx.fillText('Tekan Enter untuk terus menjelajah', cx, 420);
    ctx.textAlign = 'left';
  }
}
