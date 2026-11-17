// Pantalla de inicio: nueva partida (reino, monarca, especie, color, dificultad, semilla) y carga de partidas guardadas.
import { KINGDOMS, SPECIES, SPECIES_IDS, TYPE_NAMES, PERSONALITY_NAMES, CONTINENTS, GAME_TITLE } from '../engine/data';
import type { SpeciesId, Kingdom } from '../engine/types';
import { newGame } from '../engine/game';
import { listSaves, loadGame, deleteSave, importGame, SaveMeta } from '../engine/save';
import { act, $, esc, toast, ask } from './util';
import { heraldry } from './art';

let pick = 0; let saves: SaveMeta[] = [];
const majors = KINGDOMS.map((k, i) => ({ k, i })).filter(x => !x.k.independent);
function fakeK(i: number): Kingdom { const t = KINGDOMS[i]; return { id: i, name: t.name, short: t.short, color: t.color, color2: t.color2, heraldry: { shape: i % 4, charge: (i * 7) % 9 } } as any; }
export async function showStart(starter: (w: any, g: any) => void) {
  (window as any).__startGame = starter; $('#app').hidden = true; const el = $('#start'); el.hidden = false;
  try { saves = await listSaves(); } catch { saves = []; }
  render();
}
function topSpecies(i: number): SpeciesId { const sp = KINGDOMS[i].species; return (Object.entries(sp).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]) as SpeciesId; }
function render() {
  const t = KINGDOMS[pick] ? KINGDOMS[pick] : KINGDOMS[0]; const el = $('#start'); const sp = topSpecies(pick);
  el.innerHTML = `<div class="start-wrap"><div class="start-title"><h1>${GAME_TITLE}</h1><p>Estrategia medieval fantástica · un mundo persistente por descubrir</p></div>
  <div class="start-grid">
   <section class="card"><h2>Nueva partida</h2>
    <div class="kpick">${majors.map(({ k, i }) => `<button class="${pick === i ? 'on' : ''}" data-act="pickk" data-i="${i}" style="--kc:${k.color}">${heraldry(fakeK(i), 30)}<span>${esc(k.short)}</span></button>`).join('')}</div>
    <div class="kdesc"><h3>${esc(t.name)}</h3><p class="small">${TYPE_NAMES[t.type]} · ${PERSONALITY_NAMES[t.personality]} · ${esc(CONTINENTS[t.continent])}</p><p>${esc(t.desc)}</p>
      <p class="small">Pueblos: ${Object.entries(t.species).filter(x => (x[1] as number) >= 5).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([s, v]) => `${SPECIES[s as SpeciesId].plural} ${v}%`).join(' · ')}</p>${t.continent === 4 ? '<p class="small neg">Reino aislado en un continente que los demás desconocen: partida exigente.</p>' : ''}</div>
    <div class="form">
     <label>Nombre del monarca <input id="ng-ruler" placeholder="(generado al azar)"></label>
     <label>Especie del monarca <select id="ng-sp">${SPECIES_IDS.map(s => `<option value="${s}" ${s === sp ? 'selected' : ''}>${SPECIES[s].name}</option>`).join('')}</select></label>
     <label>Color del reino <input id="ng-color" type="color" value="${t.color}"></label>
     <label>Dificultad <select id="ng-diff"><option value="0">Fácil</option><option value="1" selected>Normal</option><option value="2">Difícil</option></select></label>
     <label>Semilla del mundo <input id="ng-seed" type="number" value="1347" title="La geografía diseñada corresponde a la semilla 1347"></label>
     <label>Nombre de la partida <input id="ng-name" value="Crónica de ${esc(t.short)}"></label>
    </div>
    <p class="small muted">Con la misma semilla el mundo es siempre idéntico. Tu reino solo conoce al principio sus tierras y las vecinas; el resto del mapa está por explorar.</p>
    <button class="primary big" data-act="ngstart">Comenzar el reinado</button>
   </section>
   <section class="card"><h2>Continuar</h2>
    ${saves.length ? `<table class="tbl">${saves.map(s => `<tr><td><b>${esc(s.name)}</b><br><small>${esc(s.kingdom)} · ${esc(s.date)}</small><br><small class="muted">${new Date(s.savedAt).toLocaleString('es')}</small></td><td class="nowrap"><button data-act="ngload" data-s="${s.slot}">Cargar</button><button class="mini danger" data-act="ngdel" data-s="${s.slot}">×</button></td></tr>`).join('')}</table>` : '<p class="muted">No hay partidas guardadas en este navegador.</p>'}
    <label class="btn">Importar archivo de partida<input type="file" accept=".json,application/json" data-act-change="ngimport" hidden></label>
    <h3>Cómo se juega</h3><ul class="small"><li>Cada turno es un mes. Gestiona provincias, construye, investiga y recluta.</li><li>El Atlas tiene capas (político, economía, recursos, suministros…) y niebla: solo ves lo que tu reino conoce.</li><li>Envía expediciones para descubrir tierras, reinos y lugares donde fundar colonias.</li><li>Las batallas se dirigen en un campo táctico: reconocimiento, despliegue y órdenes por fases.</li></ul>
   </section></div><div id="ng-busy" hidden><div>Trazando los mapas del mundo…</div></div></div>`;
}
act('pickk', d => { pick = +d.i!; render(); });
act('ngstart', () => {
  const busy = $('#ng-busy'); busy.hidden = false;
  setTimeout(() => { try {
    const ruler = ($<HTMLInputElement>('#ng-ruler').value || '').trim(); const t = KINGDOMS[pick];
    const { w, g } = newGame({ seed: +$<HTMLInputElement>('#ng-seed').value || 1347, player: pick, rulerName: ruler || undefined, rulerSpecies: $<HTMLSelectElement>('#ng-sp').value as SpeciesId, color: $<HTMLInputElement>('#ng-color').value, difficulty: +$<HTMLSelectElement>('#ng-diff').value, gameName: $<HTMLInputElement>('#ng-name').value || 'Crónica de ' + t.short });
    (window as any).__startGame(w, g);
  } catch (e) { console.error(e); busy.hidden = true; toast('Error al crear el mundo: ' + (e as Error).message, 'critica'); } }, 40);
});
act('ngload', async d => { const busy = $('#ng-busy'); busy.hidden = false; try { const { g, w } = await loadGame(d.s!); (window as any).__startGame(w, g); } catch (e) { busy.hidden = true; toast('No se pudo cargar: ' + (e as Error).message, 'critica'); } });
act('ngdel', async d => { if (!(await ask('¿Borrar esta partida?', 'Borrar'))) return; await deleteSave(d.s!); saves = await listSaves(); render(); });
act('ngimport', (d, el) => { const f = (el as HTMLInputElement).files?.[0]; if (!f) return; f.text().then(t => { try { const { g, w } = importGame(t); (window as any).__startGame(w, g); } catch (e) { toast('Archivo no válido: ' + (e as Error).message, 'critica'); } }); });
