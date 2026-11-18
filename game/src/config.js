// SOLMARA — Sun Coast Hustle: semua angka tuning di satu tempat.
export const CFG = {
  worldW: 3200,
  worldH: 2400,
  roadGap: 200,
  roadHalf: 14,
  beachX: 2960,
  waterX: 3080,
  // Jalan kaki
  walkSpeed: 150,
  runSpeed: 270,
  // Mobil (unit/detik)
  carAccel: 540,
  carReverse: 220,
  carMax: 640,
  carBrake: 900,
  carTurn: 2.6,
  carDrag: 0.55,
  // Pertarungan
  magSize: 12,
  reloadTime: 1.2,
  bulletSpeed: 950,
  bulletDamage: 34,
  punchRange: 46,
  punchDamage: 25,
  punchCooldown: 0.4,
  shootCooldown: 0.22,
  // Wanted
  maxWanted: 5,
  heatDecay: 4, // per detik saat trail dingin
  trailHotTime: 10, // detik sejak terakhir terlihat = trail panas
  copGiveUpTime: 5, // detik polisi kehilangan jejak lalu menyerah
  wantedDropTime: 10, // detik dingin sebelum 1 bintang turun
  pdRamDamage: 6,
  pdRamCooldown: 0.8,
  pdShootRange: 320,
  pdShootCooldown: 1.6,
  pdShootDamage: 4,
  pdShootAccuracy: 0.5,
  footCopBustRange: 30,
  footCopBustTime: 1.0,
  footCopDamage: 10,
  footCopCooldown: 0.8,
  // Tabrakan
  crashCooldown: 0.7,
  crashDamage: 8,
  // Misi
  missionRewards: [300, 650, 900, 1400, 2500],
  getawaySurvive: 45,
  bigScoreDropTime: 60,
  // Pemain
  playerHp: 100,
  bustedFine: 200,
  // Tampilan
  viewW: 1280,
  viewH: 720,
  minimapW: 230,
  minimapH: 168,
};
