import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topBoard, submitScore, validate, isRateLimited } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

// ---------- app ----------
// Leaderboard persistence lives in lib/store.js, shared with the Vercel
// serverless functions in api/*.js — see that file for the storage story.
const app = express();
app.use(express.json({ limit: '10kb' }));

app.get('/api/leaderboard', async (req, res) => {
  try {
    res.json(await topBoard(100));
  } catch (err) {
    console.error('leaderboard fetch failed:', err);
    res.status(500).json({ error: 'Leaderboard unavailable' });
  }
});

app.post('/api/score', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  try {
    if (await isRateLimited(String(ip))) {
      return res.status(429).json({ error: 'Slow down, partner.' });
    }

    const body = req.body || {};
    const err = validate(body);
    if (err) return res.status(400).json({ error: err });

    const { username, address, score, distance, coins } = body;
    const { best, rank } = await submitScore({ username, address, score, distance, coins });
    res.json({ ok: true, best, rank });
  } catch (err) {
    console.error('score submit failed:', err);
    res.status(500).json({ error: 'Could not submit score' });
  }
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
