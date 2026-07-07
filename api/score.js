import { validate, submitScore, isRateLimited } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?';
  try {
    if (await isRateLimited(String(ip).split(',')[0].trim())) {
      return res.status(429).json({ error: 'Slow down, partner.' });
    }

    const body = req.body || {};
    const err = validate(body);
    if (err) return res.status(400).json({ error: err });

    const { username, address, score, distance, coins } = body;
    const { best, rank } = await submitScore({ username, address, score, distance, coins });
    res.status(200).json({ ok: true, best, rank });
  } catch (err) {
    console.error('score submit failed:', err);
    res.status(500).json({ error: 'Could not submit score' });
  }
}
