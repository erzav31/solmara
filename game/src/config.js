// SOLMARA — Sun Coast Hustle: tuning, districts and mission data.
// One job: every number the rest of the game reads, in one place.
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara-save-v1';

// City layout: avenues run north-south, streets east-west, 256 apart.
export const ROAD = {
  halfWidth: 26,
  shoulder: 34,
  avenues: [128, 384, 640, 896, 1152, 1408, 1664, 1920, 2176, 2432, 2688, 2816],
  streets: [128, 384, 640, 896, 1152, 1408, 1664, 1920, 2048],
  waterX: 2944,
  beachX: 2816,
};

export const PARK = { x0: 1408, y0: 896, x1: 1920, y1: 1408 };
export const MARINA = { x0: 2688, y0: 1152, x1: 2944, y1: 1408 };

// 12 districts in a 4 x 3 grid over the city.
export const DISTRICT_NAMES = [
  ['Northgate', 'Old Town', 'Canal Row', 'East Beach'],
  ['Market Square', 'Downtown', 'Lumen Park', 'Marina Bay'],
  ['South Docks', 'Harborview', 'Rosa Fields', 'Sunset Point'],
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 320,
  hp: 100,
  ammoMax: 12,
  reloadSeconds: 1.2,
  shootCooldown: 0.16,
  punchCooldown: 0.45,
  punchRange: 46,
  punchDamage: 40,
  bulletDamage: 34,
  bulletSpeed: 920,
  bulletRange: 520,
};

export const CAR = {
  radius: 19,
  accel: 430,
  brake: 700,
  reverseMax: 210,
  maxSpeed: 520,
  sportMax: 640,
  turnRate: 2.6,
  driftTurn: 3.6,
  hp: 100,
  crashCooldown: 0.7,
};

export const WANTED = {
  heatPerStar: 20,
  maxStars: 5,
  stealHeat: 40,
  hitPedHeat: 25,
  shootSeenHeat: 8,
  killCopHeat: 60,
  decayPerSecond: 4,
  unseenSeconds: 5,
  witnessRange: 520,
  copViewRange: 700,
};

export const COP = {
  footSpeed: 205,
  footRunSpeed: 245,
  bustRange: 30,
  bustSeconds: 1.2,
  giveUpSeconds: 5,
  pdRamDamage: 6,
  pdRamCooldown: 0.8,
  spawnRangeMin: 500,
  spawnRangeMax: 800,
  maxCops: 10,
};

export const PALETTE = {
  ground: '#26301f',
  road: '#3b4048',
  roadLine: '#c8b45a',
  sidewalk: '#54524a',
  water: '#17465f',
  waterDeep: '#0f3247',
  sand: '#b39b62',
  park: '#2c5230',
  tree: '#3f7a3a',
  treeDark: '#2e5c2c',
  buildingRoof: ['#7a6a58', '#6b7a8c', '#8c6b6b', '#5f7a6b', '#7a7a5f', '#8c7a5f'],
  pier: '#8a6f4d',
  player: '#f2c14e',
  playerCar: '#e4572e',
  copCar: '#2e6fd8',
  copFoot: '#274b9f',
  ped: '#d8d3c3',
  bullet: '#ffe08a',
  mission: '#ffd94a',
  hud: '#f5f1e6',
};

export const MISSIONS = [
  {
    name: 'First Fare',
    giver: 'Jax Marlowe',
    briefing: 'Pick up Jax at Rosa Garage and drive him to Harbor Cafe.',
    reward: 300,
    stages: [
      { type: 'goto', point: 'garage', text: 'Pick up Jax at Rosa Garage' },
      { type: 'goto', point: 'cafe', text: 'Drop Jax at Harbor Cafe' },
    ],
  },
  {
    name: 'Harbor Package',
    giver: 'Jax Marlowe',
    briefing: 'Grab the package at South Docks and deliver it to Marina Bay in 90 seconds.',
    reward: 650,
    stages: [
      { type: 'goto', point: 'docks', text: 'Pick up the package at South Docks' },
      { type: 'goto', point: 'marina', text: 'Deliver to Marina Bay', time: 90 },
    ],
  },
  {
    name: 'Getaway Driver',
    giver: 'Jax Marlowe',
    briefing: 'Steal the marked car, survive the heat for 45 seconds, then reach the hideout.',
    reward: 900,
    stages: [
      { type: 'steal', point: 'marked', text: 'Steal the marked car by the bank' },
      { type: 'survive', time: 45, text: 'Survive the heat for 45 seconds' },
      { type: 'goto', point: 'hideout', text: 'Reach the Jax Hideout' },
    ],
  },
  {
    name: 'The Gold Vela',
    giver: 'Jax Marlowe',
    briefing: 'Board the yacht at the marina, grab the gold, and escape to the hideout in 120 seconds.',
    reward: 1400,
    stages: [
      { type: 'goto', point: 'yacht', text: 'Board the yacht Gold Vela' },
      { type: 'hold', time: 2, point: 'yacht', text: 'Grab the gold' },
      { type: 'goto', point: 'hideout', text: 'Escape to the hideout', time: 120 },
    ],
  },
  {
    name: 'The Big Score',
    giver: 'Jax Marlowe',
    briefing: 'Three drops, 180 seconds: the bank, the casino, the harbor gate. Then you own Solmara.',
    reward: 2500,
    stages: [
      { type: 'goto', point: 'bank', text: 'Drop 1: Solmara Bank' },
      { type: 'goto', point: 'casino', text: 'Drop 2: Vela Casino' },
      { type: 'goto', point: 'harbor', text: 'Drop 3: Harbor Gate', time: 180 },
    ],
  },
];

export const LANDMARK_POINTS = {
  garage: { x: 384, y: 2048, label: 'Rosa Garage' },
  cafe: { x: 1408, y: 768, label: 'Harbor Cafe' },
  docks: { x: 2688, y: 2048, label: 'South Docks' },
  marina: { x: 2688, y: 1280, label: 'Marina Bay' },
  yacht: { x: 2860, y: 1280, label: 'Gold Vela' },
  hideout: { x: 640, y: 384, label: 'Jax Hideout' },
  bank: { x: 1664, y: 1024, label: 'Solmara Bank' },
  casino: { x: 1920, y: 1792, label: 'Vela Casino' },
  harbor: { x: 2432, y: 2048, label: 'Harbor Gate' },
  police: { x: 1408, y: 1280, label: 'Solmara PD HQ' },
  hospital: { x: 1152, y: 1792, label: 'St. Marina Hospital' },
  start: { x: 1408, y: 1024, label: 'Downtown' },
  marked: { x: 1664, y: 1152, label: 'Marked car' },
};
