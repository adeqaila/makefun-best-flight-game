# CALDERA RUN — Volcano Island Airlift

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/adeqaila/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/adeqaila/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Entry for make.fun's **"Make the best flight game"** bounty
(`best-flight-game-20261126-0057`, $500, 50 paid places).

## The game

Fly a mail biplane across a volcanic island chain. Take off from a grass
strip, thread orange rings, deliver mail to island strips, and bring her home
— with fuel and damage turning every sortie into decisions.

- **3 missions, different goals:** RING RUN (8 rings, then land home),
  ISLAND MAIL (deliver to 3 strips), CALDERA CIRCUIT (timed lap around the
  volcano).
- **Real flight model:** throttle, pitch, roll and yaw with stall, ground
  effect, landing gear, fuel burn and damage. Landings and crashes read as
  what happened.
- **Two cameras:** chase and cockpit (six lit instruments: ALT, SPD, HDG,
  FUEL, RPM, VSI), plus a full HUD with altitude, speed and heading.
- **One style throughout:** low-poly terrain, sea, volcano, villages and
  strips in five light themes (golden, noon, sunset, dawn, dusk).
- **Controls:** W/S throttle, arrow keys / WASD fly, mouse drag steers,
  Space confirms, P pauses, C swaps camera, G toggles gear, 1/2/3 pick a
  sortie, M mutes, R restarts after a crash.

## Play it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome and plays
offline, no network request. three.js is vendored as `game/vendor/three.min.js`.

## Method

- Built from the kit starter's layout, game code written fresh in
  `game/src/` — one file per job: `config`, `random`, `world`, `plane`,
  `input`, `audio`, `missions`, `render`, `hud`, `shots`, `main`.
- Seeded world (`?seed=N`): the same seed always builds the same island,
  rings and strips.
- Screenshots are real renders of the game's own code, staged by
  `game/src/shots.js`: it plays the real rules forward from a fresh world
  with a simple autopilot, so each frame is what a short game really looks
  like. See `shots.json` for the exact URL of each shot.
- `main.ts` (Node 22, standard library only) copies `game/` and
  `screenshots/` to `/output` and writes `/output/dossier.json` with the
  kit's `buildDossier`.

## Results (verified)

- **Screenshots:** 4 JPEGs, 1280×720, 64–104 KB each (cap 256 KiB) —
  cover (chase, ring 1 ahead, volcano behind), rings (ring 3 dead ahead,
  200 pts), landing (final approach, runway + windsock), cockpit (six lit
  instruments, ring 1 at 100 m). All show the aircraft in frame, the HUD
  lit (ALT / SPD / HDG), and a ring or runway ahead.
- **Full-mission sim (headless, `dev/simfull.mjs`):** RING RUN completed —
  8/8 rings, landed home, score 1320, fuel 100, damage 0.
- **Determinism:** `main.ts` run twice produces byte-identical output
  (`diff -r` clean); dossier schema `makefun/dossier/v1`, 13 source files,
  1 vendored file, 79,286 text bytes (cap 163,840).
- **Gate caps:** game/ is 14 files, 696 KB (caps 993 files / 48 MiB);
  no network references in `game/`.
- **License:** MIT, with `SPDX-License-Identifier: MIT` in `LICENSE`.

## Files

- `main.ts` — the hand-in program
- `serve.ts` — local static server for play-testing
- `game/` — the playable game (`index.html` + `src/` + `vendor/three.min.js`)
- `screenshots/` — 4 real renders (first by name is the cover)
- `shots.json` — the URL behind each screenshot
- `vendor/makefun-game.ts` — the kit's copy, unchanged
- `dev/` — headless flight sims used to verify playability
