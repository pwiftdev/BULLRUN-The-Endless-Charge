import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game(document.getElementById('game'));
new UI(game);
