// Harbor Crew missions: a small state machine over the data in config.js.
// Stage types: goto (reach a landmark), steal (enter the marked car),
// survive (stay alive N seconds), hold (stand on a point N seconds).
import { MISSIONS } from './config.js';
import { dist } from './random.js';

export function missionCount() {
  return MISSIONS.length;
}

export function missionDef(index) {
  return MISSIONS[index] || null;
}

export function newMissionState() {
  return {
    index: 0,
    stage: 0,
    active: false,
    timer: 0,
    holdT: 0,
    done: [],
    allDone: false,
  };
}

export function currentStage(mission) {
  const def = missionDef(mission.index);
  if (!def || mission.stage >= def.stages.length) return null;
  return def.stages[mission.stage];
}

export function startMission(mission, index) {
  mission.index = index;
  mission.stage = 0;
  mission.active = true;
  mission.timer = 0;
  mission.holdT = 0;
}

export function missionTargetPoint(mission, city) {
  const stage = currentStage(mission);
  if (!stage || !stage.point) return null;
  const p = city.landmarks[stage.point];
  return p ? { x: p.x, y: p.y, label: p.label, text: stage.text } : null;
}

export function missionText(mission) {
  if (mission.allDone) return 'KING OF SOLMARA — all Harbor Crew jobs done.';
  if (!mission.active) {
    const def = missionDef(mission.index);
    return def ? `Next job: ${def.name} — ${def.briefing}` : '';
  }
  const stage = currentStage(mission);
  if (!stage) return '';
  const def = missionDef(mission.index);
  let text = `${def.name}: ${stage.text}`;
  if (stage.type === 'survive' || (stage.time && mission.timer > 0)) {
    text += ` (${Math.ceil(mission.timer)}s)`;
  }
  return text;
}

// Advance the mission one step. `ctx` carries what the stage needs:
// player position, whether the player is in the marked car, wanted level.
// Returns an event string ('stage', 'done', 'failed', null).
export function updateMission(mission, ctx, dt) {
  if (!mission.active || mission.allDone) return null;
  const def = missionDef(mission.index);
  if (!def) return null;
  const stage = currentStage(mission);
  if (!stage) return null;

  if (stage.type === 'goto' || stage.type === 'pickup') {
    const p = ctx.city.landmarks[stage.point];
    if (p && dist(ctx.player.x, ctx.player.y, p.x, p.y) < 56) {
      return advance(mission, def);
    }
    if (stage.time) {
      mission.timer = mission.timer || stage.time;
      mission.timer -= dt;
      if (mission.timer <= 0) return fail(mission);
    }
    return null;
  }
  if (stage.type === 'steal') {
    if (ctx.inMarkedCar) return advance(mission, def);
    return null;
  }
  if (stage.type === 'survive') {
    mission.timer = mission.timer || stage.time;
    mission.timer -= dt;
    if (ctx.playerHp <= 0) return fail(mission);
    if (mission.timer <= 0) return advance(mission, def);
    return null;
  }
  if (stage.type === 'hold') {
    const p = ctx.city.landmarks[stage.point];
    if (p && dist(ctx.player.x, ctx.player.y, p.x, p.y) < 60) {
      mission.holdT += dt;
      if (mission.holdT >= stage.time) return advance(mission, def);
    } else {
      mission.holdT = 0;
    }
    return null;
  }
  return null;
}

function advance(mission, def) {
  mission.stage += 1;
  mission.timer = 0;
  mission.holdT = 0;
  if (mission.stage >= def.stages.length) {
    mission.done.push(mission.index);
    mission.active = false;
    mission.index += 1;
    mission.stage = 0;
    if (mission.index >= MISSIONS.length) {
      mission.allDone = true;
    }
    return 'done';
  }
  return 'stage';
}

function fail(mission) {
  mission.active = false;
  mission.timer = 0;
  mission.holdT = 0;
  return 'failed';
}
