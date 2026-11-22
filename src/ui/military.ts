// Interfaz militar: enciclopedia de unidades, historial de regimientos y modernización.
import { UNIT, UNITS, ERAS, ATTRS, WEAPON, ARMOR, WEAPONS, ARMORS, ROLE_NAMES, TIERS, tierName, traits, firepower, UnitDef } from '../engine/milcat';
import { TECH, SPECIES, BIOMES, kingdomEra } from '../engine/data';
import { playerK, dateStr } from '../engine/game';
import { refitOptions, refit, regOf, unitWarnings, obsoleteBy, hasTechs, tierOf } from '../engine/equipment';
import { UI, act, esc, fmt, toast, HOOK } from './util';
import { openModal, renderModal } from './modals';
const n2 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('es');
void 0;

/** Línea compacta de atributos para listas (reclutamiento, ejército). */
export function unitLine(d: UnitDef) {
  return `Ataque ${n2(d.atk)} · pen. ${n2(d.rweapon ? d.rpen : d.pen)} · Defensa ${n2(d.def)} · armadura ${n2(d.armor)} · prot. proyectiles ${n2(d.mprot)}${d.ranged ? ` · Tiro ${n2(d.ranged)} (alcance ${d.range}, ${d.reload > 1 ? '1 cada ' + d.reload + ' pulsos' : 'cada pulso'}, ${d.ammo} descargas)` : ''}${d.antiCav >= 1.5 ? ' · anticarga ' + d.antiCav : ''}${d.charge ? ' · carga ' + n2(d.charge) : ''} · Moral ${d.morale} · Disciplina ${d.discipline} · Movilidad ${n2(d.speed)}`;
}
export const unitLink = (id: string, label?: string) => `<a data-act="enc" data-u="${id}">${esc(label || UNIT[id].name)}</a>`;
act('enc', d => openModal('enciclopedia', { u: d.u, era: UNIT[d.u!]?.era }));

// ---------------------------------------------------------------- Enciclopedia
interface EncArg { u?: string; era?: number; cmp?: string[]; tab?: 'unidades' | 'equipo'; }
export function encBody() {
  const g = UI.g!; const k = playerK(g); const A: EncArg = (UI.modalArg && typeof UI.modalArg === 'object') ? UI.modalArg : {}; UI.modalArg = A;
  const myEra = kingdomEra(k.techs); const era = A.era || myEra; A.era = era;
  const eraTabs = `<div class="tabs eras">${ERAS.map(e => `<button class="${e.id === era ? 'on' : ''} ${e.active ? '' : 'pend'}" data-act="encera" data-e="${e.id}" title="${esc(e.name + (e.active ? '' : ' — pendiente: ' + e.pending))}">${e.roman}</button>`).join('')}<button class="${A.tab === 'equipo' ? 'on' : ''}" data-act="enctab" data-t="equipo">Armas y protecciones</button></div>`;
  const E = ERAS[era - 1];
  if (A.tab === 'equipo') return eraTabs + equipTables();
  const head = `<p><b>Edad ${E.roman} · ${esc(E.name)}</b> — ${esc(E.desc)} ${era === myEra ? '<span class="pos">(edad militar actual de tu reino)</span>' : ''}</p>`;
  if (!E.active) return eraTabs + head + `<p class="warnbox">Pendiente: las unidades de esta edad llegarán en la ${esc(E.pending || '')}. El catálogo ya admite añadirlas sin cambiar el motor de batalla, pero todavía no hay ninguna disponible: no se muestran unidades decorativas.</p>`;
  const list = UNITS.filter(u => u.era === era);
  const sel = A.u && UNIT[A.u] ? A.u : list[0].id; A.u = sel;
  const rows = list.map(u => { const ok = hasTechs(k, u.id); const ob = obsoleteBy(k, u.id); return `<tr class="${u.id === sel ? 'on' : ''}"><td data-act="encsel" data-u="${u.id}">${esc(u.name)}${ob.length ? ' <small class="neg">obsoleta</small>' : ''}</td><td data-act="encsel" data-u="${u.id}"><small>${ROLE_NAMES[u.role]}</small></td><td class="${ok ? 'pos' : 'muted'}" data-act="encsel" data-u="${u.id}"><small>${ok ? 'disponible' : 'bloqueada'}</small></td><td><input type="checkbox" data-act-change="enccmp" data-u="${u.id}" ${(A.cmp || []).includes(u.id) ? 'checked' : ''} title="Comparar"></td></tr>`; }).join('');
  const cmp = (A.cmp || []).filter(x => UNIT[x]);
  return eraTabs + head + `<div class="enc"><div class="enclist"><table class="tbl clickable"><tr><th>Unidad</th><th>Función</th><th></th><th title="Marca dos o más para comparar">⇄</th></tr>${rows}</table>
    <p class="small muted">Marca ⇄ en dos o más unidades (de cualquier edad) para compararlas.</p></div>
    <div class="enccard">${cmp.length >= 2 ? compareTable(cmp) : unitCard(UNIT[sel])}</div></div>`;
}
act('encera', d => { const A = UI.modalArg as EncArg; A.era = +d.e!; A.u = undefined; A.tab = 'unidades'; renderModal(); });
act('enctab', d => { const A = UI.modalArg as EncArg; A.tab = d.t as any; renderModal(); });
act('encsel', d => { const A = UI.modalArg as EncArg; A.u = d.u; renderModal(); });
act('enccmp', (d, el) => { const A = UI.modalArg as EncArg; const c = new Set(A.cmp || []); if ((el as HTMLInputElement).checked) c.add(d.u!); else c.delete(d.u!); A.cmp = [...c]; renderModal(); });
act('enccmpclear', () => { (UI.modalArg as EncArg).cmp = []; renderModal(); });

function attrVal(d: UnitDef, i: number) { const a = ATTRS[i]; const v = a.get(d); if (v == null) return '<span class="muted" title="No aplica a esta unidad">— no aplica</span>'; if (a.key === 'terrain') return Object.entries(d.terrain).map(([b, m]) => `${esc((BIOMES as any)[b]?.name || b)} ${m! >= 1 ? '+' : ''}${Math.round((m! - 1) * 100)}%`).join(', '); return esc(a.fmt ? a.fmt(v) : n2(v)); }
function unitCard(d: UnitDef) {
  const k = playerK(UI.g!); const t = traits(d); const W = WEAPON[d.weapon], R = d.rweapon ? WEAPON[d.rweapon] : null, Ar = ARMOR[d.armorId];
  const techs = d.techs.length ? d.techs.map(x => `<span class="${k.techs.includes(x) ? 'pos' : 'neg'}">${esc(TECH[x]?.name || x)}</span>`).join(', ') : 'ninguna';
  const ob = obsoleteBy(k, d.id); const from = UNITS.filter(u => u.upgrades.includes(d.id));
  return `<h3>${esc(d.name)}</h3><p class="small muted">Edad ${ERAS[d.era - 1].roman} · ${ROLE_NAMES[d.role]}${d.species ? ' · ' + esc(SPECIES[d.species].plural) : ' · cualquier especie'}${d.needsBarracks ? ' · requiere cuartel' : ''}</p>
  <div class="encart">${unitIcon(d)}</div><p>${esc(d.desc)}</p>
  ${ob.length ? `<p class="warnbox">Obsoleta para tu reino: ya puedes formar ${ob.map(x => unitLink(x)).join(' o ')}. Puedes modernizar los regimientos existentes desde el panel del ejército sin perder su historial.</p>` : ''}
  <div class="kv"><span>Tecnologías</span><b>${techs}</b><span>Equipo</span><b>${esc(W.name)}${R ? ' + ' + esc(R.name) : ''} · ${esc(Ar.name)}${d.shield ? ' · escudo' : ''}</b><span>Coste (por 100)</span><b>◉${d.cost.oro} ⚔${n2(d.cost.armas)} (equipo estándar)</b><span>Mantenimiento</span><b>${d.upkeep} oro y ${d.food} alimentos al mes</b><span>Formación</span><b>${d.training ? d.training + ' meses de instrucción' : 'inmediata'}</b></div>
  <div class="cols2"><div><h4>Ventajas</h4><ul class="good">${t.pros.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div><div><h4>Vulnerabilidades</h4><ul class="bad">${t.cons.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div></div>
  <p class="small muted">Las ventajas son orientativas: el resultado depende también del terreno, la posición, la moral, la formación, la experiencia y el equipo.</p>
  <h4>Atributos</h4><table class="tbl sm">${ATTRS.map((a, i) => `<tr title="${esc(a.hint)}"><td>${esc(a.name)}</td><td>${attrVal(d, i)}</td></tr>`).join('')}</table>
  <h4>Niveles de equipo</h4><table class="tbl sm"><tr><th>Nivel</th><th>Efecto</th><th>Armas/100</th><th>Requisito</th></tr>${TIERS.map(T => `<tr><td>${T.name}</td><td>${T.stat < 1 ? '' : '+'}${Math.round((T.stat - 1) * 100)}% arma y protección</td><td>${n2(d.cost.armas * T.cost)}</td><td><small>${esc(T.req)}</small></td></tr>`).join('')}</table>
  <h4>Modernización</h4><p class="small">${d.upgrades.length ? 'Puede convertirse en ' + d.upgrades.map(x => unitLink(x)).join(', ') + ' conservando el 75% de su experiencia.' : 'Sin conversiones previstas en las edades disponibles.'}${from.length ? ' Procede de ' + from.map(u => unitLink(u.id)).join(', ') + '.' : ''}</p>
  <p class="small muted">Doctrinas compatibles: llegarán con el árbol de doctrinas (Fase 3).</p>`;
}
function compareTable(ids: string[]) {
  const ds = ids.map(x => UNIT[x]); const num = (i: number) => ds.map(d => ATTRS[i].get(d));
  const best = (i: number) => { const v = num(i).filter((x): x is number => x != null); const lowGood = ['food', 'ammoUse', 'cost', 'upkeep', 'training', 'logistics', 'fatigue'].includes(ATTRS[i].key); return v.length > 1 ? (lowGood ? Math.min(...v) : Math.max(...v)) : null; };
  return `<h3>Comparación</h3><button data-act="enccmpclear">Quitar comparación</button><div class="scrollx"><table class="tbl sm"><tr><th></th>${ds.map(d => `<th>${unitLink(d.id)}<br><small class="muted">Edad ${ERAS[d.era - 1].roman}</small></th>`).join('')}</tr>
  ${ATTRS.map((a, i) => { const b = best(i); return `<tr title="${esc(a.hint)}"><td>${esc(a.name)}</td>${ds.map(d => { const v = a.get(d); return `<td class="${v != null && v === b && a.key !== 'terrain' ? 'pos' : ''}">${attrVal(d, i)}</td>`; }).join('')}</tr>`; }).join('')}
  <tr><td>Ventajas</td>${ds.map(d => `<td><small>${traits(d).pros.map(esc).join('; ')}</small></td>`).join('')}</tr><tr><td>Vulnerabilidades</td>${ds.map(d => `<td><small>${traits(d).cons.map(esc).join('; ')}</small></td>`).join('')}</tr></table></div>`;
}
function equipTables() {
  const k = playerK(UI.g!); const has = (t?: string) => !t || k.techs.includes(t);
  return `<h4>Armamento</h4><div class="scrollx"><table class="tbl sm"><tr><th>Arma</th><th>Edad</th><th>Cuerpo a cuerpo</th><th>Penetración</th><th>Tiro</th><th>Alcance</th><th>Recarga</th><th>Descargas</th><th>Armas/100</th><th>Tecnología</th></tr>
  ${WEAPONS.map(x => `<tr><td title="${esc(x.desc)}">${esc(x.name)}</td><td>${ERAS[x.era - 1].roman}</td><td>${x.melee ?? '—'}</td><td>${x.pen}</td><td>${x.ranged ?? '—'}</td><td>${x.range ?? '—'}</td><td>${x.reload ?? '—'}</td><td>${x.ammo ?? '—'}</td><td>${x.cost}</td><td class="${has(x.tech) ? 'pos' : 'neg'}">${x.tech ? esc(TECH[x.tech]?.name || x.tech) : '—'}</td></tr>`).join('')}</table></div>
  <h4>Protecciones</h4><table class="tbl sm"><tr><th>Protección</th><th>Edad</th><th>Defensa</th><th>Armadura</th><th>Contra proyectiles</th><th>Peso (movilidad)</th><th>Armas/100</th><th>Tecnología</th></tr>
  ${ARMORS.map(x => `<tr><td title="${esc(x.desc)}">${esc(x.name)}</td><td>${ERAS[x.era - 1].roman}</td><td>${x.def}</td><td>${x.prot}</td><td>${x.mprot}</td><td>×${x.weight}</td><td>${x.cost}</td><td class="${has(x.tech) ? 'pos' : 'neg'}">${x.tech ? esc(TECH[x.tech]?.name || x.tech) : '—'}</td></tr>`).join('')}</table>
  <p class="small muted">El escudo añade +2 de defensa y +3 de protección contra proyectiles. La penetración se compara con la armadura del blanco: si la supera, el daño crece un 4% por punto; si no la alcanza, cae con rapidez.</p>`;
}
function unitIcon(d: UnitDef) {
  const col = d.species ? SPECIES[d.species].color : '#7a6a50'; const s = d.symbol;
  const body = s === 'cav' || s === 'scout' && d.cav ? '<path d="M18 44 L30 30 L52 30 L60 40 L54 44 M26 44 v8 M50 44 v8" />' : s === 'bow' ? '<path d="M40 14 Q58 34 40 54" /><path d="M40 14 L40 54" stroke-dasharray="2 2"/>' : s === 'pike' ? '<path d="M20 56 L56 12" /><path d="M52 12 l6 -2 -2 6" />' : s === 'giant' ? '<circle cx="38" cy="18" r="8"/><path d="M38 26 v22 M24 60 L38 46 L52 60 M22 34 h32" />' : s === 'siege' ? '<path d="M14 52 h48 M20 52 l18 -30 l18 30 M38 22 l-14 -8" /><circle cx="22" cy="56" r="4"/><circle cx="54" cy="56" r="4"/>' : s === 'shield' ? '<path d="M24 18 h28 v18 q0 14 -14 20 q-14 -6 -14 -20 z" />' : s === 'heavy' ? '<path d="M22 20 l10 6 l10 -6 l10 6 v20 l-20 10 l-20 -10 z" />' : '<path d="M38 12 v40 M30 20 h16" /><circle cx="38" cy="58" r="3"/>';
  return `<svg viewBox="0 0 76 70" width="110" height="100" role="img" aria-label="${esc(d.name)}"><rect x="2" y="2" width="72" height="66" rx="8" fill="${col}" opacity=".18"/><g fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</g><text x="66" y="64" font-size="11" text-anchor="end" fill="${col}">${ERAS[d.era - 1].roman}</text></svg>`;
}

// ---------------------------------------------------------------- Regimientos
export function regBody() {
  const g = UI.g!; const r = (g.regiments || []).find(x => x.id === UI.modalArg); if (!r) return '<p>Regimiento desconocido.</p>';
  const K = g.kingdoms[r.owner]; const where = g.armies.find(a => a.units.some(u => u.rid === r.id));
  const u = where?.units.find(x => x.rid === r.id);
  return `<div class="reg"><div class="banner">${banner(r.banner, K.color)}</div><div><h3>${esc(r.name)}</h3><p class="small muted">${esc(K.name)} · fundado en ${dateStr(r.founded)} · ${r.active ? 'en servicio' : 'disuelto'}</p>
  <div class="kv"><span>Función actual</span><b>${unitLink(r.type)}</b>${u ? `<span>Efectivos</span><b>${fmt(u.men)}</b><span>Equipo</span><b>${tierName(tierOf(u))}</b><span>Experiencia</span><b>${Math.round(u.exp * 100)}%</b><span>Destinado en</span><b>${esc(where!.name)}</b>` : ''}<span>Batallas</span><b>${r.battles} (${r.wins} victorias, ${r.losses} derrotas)</b><span>Bajas históricas</span><b>${fmt(r.casualties)}</b><span>Comandantes</span><b>${r.commanders.map(esc).join(', ') || '—'}</b><span>Condecoraciones</span><b>${r.decorations.map(d => '✦ ' + esc(d)).join('<br>') || '—'}</b></div></div></div>
  <h4>Historial</h4><ul class="log">${r.history.slice().reverse().map(h => `<li><small>${dateStr(h.turn)}</small> ${esc(h.text)}</li>`).join('')}</ul>`;
}
/** Qué deja obsoleto una tecnología (unidades que pasan a tener sucesoras disponibles). */
export function techObsoletes(techId: string, known: string[]) { const after = [...known, techId]; const can = (id: string) => UNIT[id].techs.every(t => after.includes(t)); const before = (id: string) => UNIT[id].techs.every(t => known.includes(t));
  return UNITS.filter(u => u.obsoleteBy.some(x => can(x) && !before(x))).map(u => u.id); }
function banner(seed: number, color: string) { const sh = seed % 3, ch = (seed >> 2) % 4; const charge = ['<circle cx="30" cy="34" r="8"/>', '<path d="M30 22 L38 42 L22 42 Z"/>', '<path d="M20 34 h20 M30 24 v20" stroke-width="5"/>', '<rect x="22" y="26" width="16" height="16"/>'][ch];
  return `<svg viewBox="0 0 60 80" width="60" height="80"><path d="M6 4 h48 v${sh === 0 ? 60 : 52} ${sh === 1 ? 'l-24 16 l-24 -16' : sh === 2 ? 'l-12 10 l-12 -10 l-12 10 l-12 -10' : 'h-48'} z" fill="${color}" stroke="#3b2a18" stroke-width="2"/><g fill="#f3e6c4" stroke="#f3e6c4">${charge}</g></svg>`; }
act('reg', d => openModal('regimiento', +d.id!));

// ---------------------------------------------------------------- Tabla de unidades del ejército con modernización
export function armyUnitsTable(armyId: number) {
  const g = UI.g!, w = UI.w!; const a = g.armies.find(x => x.id === armyId)!; const k = g.kingdoms[a.owner];
  const open = (UI as any).refitOpen as string | undefined;
  return `<table class="tbl sm units"><tr><th>Regimiento</th><th>Efectivos</th><th>Exp.</th><th>Equipo</th></tr>${a.units.map((u, i) => {
    const d = UNIT[u.type]; const r = regOf(g, u); const warn = unitWarnings(k, u); const key = a.id + ':' + i;
    const opts = open === key ? refitOptions(w, g, a, u) : [];
    const extra = [d.ammo ? 'munición ' + Math.round((u.amm ?? 1) * 100) + '%' : '', a.wounded[u.type] ? fmt(a.wounded[u.type]) + ' heridos' : ''].filter(Boolean).join(' · ');
    return `<tr><td>${unitLink(u.type)}${r ? `<br><small><a data-act="reg" data-id="${r.id}">${esc(r.name)}</a>${r.decorations.length ? ' ✦' + r.decorations.length : ''}</small>` : ''}${extra ? `<br><small class="muted">${extra}</small>` : ''}${warn.length ? `<br><small class="neg">${warn.map(esc).join(' · ')}</small>` : ''}<br><button class="sm" data-act="refitopen" data-k="${key}" title="Reequipar o convertir conservando el regimiento">${open === key ? 'Cerrar' : 'Modernizar…'}</button></td><td>${fmt(u.men)}</td><td>${Math.round(u.exp * 100)}%</td><td>${tierName(tierOf(u))}</td></tr>
    ${open === key ? `<tr><td colspan="4"><div class="refit">${opts.length ? opts.map((o, j) => `<div class="bld ${o.why.length ? 'dis' : ''}"><div><b>${esc(o.label)}</b> <small class="muted">equipo ${tierName(o.tier).toLowerCase()}</small><br><small>⚔${fmt(o.arms)} armas · ◉${fmt(o.gold)} oro · ${o.months} mes(es) de instrucción · experiencia ${Math.round(u.exp * 100)}% → ${Math.round(o.exp * 100)}%</small>${o.why.length ? `<br><small class="neg">${o.why.map(esc).join(' · ')}</small>` : ''}</div><button data-act="refitdo" data-a="${a.id}" data-i="${i}" data-j="${j}" ${o.why.length || k.stock.armas < o.arms || k.stock.oro < o.gold ? 'disabled' : ''}>Aplicar</button></div>`).join('') : '<p class="small muted">No hay mejoras disponibles: investiga nuevas técnicas o construye una herrería o armería en la provincia.</p>'}</div></td></tr>` : ''}`; }).join('')}</table>`;
}
act('refitopen', d => { (UI as any).refitOpen = (UI as any).refitOpen === d.k ? undefined : d.k; HOOK.refresh(); });
act('refitdo', d => { const g = UI.g!; const a = g.armies.find(x => x.id === +d.a!); if (!a) return; const u = a.units[+d.i!]; if (!u) return; const o = refitOptions(UI.w!, g, a, u)[+d.j!]; if (!o) return; const err = refit(UI.w!, g, a, u, o); if (err) toast(err, 'critica'); else { toast(`${o.label}: hecho. El regimiento conserva su nombre e historial.`, 'completado'); (UI as any).refitOpen = undefined; } HOOK.refresh(); });

/** Avisos de obsolescencia del reino (para el informe del ejército). */
export function obsolescenceSummary() {
  const g = UI.g!; const k = playerK(g); const items: string[] = [];
  for (const a of g.armies) if (a.owner === k.id) for (const u of a.units) { const ob = obsoleteBy(k, u.type); if (ob.length) { const r = regOf(g, u); items.push(`${r ? esc(r.name) : esc(UNIT[u.type].name)} (${esc(a.name)}): puede convertirse en ${ob.map(x => unitLink(x)).join(' o ')}`); } }
  return items;
}
export function eraLine() { const k = playerK(UI.g!); const e = ERAS[kingdomEra(k.techs) - 1]; return `Edad militar: <b>${e.roman} · ${esc(e.name)}</b>`; }
void firepower;
