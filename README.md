# Coronas de Aethoria · primera versión jugable

Juego de estrategia medieval fantástica por turnos (un turno = un mes) en el navegador. Todo el contenido es original: nombres, mapa, reinos, especies, ilustraciones y reglas.

## Cómo jugar
- **En línea:** https://gonzalo-najera.github.io/coronas-de-aethoria/ (se publica sola con cada cambio en `main`).
- **Sin conexión:** `npm run build` genera `dist/index.html`, un único archivo (≈330 KB) que se abre con doble clic en Chrome, Edge o Firefox. Las partidas se guardan en el navegador (IndexedDB); usa *Partida → Exportar* para tener copia en un archivo.
- **Desde el código:** `npm install`, después `npm run dev` (desarrollo) o `npm run build` (genera `dist/index.html`, un único archivo).
- Pruebas del motor: `./run.sh tests/sim.test.ts` simula 120 meses, guarda, valida y comprueba que la simulación es reproducible.

Controles: arrastrar para mover el mapa, rueda para el zoom, clic para seleccionar, clic derecho con un ejército seleccionado para fijar el destino, barra espaciadora para avanzar un mes, Esc para cancelar.

## Arquitectura
`src/engine` (sin dependencias del navegador, se puede probar en Node):
- `world.ts`: genera la geografía de forma determinista a partir de la semilla (1347 = mundo diseñado): 8 masas de tierra, relieve, ríos, lagos, biomas, 234 provincias y 103 regiones marítimas. La geografía no se guarda: se regenera y se comprueba con un hash.
- `game.ts`: estado de la partida, conocimiento por reino (desconocido, cartografiado, explorado con información antigua, visible y propio) y contactos.
- `economy.ts`: producción y consumo con desgloses (la interfaz muestra exactamente lo que calcula el turno), edificios, investigación, mercado, estabilidad, prosperidad y suministros.
- `military.ts`: reclutamiento, rutas, movimiento, logística, asedios y asaltos.
- `battle.ts`: motor táctico 2D por fases (reconocimiento, despliegue, órdenes, intensidad, frente, flancos, cargas, moral y huida). La IA, la resolución automática y la delegación usan el mismo motor.
- `diplomacy.ts`, `exploration.ts`, `events.ts`, `ai.ts`, `turn.ts` (orden del turno) y `save.ts` (IndexedDB, ranuras, autoguardado con copia anterior, versionado y validación).

`src/ui`: Atlas en canvas con 13 capas y niebla de pergamino, paneles, ventanas, vista táctica, y retratos, escudos y vistas de ciudad en SVG generados.

## Sistema militar (ampliación, fase 1)

- **Catálogo modular** en `src/engine/milcat.ts`: edades, armas, protecciones y tipos de unidad. Las estadísticas de cada unidad se derivan de su base (especie e instrucción), su arma, su protección y su nivel de equipo, así que añadir contenido es añadir filas a esas tablas.
- **27 tipos de unidad** de las edades I y II, con **28 atributos independientes**. Los que no se aplican, como el combustible de un arquero, aparecen como «no aplica».
- **Combate**:
  - La penetración se compara con la armadura del blanco.
  - Los tiradores tienen munición limitada y cadencia propia. Los ballesteros defienden peor mientras recargan.
  - Las cargas pierden fuerza en bosques y pantanos.
  - Un blanco trabado con tropas propias recibe más daño de tiro.
- **Estado de las tropas**:
  - La disciplina, la resistencia física, la ocultación y el reconocimiento tienen efecto real.
  - Las tropas recién reclutadas pasan meses en instrucción.
- **Equipo y regimientos**:
  - Hay niveles de equipo de Obsoleto a De élite, que dependen de la herrería, la armería y las técnicas.
  - Los regimientos guardan su historial, sus batallas, sus comandantes y sus condecoraciones.
  - Modernizar un regimiento conserva su nombre y el 75% de su experiencia.
- **Partidas guardadas**: las de la versión 1 se convierten solas a la versión 2.
- **Simulaciones de equilibrio**: `npm run test:balance` ejecuta enfrentamientos automáticos con el mismo motor del juego. Sale con error si alguna comprobación falla.

## Criterios de aceptación (sección 35)
Todos se han comprobado jugando en Chromium automatizado: iniciar partida, elegir reino, Atlas, seleccionar provincias, producción y población, construir con recursos reales, ver la obra (andamios y después el edificio en el mapa y en la vista de ciudad), avanzar el tiempo, investigar, reclutar, mover ejércitos con ruta y riesgos, suministros, despliegue, órdenes por fases, bajas persistentes, expediciones, descubrimiento y niebla, diplomacia con motivos y contraofertas, IA autónoma (guerras, tratados, colonias y expediciones propias), guardar y cargar.

## Pendiente (también se indica dentro del juego, en Partida)
Ampliación militar, fases 2 a 5 (producción militar, plantillas, pólvora, doctrinas, coordinación entre armas, armada, edades III a XII y aviación); flotas y batallas navales; rutas comerciales dibujadas; matrimonios e intrigas; religión y cultura; asedios tácticos; más mundos diseñados a mano; sonido.
