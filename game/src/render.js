// All canvas drawing: the city, cars, people, HUD, minimap and menus.
// Nothing here touches the simulation except reading it.
import { WORLD, ROAD, PARK, MARINA, PALETTE, PLAYER } from './config.js';
import { clamp } from './random.js';
import { districtAt } from './city.js';
import { missionText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, world, cam, time) {
  const { city } = world;
  const vw = cam.w;
  const vh = cam.h;
  const x0 = Math.max(0, cam.x - vw / 2 - 40);
  const y0 = Math.max(0, cam.y - vh / 2 - 40);
  const x1 = Math.min(WORLD.width, cam.x + vw / 2 + 40);
  const y1 = Math.min(WORLD.height, cam.y + vh / 2 + 40);

  // Ground: fill the whole visible viewport, so the camera never shows a
  // void when the player hugs the map edge.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);

  // Sea + beach (east edge).
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(Math.max(x0, ROAD.waterX), y0, x1 - Math.max(x0, ROAD.waterX), y1 - y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, ROAD.waterX), y0, x1 - Math.max(x0, ROAD.waterX), y1 - y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const wy = y0 + ((i * 397 + Math.floor(time * 30)) % Math.max(1, (y1 - y0)));
    ctx.beginPath();
    ctx.moveTo(ROAD.waterX + 6, wy);
    ctx.lineTo(ROAD.waterX + 26, wy);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, ROAD.beachX), y0, Math.min(x1, ROAD.waterX) - Math.max(x0, ROAD.beachX), y1 - y0);

  // Park.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(PARK.x0, PARK.y0, PARK.x1 - PARK.x0, PARK.y1 - PARK.y0);
  ctx.fillStyle = '#3a6b3f';
  ctx.beginPath();
  ctx.ellipse((PARK.x0 + PARK.x1) / 2, (PARK.y0 + PARK.y1) / 2, 90, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Marina piers.
  ctx.fillStyle = PALETTE.pier;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(2820, 1180 + i * 90, 120, 14);
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of ROAD.avenues) ctx.fillRect(ax - ROAD.halfWidth, y0, ROAD.halfWidth * 2, y1 - y0);
  for (const sy of ROAD.streets) ctx.fillRect(x0, sy - ROAD.halfWidth, x1 - x0, ROAD.halfWidth * 2);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ax of ROAD.avenues) {
    ctx.beginPath();
    ctx.moveTo(ax, y0);
    ctx.lineTo(ax, y1);
    ctx.stroke();
  }
  for (const sy of ROAD.streets) {
    ctx.beginPath();
    ctx.moveTo(x0, sy);
    ctx.lineTo(x1, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y + b.h - 5, b.w, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission target marker (pulsing gold diamond + line from the player).
  const target = world.missionTarget();
  if (target && world.screen === 'play') {
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    const r = 16 * pulse;
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - r);
    ctx.lineTo(target.x + r, target.y);
    ctx.lineTo(target.x, target.y + r);
    ctx.lineTo(target.x - r, target.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,74,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,74,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(world.player.x, world.player.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Cars.
  for (const car of world.traffic) {
    if (car.dead) continue;
    if (car.x < x0 - 60 || car.x > x1 + 60 || car.y < y0 - 60 || car.y > y1 + 60) continue;
    drawCar(ctx, car);
  }
  // Police cars.
  for (const cop of world.cops) {
    if (cop.dead || cop.kind !== 'car') continue;
    drawCar(ctx, cop, true);
  }
  // Pedestrians + foot police.
  for (const ped of world.peds) {
    if (ped.dead) continue;
    ctx.fillStyle = ped.state === 'down' ? '#5a3a3a' : PALETTE.ped;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of world.cops) {
    if (cop.dead || cop.kind !== 'foot') continue;
    ctx.fillStyle = PALETTE.copFoot;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, cop.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9db8ff';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player.
  const p = world.player;
  if (p.onFoot) {
    ctx.fillStyle = '#1d1d1d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * (p.radius + 6), p.y + Math.sin(p.angle) * (p.radius + 6));
    ctx.stroke();
  } else if (p.car) {
    drawCar(ctx, p.car, false, true);
  }

  // Bullets.
  ctx.fillStyle = PALETTE.bullet;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawCar(ctx, car, isPd, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = 40;
  const h = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -w / 2 + 2, -h / 2 + 3, w, h, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  roundRect(ctx, -6, -h / 2 + 3, 12, h - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 1, 5, 3);
  ctx.fillRect(-w / 2 + 3, h / 2 - 4, 5, 3);
  ctx.fillRect(w / 2 - 8, -h / 2 + 1, 5, 3);
  ctx.fillRect(w / 2 - 8, h / 2 - 4, 5, 3);
  if (isPd) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-4, -h / 2 - 3, 8, 4);
    ctx.fillStyle = '#2e6fd8';
    ctx.fillRect(-4, h / 2 - 1, 8, 4);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Minimap: the whole city at a glance. ---
export function drawMinimap(ctx, world, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,10,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  // Water + park.
  ctx.fillStyle = '#17465f';
  ctx.fillRect(x + ROAD.waterX * sx, y, (WORLD.width - ROAD.waterX) * sx, h);
  ctx.fillStyle = '#2c5230';
  ctx.fillRect(x + PARK.x0 * sx, y + PARK.y0 * sy, (PARK.x1 - PARK.x0) * sx, (PARK.y1 - PARK.y0) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(200,200,200,0.55)';
  for (const ax of ROAD.avenues) {
    ctx.beginPath();
    ctx.moveTo(x + ax * sx, y);
    ctx.lineTo(x + ax * sx, y + h);
    ctx.stroke();
  }
  for (const sy2 of ROAD.streets) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy2 * sy);
    ctx.lineTo(x + w, y + sy2 * sy);
    ctx.stroke();
  }
  // Mission marker.
  const target = world.missionTarget();
  if (target) {
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.arc(x + target.x * sx, y + target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#ff3b30';
  for (const cop of world.cops) {
    if (cop.dead) continue;
    ctx.beginPath();
    ctx.arc(x + cop.x * sx, y + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// --- HUD ---
export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 210, 64, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`$${world.cash.toLocaleString('en-US')}`, 24, 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#9fd6a0';
  ctx.fillText(`BEST $${world.best.toLocaleString('en-US')}`, 24, 60);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(130, 24, 76, 10);
  ctx.fillStyle = p.hp > 40 ? '#58c96b' : '#e5484d';
  ctx.fillRect(130, 24, 76 * clamp(p.hp / 100, 0, 1), 10);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 130, 48);

  // Top-centre: wanted stars.
  const stars = world.wantedStars;
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', vw / 2 - 60 + i * 30, 44);
  }
  ctx.textAlign = 'left';
  if (stars > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffb3b3';
    ctx.fillText('SOLMARA PD ON YOUR TAIL', vw / 2 - 78, 64);
  }

  // Minimap top-right + district name.
  const mw = 220;
  const mh = 165;
  drawMinimap(ctx, world, vw - mw - 12, 12, mw, mh);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(districtAt(p.x, p.y), vw - mw - 12, 12 + mh + 18);

  // Bottom-left: mission line + controls hint.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const missionLine = missionText(world.mission);
  ctx.font = '14px system-ui, sans-serif';
  const mtw = ctx.measureText(missionLine).width;
  roundRect(ctx, 12, vh - 66, Math.min(mtw + 24, vw - 24), 54, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.mission;
  ctx.fillText(missionLine, 24, vh - 44);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(p.onFoot ? 'WASD move · Shift run · E enter car · F shoot · Space punch' : 'WASD drive · Space handbrake · E exit car · F shoot · R reload · P pause', 24, vh - 24);

  // Bottom-right: speed / ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, vw - 150, vh - 66, 138, 54, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  if (p.onFoot) {
    ctx.fillText('ON FOOT', vw - 138, vh - 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`AMMO ${p.ammo}/${PLAYER.ammoMax}`, vw - 138, vh - 22);
  } else {
    const kmh = Math.round(Math.abs(p.speed) * 0.36);
    ctx.fillText(`${kmh} km/h`, vw - 138, vh - 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`AMMO ${p.ammo}/${PLAYER.ammoMax}`, vw - 138, vh - 22);
  }

  // Toasts (latest event).
  const toast = world.latestToast;
  if (toast && world.time - toast.at < 3.2) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const tw = ctx.measureText(toast.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, vw / 2 - tw / 2 - 14, 84, tw + 28, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.textAlign = 'center';
    ctx.fillText(toast.text, vw / 2, 107);
    ctx.textAlign = 'left';
  }
}

// --- Full-screen overlays ---
export function drawScreen(ctx, world, screen, vw, vh) {
  if (screen === SCREEN_PLAY) return;
  ctx.fillStyle = screen === SCREEN_TITLE ? 'rgba(8,12,20,0.72)' : 'rgba(8,12,20,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5f1e6';
  if (screen === SCREEN_TITLE) {
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('SOLMARA', vw / 2, vh / 2 - 110);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText('Sun Coast Hustle', vw / 2, vh / 2 - 68);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText('An open-world crime game: steal cars, dodge the Solmara PD,', vw / 2, vh / 2 - 20);
    ctx.fillText('and run five jobs for Jax Marlowe and the Harbor Crew.', vw / 2, vh / 2 + 4);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('Press ENTER to play', vw / 2, vh / 2 + 52);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#9aa7b8';
    ctx.fillText('WASD move / drive · E enter car · F shoot · Space punch / handbrake · R reload · P pause · M mute', vw / 2, vh / 2 + 84);
    const saved = world.cash > 150 || world.mission.done.length > 0;
    if (saved) {
      ctx.fillStyle = '#9fd6a0';
      ctx.fillText(`Save loaded: $${world.cash} · ${world.mission.done.length}/5 jobs done`, vw / 2, vh / 2 + 110);
    }
  } else if (screen === SCREEN_PAUSE) {
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 20);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press P to resume · M mute', vw / 2, vh / 2 + 20);
  } else if (screen === SCREEN_BUSTED) {
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillStyle = '#7fb2ff';
    ctx.fillText('BUSTED', vw / 2, vh / 2 - 20);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText('The Solmara PD caught you. Press ENTER to walk free.', vw / 2, vh / 2 + 20);
  } else if (screen === SCREEN_WASTED) {
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillStyle = '#e5484d';
    ctx.fillText('WASTED', vw / 2, vh / 2 - 20);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText('You did not survive Solmara. Press ENTER to try again.', vw / 2, vh / 2 + 20);
  } else if (screen === SCREEN_WIN) {
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('KING OF SOLMARA', vw / 2, vh / 2 - 20);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText(`All five Harbor Crew jobs done. Final cash: $${world.cash.toLocaleString('en-US')}.`, vw / 2, vh / 2 + 20);
    ctx.fillText('Press ENTER to keep cruising the city.', vw / 2, vh / 2 + 48);
  }
  ctx.textAlign = 'left';
}
