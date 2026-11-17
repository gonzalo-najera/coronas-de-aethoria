// Punto de entrada: pantalla de inicio y arranque de la partida.
import { startGame, bindGlobal, setTechName } from './ui/app';
import { showStart } from './ui/newgame';
import { techName } from './engine/economy';
import './ui/panels';
import './ui/modals';

setTechName(techName);
bindGlobal();
(window as any).__showStart = () => showStart(startGame);
showStart(startGame);
import { UI } from './ui/util';
(window as any).__aethoria = UI; // acceso de depuración desde la consola
