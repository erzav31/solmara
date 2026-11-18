// Procedural Solmara: one seed builds the whole city — roads, blocks,
// buildings, park, beach, marina and the mission landmarks (all on roads,
// so every objective is reachable). Pure: no DOM, no canvas.
import { WORLD, ROAD, PARK, MARINA, DISTRICT_NAMES, LANDMARK_POINTS, PALETTE } from './config.js';
import { Rng, hashString, clamp } from './random.js';

export function districtAt(x, y) {
  // The park is the block interior; the roads around it are not the park.
  if (x > PARK.x0 + ROAD.halfWidth && x < PARK.x1 - ROAD.halfWidth && y > PARK.y0 + ROAD.halfWidth && y < PARK.y1 - ROAD.halfWidth) return 'Lumen Park';
  if (x >= ROAD.waterX) return 'Sun Coast';
  if (x >= ROAD.beachX) return 'East Beach';
  const col = clamp(Math.floor(x / 800), 0, 3);
  const row = clamp(Math.floor(y / 800), 0, 2);
  return DISTRICT_NAMES[row][col];
}

export function isWater(x, y) {
  return x >= ROAD.waterX && y >= 0 && y <= WORLD.height;
}

export function isBeach(x, y) {
  return x >= ROAD.beachX && x < ROAD.waterX;
}

export function isPark(x, y) {
  return x > PARK.x0 + ROAD.halfWidth && x < PARK.x1 - ROAD.halfWidth && y > PARK.y0 + ROAD.halfWidth && y < PARK.y1 - ROAD.halfWidth;
}

export function isRoadPoint(x, y) {
  for (const ax of ROAD.avenues) if (Math.abs(x - ax) <= ROAD.halfWidth) return true;
  for (const sy of ROAD.streets) if (Math.abs(y - sy) <= ROAD.halfWidth) return true;
  return false;
}

// Nearest road-centre point (used to snap spawn and mission points onto roads).
export function nearestRoadPoint(x, y) {
  let bestX = ROAD.avenues[0];
  let bestD = Infinity;
  for (const ax of ROAD.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; bestX = ax; }
  }
  let bestY = ROAD.streets[0];
  bestD = Infinity;
  for (const sy of ROAD.streets) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; bestY = sy; }
  }
  return { x: bestX, y: bestY };
}

function blockHasBuildings(x0, y0, x1, y1) {
  // No buildings in the park, in the sea, or on the marina strip.
  if (x0 >= PARK.x0 && x1 <= PARK.x1 && y0 >= PARK.y0 && y1 <= PARK.y1) return false;
  if (x0 >= ROAD.beachX) return false;
  if (x0 >= MARINA.x0 && y0 >= MARINA.y0 && y1 <= MARINA.y1) return false;
  return true;
}

export function generateCity(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const trees = [];
  const parkedSpots = [];

  // Buildings fill every block between two roads.
  for (let ai = 0; ai < ROAD.avenues.length - 1; ai += 1) {
    for (let si = 0; si < ROAD.streets.length - 1; si += 1) {
      const x0 = ROAD.avenues[ai] + ROAD.halfWidth + 18;
      const x1 = ROAD.avenues[ai + 1] - ROAD.halfWidth - 18;
      const y0 = ROAD.streets[si] + ROAD.halfWidth + 18;
      const y1 = ROAD.streets[si + 1] - ROAD.halfWidth - 18;
      if (x1 - x0 < 70 || y1 - y0 < 70) continue;
      if (!blockHasBuildings(x0, y0, x1, y1)) continue;
      const count = rng.int(1, 3);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roof = PALETTE.buildingRoof[hashString(district) % PALETTE.buildingRoof.length];
      if (count === 1) {
        const w = rng.range(90, Math.min(150, x1 - x0));
        const h = rng.range(70, Math.min(120, y1 - y0));
        buildings.push({ x: cx - w / 2, y: cy - h / 2, w, h, district, roof, height: rng.int(1, 4) });
      } else {
        const vertical = rng.chance(0.5);
        for (let i = 0; i < count; i += 1) {
          if (vertical) {
            const w = x1 - x0;
            const h = (y1 - y0) / count - 10;
            buildings.push({ x: x0, y: y0 + i * ((y1 - y0) / count), w, h, district, roof, height: rng.int(1, 4) });
          } else {
            const w = (x1 - x0) / count - 10;
            const h = y1 - y0;
            buildings.push({ x: x0 + i * ((x1 - x0) / count), y: y0, w, h, district, roof, height: rng.int(1, 4) });
          }
        }
      }
    }
  }

  // Trees: dense in Lumen Park, a few along the beach road.
  for (let i = 0; i < 130; i += 1) {
    trees.push({
      x: rng.range(PARK.x0 + 20, PARK.x1 - 20),
      y: rng.range(PARK.y0 + 20, PARK.y1 - 20),
      r: rng.range(9, 16),
    });
  }
  for (let i = 0; i < 24; i += 1) {
    trees.push({ x: rng.range(2830, 2930), y: rng.range(80, 2320), r: rng.range(7, 11) });
  }

  // Parked cars on road shoulders, parallel to the road.
  for (let i = 0; i < 30; i += 1) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      const ax = rng.pick(ROAD.avenues.slice(0, -1));
      const y = rng.range(200, WORLD.height - 200);
      const side = rng.chance(0.5) ? 1 : -1;
      parkedSpots.push({ x: ax + side * ROAD.shoulder, y, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    } else {
      const sy = rng.pick(ROAD.streets);
      const x = rng.range(200, ROAD.beachX - 120);
      const side = rng.chance(0.5) ? 1 : -1;
      parkedSpots.push({ x, y: sy + side * ROAD.shoulder, angle: side > 0 ? 0 : Math.PI });
    }
  }

  // Landmarks: snapped to the nearest road centre so they are reachable.
  const landmarks = {};
  for (const [key, p] of Object.entries(LANDMARK_POINTS)) {
    if (key === 'yacht') {
      landmarks[key] = { x: p.x, y: p.y, label: p.label };
    } else {
      const s = nearestRoadPoint(p.x, p.y);
      landmarks[key] = { x: s.x, y: s.y, label: p.label };
    }
  }

  return { seed, buildings, trees, parkedSpots, landmarks };
}

// Push a circle out of every building it overlaps. Returns true on a hit.
export function collideBuildings(city, body) {
  let hit = false;
  const r = body.radius;
  for (const b of city.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    }
  }
  return hit;
}

export function collideWorldBounds(body, margin) {
  const m = margin || 0;
  const before = { x: body.x, y: body.y };
  body.x = clamp(body.x, m, WORLD.width - m);
  body.y = clamp(body.y, m, WORLD.height - m);
  return before.x !== body.x || before.y !== body.y;
}

// Cars cannot drive into the sea; people on foot can wade to the beach only.
export function blockWater(body, isCar) {
  if (!isCar) {
    if (body.x > ROAD.waterX - 8) body.x = ROAD.waterX - 8;
    return;
  }
  if (body.x > ROAD.beachX - 20) body.x = ROAD.beachX - 20;
}
