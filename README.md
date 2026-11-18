# SOLMARA — Sun Coast Hustle

Open-world crime game (2D top-down, canvas, no libraries, no network) for
make.fun competition **gta6-01**. Original city, characters, story, art and
sound — nothing from Rockstar / GTA or any other commercial game.

## The game

- **City of Solmara** (3.2 × 2.4 km): grid streets, beach + sea to the east,
  marina, Lumen Park, Downtown, 12 named districts — all procedural from
  one seed, fully deterministic.
- **On foot + by car**: WASD walk/run, E enter/steal a car, arcade driving
  with handbrake drift, traffic and pedestrians, collision damage.
- **Wanted 0–5 stars**: steal a car in front of police, hit pedestrians,
  shoot — PD cars chase, ram and shoot; foot cops chase and bust you.
  Lose the trail and the heat cools down, stars drop one by one.
- **5 Harbor Crew missions (Jax Marlowe)**: First Fare ($300), Harbor
  Package ($650), Getaway Driver ($900 — steal the marked car, survive
  45s), The Gold Vela ($1,400), The Big Score ($2,500 — 3 timed drops).
  Finish them all and become KING OF SOLMARA.
- **Combat**: shoot (F / mouse, aim with mouse, 12 rounds + reload R),
  punch (Space). HUD with cash + HP, wanted stars, live minimap, mission
  guide line, speed. Cash/missions saved to localStorage.
- **Screens**: title, play, pause, busted, wasted, mission complete, win.
  All art drawn in code, all sound synthesized with WebAudio.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run / (in car) — |
| E | Enter/exit car, steal, start mission at Rosa Garage |
| F / click | Shoot (aim with mouse) |
| Space | Punch (on foot) / handbrake (in car) |
| R | Reload |
| P / Esc | Pause |
| Enter | Start / respawn |

## Run it

```sh
node serve.ts        # http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are real renders of the game (`?shot=…&seed=1`), listed in
`shots.json`.

## License

MIT — see `LICENSE`.
