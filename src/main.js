import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game(document.getElementById('game'));
new UI(game);

// Debug handle (harmless): tweak from the console, e.g. window.BULLRUN.distance = 900
window.BULLRUN = game;
