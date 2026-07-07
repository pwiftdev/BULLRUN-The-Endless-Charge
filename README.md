# 🐂 BULLRUN: The Endless Charge

A free-to-play 3D voxel endless runner for the **$BULLRUN** Solana community.
Saddle up with a rider name and your Solana public address, charge through an
ever-shifting frontier, and carve your best score into the global leaderboard.

![stack](https://img.shields.io/badge/three.js-WebGL-black) ![stack](https://img.shields.io/badge/vite-dev%2Fbuild-646cff) ![stack](https://img.shields.io/badge/express-API-259dff)

## The run

- **Three worlds, one endless trail** — the run morphs seamlessly between the
  *Golden Prairie*, the sunset *Crimson Mesa*, and the aurora-lit *Starlit Range*,
  looping forever as the pace climbs.
- **Three lanes, three moves** — switch lanes, jump the fences and campfires,
  slide under ranch gates. One hit and you're trampled.
- **Progressive difficulty** — speed and obstacle density ramp smoothly the
  farther you charge.
- **Score** = distance in metres + 25 per gold coin collected.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Switch lane | ◀ ▶ or A / D | swipe left / right |
| Jump | ▲ / W / Space | swipe up or tap |
| Slide | ▼ / S | swipe down |

## Tech

- **three.js** — every model is hand-built voxel geometry (merged colored boxes),
  with instanced ground detail, pooled obstacles/decor, bloom post-processing,
  MSAA, ACES tone mapping, per-biome lighting/exposure grades, parallax mountain
  ranges, procedural sky (sun, moon, twinkling stars, shooting stars, aurora),
  and ambient life (butterflies, birds, fireflies).
- **Vite** — dev server + production bundling.
- **Express** — tiny leaderboard API backed by a JSON file (`data/leaderboard.json`),
  keeping each wallet's best score. No wallet connection required — players just
  type their public address.
- **Web Audio** — all sound effects are synthesized at runtime; zero audio assets.

## Run it

```bash
npm install

# development (Vite middleware + API on one port)
npm run dev          # → http://localhost:3000

# production
npm run build
npm start            # serves dist/ + API on PORT (default 3000)
```

## Leaderboard API

| Method | Route | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/leaderboard` | — | Top 100, sorted by score |
| POST | `/api/score` | `{ username, address, score, distance, coins }` | Validates name + base58 Solana address, rate-limited, keeps best per address |

Scores persist to `data/leaderboard.json` (git-ignored). For a serious launch,
swap the JSON store for a real database and add signature-based verification —
the store is isolated in `server.js`, so it's a small change.

## Project layout

```
server.js          Express API + Vite middleware (dev) / static dist (prod)
index.html         UI shell — signup, HUD, leaderboard, game-over
src/
  game.js          Orchestrator: loop, camera, lighting, post-processing, input
  palettes.js      Biome definitions + blended transitions
  models.js        The voxel model library (decor, obstacles, coin)
  bull.js          The player bull — model, gallop/jump/slide/death animation
  world.js         Ground chunks, parallax mountains, decor spawning
  obstacles.js     Obstacle patterns, coins, collision
  sky.js           Sky dome, sun/moon, stars, clouds, aurora
  ambience.js      Butterflies, birds, fireflies
  particles.js     Dust, sparkles, bursts
  audio.js         Procedural sound kit
  ui.js            DOM overlays + leaderboard client
```
