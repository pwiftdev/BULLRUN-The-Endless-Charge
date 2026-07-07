const USER_RE = /^[\w .\-]{3,20}$/;
const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const $ = (id) => document.getElementById(id);
const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const medals = ['🥇', '🥈', '🥉'];

export class UI {
  constructor(game) {
    this.game = game;
    game.ui = this;

    this.menu = $('menu');
    this.dead = $('dead');
    this.hudEl = $('hud');
    this.toastEl = $('toast');
    this.toastTimer = null;
    this.lastHud = 0;

    // Restore saved rider.
    try {
      const saved = JSON.parse(localStorage.getItem('bullrun.rider') || 'null');
      if (saved) {
        $('in-user').value = saved.username || '';
        $('in-addr').value = saved.address || '';
      }
    } catch { /* ignore */ }

    $('signup').addEventListener('submit', (e) => {
      e.preventDefault();
      this.trySaddleUp();
    });
    $('btn-again').addEventListener('click', () => {
      this.dead.classList.add('hidden');
      this.hudEl.classList.remove('hidden');
      this.game.begin();
    });
    $('btn-menu').addEventListener('click', () => {
      this.dead.classList.add('hidden');
      this.hudEl.classList.add('hidden');
      this.menu.classList.remove('hidden');
      this.game.toMenu();
      this.loadLeaderboard('lb-menu');
    });
    $('mute').addEventListener('click', () => {
      this.game.audio.init();
      const on = this.game.audio.toggle();
      $('mute').textContent = on ? '🔊' : '🔇';
    });

    this.loadLeaderboard('lb-menu');
  }

  trySaddleUp() {
    const username = $('in-user').value.trim();
    const address = $('in-addr').value.trim();
    const err = $('signup-err');
    if (!USER_RE.test(username)) {
      err.textContent = 'Rider name: 3–20 chars (letters, numbers, space, . _ -).';
      return;
    }
    if (!ADDR_RE.test(address)) {
      err.textContent = 'That doesn\'t look like a Solana address, partner.';
      return;
    }
    err.textContent = '';
    this.rider = { username, address };
    localStorage.setItem('bullrun.rider', JSON.stringify(this.rider));

    this.game.audio.init(); // unlock audio on user gesture
    this.menu.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    this.game.begin();
  }

  /* ---------- HUD ---------- */

  hud(score, coins, distance, speed) {
    const now = performance.now();
    if (now - this.lastHud < 80) return; // throttle DOM writes
    this.lastHud = now;
    $('hud-score').textContent = score.toLocaleString();
    $('hud-coins').textContent = `🪙 ${coins}`;
    $('hud-dist').textContent = `${Math.floor(distance)} m`;
    $('hud-speed').textContent = `${Math.round(speed * 2.237)} mph`;
  }

  toast(text) {
    clearTimeout(this.toastTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  /* ---------- game over ---------- */

  async onGameOver({ score, distance, coins }) {
    this.hudEl.classList.add('hidden');
    this.dead.classList.remove('hidden');
    $('dead-score').textContent = score.toLocaleString();
    $('dead-dist').textContent = `${distance} m`;
    $('dead-coins').textContent = `🪙 ${coins}`;

    const bestKey = 'bullrun.best';
    const prevBest = Number(localStorage.getItem(bestKey) || 0);
    const best = Math.max(prevBest, score);
    localStorage.setItem(bestKey, String(best));
    $('dead-best').textContent = `Best: ${best.toLocaleString()}`;

    const status = $('submit-status');
    status.style.color = '';
    if (!this.rider) {
      status.textContent = 'No rider signed in — score not submitted.';
      return;
    }
    status.textContent = 'Carving your score into the board…';
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.rider, score, distance, coins }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      status.textContent = score >= data.best
        ? `🏆 New personal best — rank #${data.rank}!`
        : `Submitted. Your best is ${data.best.toLocaleString()} (rank #${data.rank}).`;
    } catch (e) {
      status.style.color = '#a63c2e';
      status.textContent = `Couldn't reach the leaderboard: ${e.message}`;
    }
    this.loadLeaderboard('lb-dead');
  }

  /* ---------- leaderboard ---------- */

  async loadLeaderboard(listId) {
    const ol = $(listId);
    try {
      const res = await fetch('/api/leaderboard');
      const rows = await res.json();
      if (!rows.length) {
        ol.innerHTML = '<li class="empty">No runs yet. Be the first legend.</li>';
        return;
      }
      ol.innerHTML = rows.slice(0, 10).map((r) => `
        <li>
          <span class="rk">${medals[r.rank - 1] || r.rank}</span>
          <span class="nm">${escapeHtml(r.username)}</span>
          <span class="ad">${short(r.address)}</span>
          <span class="sc">${r.score.toLocaleString()}</span>
        </li>`).join('');
    } catch {
      ol.innerHTML = '<li class="empty">Leaderboard is offline.</li>';
    }
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
