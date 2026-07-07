import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game(document.getElementById('game'));
new UI(game);

// Debug handle (harmless): tweak from the console, e.g. window.BULLRUN.distance = 900
window.BULLRUN = game;

// Dismiss the preloader once the scene is built, fonts are ready, and the
// logo has decoded — with a small floor so it reads as an intro, not a flash.
(() => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  const started = performance.now();

  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const logo = new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = '/bullrunlogo.jpeg';
  });
  // Let the game render a couple of real frames behind the loader first.
  const firstFrames = new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );

  Promise.all([fonts, logo, firstFrames]).then(() => {
    const wait = Math.max(0, 700 - (performance.now() - started));
    setTimeout(() => {
      loader.classList.add('done');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }, wait);
  });
})();
