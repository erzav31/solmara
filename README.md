# SOLMARA — Sun Coast Hustle

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. 2D top-down, canvas, no libraries, no network, no external
assets — every image is drawn in code, every sound is synthesised WebAudio.

## The game

Explore the procedural city of Solmara (3.2 x 2.4 km, 12 named districts,
beach and sea on the east, Lumen Park, marina) on foot and by car. Steal
parked cars, drive arcade-style with handbrake drift, dodge traffic and
pedestrians. A wanted level of 0-5 stars brings Solmara PD foot cops and
patrol cars after you; lose the trail and the heat cools off.

Run five jobs for Jax Marlowe and the Harbor Crew — First Fare, Harbor
Package, Getaway Driver, The Gold Vela, The Big Score — for $300 to $2,500
each. Finish them all and you are the King of Solmara. Combat: shoot with
the mouse (F), punch (Space), reload (R). Cash, health, wanted stars,
minimap, mission line and speed on the HUD. Progress saves to localStorage.

## Controls

- WASD / arrows: move / drive (Shift: run)
- E: enter / exit car
- F or mouse click: shoot (aim with the mouse)
- Space: punch on foot, handbrake while driving
- R: reload · P: pause · M: mute · Enter: start / continue

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Structure

- `game/src/config.js` — tuning, districts, missions
- `game/src/random.js` — seeded RNG
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — WebAudio synth effects
- `game/src/city.js` — procedural city + collision
- `game/src/entities.js` — traffic, pedestrians, police
- `game/src/missions.js` — the five Harbor Crew jobs
- `game/src/world.js` — the simulation
- `game/src/render.js` — canvas drawing, HUD, minimap, menus
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — boot + fixed-step loop

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`dossier.json` with the vendored make.fun library.
