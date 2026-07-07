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
- **Express (local dev) / Vercel serverless functions (production)** — the same
  leaderboard logic (`lib/store.js`) backs both: an Express server for
  `npm run dev`, and `api/leaderboard.js` + `api/score.js` on Vercel. Keeps
  each wallet's best score. No wallet connection required — players just
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

Scores persist to `data/leaderboard.json` locally (git-ignored). In production
on Vercel, the store needs Redis — see below.

## Deploying to Vercel

Vercel's zero-config build only runs `vite build` and serves `dist/`; it never
runs `server.js`. That's what `api/leaderboard.js` and `api/score.js` are for —
they're the same logic, exposed as Vercel serverless functions. But those
functions have a **read-only, ephemeral filesystem**, so a JSON file can't
persist between invocations there. You need a real store:

1. In the Vercel dashboard, open your project → **Storage** tab → **Create
   Database** → pick a **Redis** option (Upstash, via the Marketplace).
2. Connect it to the project — this auto-injects `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)
   as environment variables.
3. Redeploy. `lib/store.js` detects those variables automatically and switches
   from the JSON file to Redis — no code changes needed.

Without step 1–2, the leaderboard API will still respond (so the "offline"
message goes away), but scores won't survive a cold start or new deploy.

For a serious launch, also add signature-based verification so a score can't
be spoofed by hitting the API directly — `lib/store.js` is the place to add it.

## Project layout

```
server.js          Express API + Vite middleware (dev) / static dist (prod)
api/
  leaderboard.js   GET  /api/leaderboard — Vercel serverless function
  score.js         POST /api/score       — Vercel serverless function
lib/
  store.js         Shared leaderboard logic (Redis in prod, JSON file locally)
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
