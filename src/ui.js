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
    this.board = $('leaderboard');
    this.hudEl = $('hud');
    this.toastEl = $('toast');
    this.toastTimer = null;
    this.lastHud = 0;
    this.rows = [];

    // Restore saved rider.
    try {
      const saved = JSON.parse(localStorage.getItem('bullrun.rider') || 'null');
      if (saved) {
        $('in-user').value = saved.username || '';
        $('in-addr').value = saved.address || '';
        this.rider = saved;
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
      this.loadPreview('lb-menu');
    });
    $('mute').addEventListener('click', () => {
      this.game.audio.init();
      const on = this.game.audio.toggle();
      $('mute').textContent = on ? '🔊' : '🔇';
    });

    // Full leaderboard screen.
    $('btn-open-lb').addEventListener('click', () => this.openBoard());
    $('btn-lb-close').addEventListener('click', () => this.board.classList.add('hidden'));
    $('lb-refresh').addEventListener('click', () => this.loadFullBoard(true));
    this.board.addEventListener('click', (e) => {
      if (e.target === this.board) this.board.classList.add('hidden');
      const btn = e.target.closest('.copy-btn');
      if (btn) this.copyWallet(btn);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.board.classList.contains('hidden')) {
        this.board.classList.add('hidden');
      }
    });

    this.loadPreview('lb-menu');
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
    this.loadPreview('lb-dead');
  }

  /* ---------- compact top-3/10 preview ---------- */

  async loadPreview(listId) {
    const ol = $(listId);
    try {
      this.rows = await (await fetch('/api/leaderboard')).json();
      if (!this.rows.length) {
        ol.innerHTML = '<li class="empty">No runs yet. Be the first legend.</li>';
        return;
      }
      ol.innerHTML = this.rows.slice(0, 5).map((r) => `
        <li>
          <span class="rk">${medals[r.rank - 1] || r.rank}</span>
          <span class="nm">${escapeHtml(r.username)}</span>
          <span class="sc">${r.score.toLocaleString()}</span>
        </li>`).join('');
    } catch {
      ol.innerHTML = '<li class="empty">Leaderboard is offline.</li>';
    }
  }

  /* ---------- full leaderboard screen ---------- */

  openBoard() {
    this.game.audio.init();
    this.board.classList.remove('hidden');
    this.loadFullBoard();
  }

  async loadFullBoard(force) {
    const el = $('lb-full');
    if (force) el.innerHTML = '<div class="lb-state">Refreshing…</div>';
    try {
      this.rows = await (await fetch('/api/leaderboard')).json();
      if (!this.rows.length) {
        el.innerHTML = '<div class="lb-state">No runs yet — be the first legend on the board.</div>';
        return;
      }
      const mine = this.rider ? this.rider.address : null;
      el.innerHTML = this.rows.map((r, i) => {
        const rank = medals[r.rank - 1] || `#${r.rank}`;
        const isMe = r.address === mine;
        const runs = r.runs ? `<small>${r.runs} run${r.runs === 1 ? '' : 's'}</small>` : '';
        return `
          <div class="lb-row ${r.rank <= 3 ? 'top' : ''} ${isMe ? 'me' : ''}" style="animation-delay:${Math.min(i, 12) * 24}ms">
            <span class="r-rk">${rank}</span>
            <span class="r-name">
              <span class="u">${escapeHtml(r.username)}${isMe ? '<span class="youtag">YOU</span>' : ''}</span>
            </span>
            <span class="wallet">
              <code>${short(r.address)}</code>
              <button class="copy-btn" data-addr="${escapeHtml(r.address)}" title="Copy full address">⧉</button>
            </span>
            <span class="r-sc">${r.score.toLocaleString()}${runs}</span>
          </div>`;
      }).join('');
    } catch {
      el.innerHTML = '<div class="lb-state">Leaderboard is offline.</div>';
    }
  }

  async copyWallet(btn) {
    const addr = btn.dataset.addr;
    try {
      await navigator.clipboard.writeText(addr);
    } catch {
      // Fallback for insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = addr;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('done');
    }, 1200);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
