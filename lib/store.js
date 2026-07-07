import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Leaderboard persistence, shared by the local dev server (server.js) and
 * the Vercel serverless functions (api/*.js).
 *
 * On Vercel, function instances are ephemeral and the filesystem is
 * read-only outside /tmp — a JSON file can't survive a cold start there.
 * So whenever Upstash Redis credentials are present (auto-injected by the
 * Vercel Redis/KV integration) we use that; otherwise we fall back to a
 * local JSON file, which is what local development uses.
 */

const USER_RE = /^[\w .\-]{3,20}$/;
const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana pubkey length

const useRedis = !!(
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
);

let redis = null;
if (useRedis) {
  const { Redis } = await import('@upstash/redis');
  redis = process.env.KV_REST_API_URL
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : Redis.fromEnv();
}

const REDIS_KEY = 'bullrun:players';

// ---------- file fallback (local dev only) ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.VERCEL
  ? '/tmp' // read-only fs elsewhere on Vercel; /tmp at least won't crash
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json');

function loadFile() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

let fileBoard = useRedis ? null : loadFile();
let saveTimer = null;
function saveFile() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(DB_FILE, JSON.stringify(fileBoard, null, 2), (err) => {
      if (err) console.error('leaderboard save failed:', err.message);
    });
  }, 250);
}

// ---------- validation ----------

export function validate({ username, address, score, distance, coins }) {
  if (typeof username !== 'string' || !USER_RE.test(username.trim())) {
    return 'Invalid username (3-20 chars, letters/numbers/space/._-).';
  }
  if (typeof address !== 'string' || !ADDR_RE.test(address.trim())) {
    return 'Invalid Solana address.';
  }
  const s = Math.floor(Number(score));
  const d = Math.floor(Number(distance));
  const c = Math.floor(Number(coins));
  if (!Number.isFinite(s) || s < 0 || s > 5_000_000) return 'Invalid score.';
  if (!Number.isFinite(d) || d < 0 || d > 1_000_000) return 'Invalid distance.';
  if (!Number.isFinite(c) || c < 0 || c > 100_000) return 'Invalid coins.';
  return null;
}

// ---------- reads ----------

async function allEntries() {
  if (useRedis) {
    const all = await redis.hgetall(REDIS_KEY);
    return all ? Object.values(all) : [];
  }
  return fileBoard;
}

export async function topBoard(limit = 100) {
  const board = await allEntries();
  return [...board]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e, i) => ({
      rank: i + 1,
      username: e.username,
      address: e.address,
      score: e.score,
      distance: e.distance,
      coins: e.coins,
      runs: e.runs,
      at: e.at,
    }));
}

// ---------- writes ----------

export async function submitScore({ username, address, score, distance, coins }) {
  const addr = address.trim();
  const name = username.trim();
  const s = Math.floor(Number(score));
  const d = Math.floor(Number(distance));
  const c = Math.floor(Number(coins));

  if (useRedis) {
    const existing = await redis.hget(REDIS_KEY, addr);
    const entry = existing || { address: addr, username: name, score: 0, distance: 0, coins: 0, runs: 0, at: 0 };
    entry.runs = (entry.runs || 0) + 1;
    entry.username = name;
    if (s > entry.score) {
      entry.score = s;
      entry.distance = d;
      entry.coins = c;
      entry.at = Date.now();
    }
    await redis.hset(REDIS_KEY, { [addr]: entry });
    const board = await allEntries();
    const rank = board.sort((a, b) => b.score - a.score).findIndex((e) => e.address === addr) + 1;
    return { best: entry.score, rank };
  }

  let entry = fileBoard.find((e) => e.address === addr);
  if (!entry) {
    entry = { address: addr, username: name, score: s, distance: d, coins: c, runs: 1, at: Date.now() };
    fileBoard.push(entry);
  } else {
    entry.runs += 1;
    entry.username = name;
    if (s > entry.score) {
      entry.score = s;
      entry.distance = d;
      entry.coins = c;
      entry.at = Date.now();
    }
  }
  saveFile();
  const rank = [...fileBoard].sort((a, b) => b.score - a.score).findIndex((e) => e.address === addr) + 1;
  return { best: entry.score, rank };
}

// ---------- rate limiting (per IP, 30 submissions / minute) ----------

const localHits = new Map();

export async function isRateLimited(ip) {
  if (useRedis) {
    const key = `bullrun:rl:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 60);
    return n > 30;
  }
  const now = Date.now();
  const rec = localHits.get(ip) || { start: now, n: 0 };
  if (now - rec.start > 60_000) {
    rec.start = now;
    rec.n = 0;
  }
  rec.n++;
  localHits.set(ip, rec);
  return rec.n > 30;
}

export const usingRedis = useRedis;
