import { topBoard } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const rows = await topBoard(100);
    res.status(200).json(rows);
  } catch (err) {
    console.error('leaderboard fetch failed:', err);
    res.status(500).json({ error: 'Leaderboard unavailable' });
  }
}
