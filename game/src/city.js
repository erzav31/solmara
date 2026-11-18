// Kota Solmara: semua prosedural dari satu seed. Jalan grid, 12 distrik,
// pantai + laut di timur, marina, Lumen Park, gedung-gedung.
import { CFG } from './config.js';
import { makeRng } from './random.js';

export const DISTRICTS = [
  ['Northgate', 'Downtown', 'Coral Row', 'Marina Bay'],
  ['Little Vela', 'Lumen Park', 'Foundry', 'East Docks'],
  ['Palm Court', 'Sunset Strip', 'The Yards', 'Old Harbor'],
];

const PARK = { x: 1000, y: 800, w: 400, h: 400 };
const MARINA = { x: 2700, y: 400, w: 260, h: 500 };
const ROOF_COLORS = ['#8a6f5c', '#7d8a99', '#9c8a7a', '#6f7d6a', '#a08a6a', '#7a6a8a'];

export function generateCity(seed) {
  const rng = makeRng(seed);
  const avenues = [];
  for (let x = 100; x <= 2900; x += CFG.roadGap) avenues.push(x);
  const streets = [];
  for (let y = 100; y <= 2300; y += CFG.roadGap) streets.push(y);

  const buildings = [];
  for (let ai = 0; ai < avenues.length - 1; ai++) {
    for (let si = 0; si < streets.length - 1; si++) {
      const bx0 = avenues[ai] + CFG.roadHalf + 8;
      const by0 = streets[si] + CFG.roadHalf + 8;
      const bx1 = avenues[ai + 1] - CFG.roadHalf - 8;
      const by1 = streets[si + 1] - CFG.roadHalf - 8;
      // Lewati taman dan marina: area terbuka, tanpa gedung.
      if (rectsOverlap({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, PARK)) continue;
      if (rectsOverlap({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, MARINA)) continue;
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const w = rng.range(50, Math.min(120, bx1 - bx0 - 10));
        const h = rng.range(50, Math.min(120, by1 - by0 - 10));
        const x = rng.range(bx0, bx1 - w);
        const y = rng.range(by0, by1 - h);
        buildings.push({ x, y, w, h, color: rng.pick(ROOF_COLORS), hgt: rng.int(1, 3) });
      }
    }
  }

  // Pohon-pohon di taman (hiasan, tidak menghalangi).
  const trees = [];
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: rng.range(PARK.x + 24, PARK.x + PARK.w - 24),
      y: rng.range(PARK.y + 24, PARK.y + PARK.h - 24),
      r: rng.range(7, 13),
    });
  }

  // Dermaga marina: papan kayu menjorok ke laut.
  const docks = [
    { x: 2980, y: 500, w: 90, h: 12 },
    { x: 2980, y: 650, w: 110, h: 12 },
    { x: 2980, y: 800, w: 90, h: 12 },
  ];

  const landmarks = {
    garage: nearestRoadPoint(300, 2100, avenues, streets),
    harborOffice: nearestRoadPoint(500, 300, avenues, streets),
    marinaCafe: nearestRoadPoint(2700, 500, avenues, streets),
    velaBank: nearestRoadPoint(1300, 300, avenues, streets),
    packageDrop: nearestRoadPoint(1100, 1900, avenues, streets),
    // Yacht The Gold Vela di dermaga tengah; pemain berinteraksi dari ujung dermaga.
    yacht: { x: 3080, y: 656 },
    yachtDock: { x: 2980, y: 650 },
    dropA: nearestRoadPoint(700, 700, avenues, streets),
    dropB: nearestRoadPoint(2100, 1700, avenues, streets),
    dropC: nearestRoadPoint(2500, 1100, avenues, streets),
    farePickup: nearestRoadPoint(900, 1500, avenues, streets),
    fareDropoff: nearestRoadPoint(2700, 500, avenues, streets),
  };

  return { avenues, streets, buildings, trees, docks, landmarks, park: PARK, marina: MARINA };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function nearestRoadPoint(x, y, avenues, streets) {
  let bestX = avenues[0];
  let bestDx = Infinity;
  for (const ax of avenues) {
    const d = Math.abs(ax - x);
    if (d < bestDx) {
      bestDx = d;
      bestX = ax;
    }
  }
  let bestY = streets[0];
  let bestDy = Infinity;
  for (const sy of streets) {
    const d = Math.abs(sy - y);
    if (d < bestDy) {
      bestDy = d;
      bestY = sy;
    }
  }
  // Pilih sumbu jalan terdekat dari titik asal.
  return bestDx <= bestDy ? { x: bestX, y } : { x, y: bestY };
}

export function isRoadAt(city, x, y) {
  if (x < 0 || y < 0 || x >= CFG.worldW || y >= CFG.worldH) return false;
  if (x >= CFG.beachX) return false;
  for (const ax of city.avenues) if (Math.abs(x - ax) <= CFG.roadHalf) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) <= CFG.roadHalf) return true;
  return false;
}

export function inBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x + 2 && x < b.x + b.w - 2 && y > b.y + 2 && y < b.y + b.h - 2) return b;
  }
  return null;
}

export function isWater(city, x, y) {
  return x >= CFG.waterX && y >= 0 && y < CFG.worldH;
}

export function isBeach(city, x, y) {
  return x >= CFG.beachX && x < CFG.waterX;
}

export function isPark(city, x, y) {
  const p = city.park;
  return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
}

// Titik boleh dipijak mobil/pejalan: bukan gedung, bukan air.
export function isBlocked(city, x, y) {
  if (x < 8 || y < 8 || x >= CFG.worldW - 8 || y >= CFG.worldH - 8) return true;
  if (isWater(city, x, y)) return true;
  return inBuilding(city, x, y) !== null;
}

export function districtAt(city, x, y) {
  if (x >= CFG.beachX) return 'Sun Coast';
  if (isPark(city, x, y)) return 'Lumen Park';
  const col = Math.min(3, Math.max(0, Math.floor(x / 740)));
  const row = Math.min(2, Math.max(0, Math.floor(y / 800)));
  return DISTRICTS[row][col];
}

// Geser titik ke jalan terdekat (dipakai saat menaruh mobil parkir & target misi).
export function snapToRoad(city, x, y) {
  return nearestRoadPoint(x, y, city.avenues, city.streets);
}

// Cari titik jalan bebas gedung dalam radius — dipakai untuk spawn mobil parkir.
export function freeRoadPoint(city, rng, cx, cy, radius) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, radius);
    const p = snapToRoad(city, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    if (!isBlocked(city, p.x, p.y)) return p;
  }
  return snapToRoad(city, cx, cy);
}

// Sama, tapi titik hasil snap harus tetap sejauh minR*0.7 dari pusat —
// dipakai spawn polisi supaya tidak muncul tepat di sebelah pemain.
export function freeRoadPointMin(city, rng, cx, cy, minR, maxR) {
  for (let tries = 0; tries < 60; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(minR, maxR);
    const p = snapToRoad(city, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    if (Math.hypot(p.x - cx, p.y - cy) < minR * 0.7) continue;
    if (!isBlocked(city, p.x, p.y)) return p;
  }
  return snapToRoad(city, cx, cy);
}
