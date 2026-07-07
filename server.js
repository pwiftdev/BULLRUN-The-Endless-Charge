import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

// ---------- leaderboard store (JSON file) ----------
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

let board = [];
try {
  board = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!Array.isArray(board)) board = [];
} catch {
  board = [];
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_FILE, JSON.stringify(board, null, 2), (err) => {
      if (err) console.error('leaderboard save failed:', err.message);
    });
  }, 250);
}

const USER_RE = /^[\w .\-]{3,20}$/;
const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana pubkey length

function sorted() {
  return [...board].sort((a, b) => b.score - a.score);
}

// ---------- naive per-IP rate limit ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { start: now, n: 0 };
  if (now - rec.start > 60_000) { rec.start = now; rec.n = 0; }
  rec.n++;
  hits.set(ip, rec);
  return rec.n > 30;
}

// ---------- app ----------
const app = express();
app.use(express.json({ limit: '10kb' }));

app.get('/api/leaderboard', (req, res) => {
  const top = sorted().slice(0, 100).map((e, i) => ({
    rank: i + 1,
    username: e.username,
    address: e.address,
    score: e.score,
    distance: e.distance,
    coins: e.coins,
    runs: e.runs,
    at: e.at,
  }));
  res.json(top);
});

app.post('/api/score', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  if (limited(String(ip))) return res.status(429).json({ error: 'Slow down, partner.' });

  const { username, address, score, distance, coins } = req.body || {};
  if (typeof username !== 'string' || !USER_RE.test(username.trim()))
    return res.status(400).json({ error: 'Invalid username (3-20 chars, letters/numbers/space/._-).' });
  if (typeof address !== 'string' || !ADDR_RE.test(address.trim()))
    return res.status(400).json({ error: 'Invalid Solana address.' });

  const s = Math.floor(Number(score));
  const d = Math.floor(Number(distance));
  const c = Math.floor(Number(coins));
  if (!Number.isFinite(s) || s < 0 || s > 5_000_000) return res.status(400).json({ error: 'Invalid score.' });
  if (!Number.isFinite(d) || d < 0 || d > 1_000_000) return res.status(400).json({ error: 'Invalid distance.' });
  if (!Number.isFinite(c) || c < 0 || c > 100_000) return res.status(400).json({ error: 'Invalid coins.' });

  const addr = address.trim();
  const name = username.trim();
  let entry = board.find((e) => e.address === addr);
  if (!entry) {
    entry = { address: addr, username: name, score: s, distance: d, coins: c, runs: 1, at: Date.now() };
    board.push(entry);
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
  save();

  const rank = sorted().findIndex((e) => e.address === addr) + 1;
  res.json({ ok: true, best: entry.score, rank });
});

// ---------- frontend ----------
if (PROD) {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.listen(PORT, () => console.log(`BULLRUN (production) → http://localhost:${PORT}`));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(PORT, () => console.log(`BULLRUN (dev) → http://localhost:${PORT}`));
}
