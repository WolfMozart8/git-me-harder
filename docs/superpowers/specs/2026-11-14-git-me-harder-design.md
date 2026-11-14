# Git Me Harder — juego web para aprender git

## Contexto

Se quiere una app web estática (GitHub Pages, sin servidor) para aprender git jugando: una terminal interactiva, niveles ordenados en un roadmap, misiones contadas por un jefe y compañeros, tips por nivel, un editor simple con diff en colores y un remoto simulado con compañeros que tocan el repo. La carpeta `d:\projects\git_me_harder` está vacía y no es repo git todavía.

Decisiones tomadas por el usuario:
- **Motor de git simulado propio** (no isomorphic-git).
- **Desktop primero**; en mobile debe verse y funcionar, sin optimizar la escritura.
- **Español + inglés** desde el inicio (los comandos y la salida de git quedan en inglés).
- Progreso en localStorage.
- El proyecto se desarrolla con git real, con commits pequeños y ordenados.

Decisiones mías (corregibles):
- Stack: Vite + React + TypeScript, Zustand para estado, Vitest para tests.
- Terminal propia (componente React con historial, flechas y autocompletado con Tab), no xterm.js: más fácil de estilizar y de usar en mobile.
- Editor: CodeMirror 6 con marcas en el margen (verde = agregado, ámbar = modificado, rojo = borrado) calculadas contra HEAD.
- Librerías auxiliares: `diff` (diff por líneas) y `node-diff3` (merge a tres vías con marcadores de conflicto).
- Estética: "escritorio de dev" oscuro con toques de juego (chat con avatares, misiones, mapa de niveles con candados).
- Validación de niveles por **estado del repo**, no por comando exacto, para aceptar varias soluciones.
- Fuera de alcance en esta versión: rebase interactivo, submódulos, cuentas/servidor, git real en el cliente.

## Arquitectura

```
src/
  engine/        Motor git puro en TS, sin DOM (testeable)
    repo.ts        Repository: commits, refs, HEAD, index, workdir, stash, reflog, estado de merge
    world.ts       World: repo local + remotos (otros Repository) + acciones de compañeros
    commands/      Un archivo por comando git (add, commit, merge, ...)
    shell.ts       Parser de línea de comandos + comandos de shell (ls, cat, touch, rm, clear, help)
    merge.ts, diff.ts, hash.ts, serialize.ts
  levels/        Niveles como datos
    types.ts       Level: setup, historia, objetivos, tips, eventos, solución
    chapters/      Un archivo por capítulo
    runner.ts      Evalúa objetivos y dispara eventos tras cada comando
  i18n/          Diccionarios es/en + hook t(); texto de niveles por idioma
  store/         Zustand: partida actual, progreso, idioma; persistencia en localStorage
  ui/            Terminal, Chat (jefe/compañeros), Objectives, Hints, Editor, CommitGraph (SVG), Roadmap
```

**Modelo del motor.** Cada commit guarda un snapshot completo `path → contenido`, padres, autor y mensaje. Los hashes son deterministas (derivados del contenido) para que los tests sean estables. `index` y `workdir` son mapas `path → contenido`. Todo el `World` se serializa a JSON.

**Remotos y compañeros.** `origin` es otro `Repository` dentro del `World`. `fetch`/`pull`/`push` copian commits entre repos y aplican las reglas reales (push rechazado si no es fast-forward, ramas de seguimiento). Un compañero es un guion: "cuando se cumpla X, commitea esto en `origin/rama`" y aparece un mensaje suyo en el chat.

**Nivel.** Cada nivel define: estado inicial (guion de acciones), mensajes de historia, objetivos (predicados sobre el `World`), tips progresivos (pista → explicación → comando ejemplo), eventos y una **solución** (lista de comandos) que se usa en los tests.

## Conflictos, edición de código y "CI" simulado

Pedido por el usuario: en los niveles difíciles, al querer subir cambios aparecen conflictos que hay que resolver con todo lo que implica en git, y un arreglo mal hecho debe tener consecuencias (el jefe te regaña, producción se cae). El jugador no necesita entender el código.

**Conflictos como en git real.** `merge`, `pull`, `rebase`, `cherry-pick` y `stash pop` pueden dejar el repo en estado de conflicto: el archivo queda con marcadores `<<<<<<<` / `=======` / `>>>>>>>`, `status` muestra "both modified", y hay que editar, hacer `add` y cerrar con `commit` (o `--continue`), o salir con `--abort`. El editor resalta cada bloque en conflicto.

**Dos modos de edición, según el nivel:**
- **Guiado** (niveles fáciles): la línea a cambiar aparece marcada con la corrección propuesta y un botón "aplicar"; en un conflicto, botones "aceptar el mío / el suyo / ambos". No hay que escribir código.
- **Manual** (niveles difíciles): se escribe a mano en el editor, sin botones. La misión dice qué debe quedar, pero no lo hace por ti.

**Sin compilador: archivos `.js` y un pipeline simulado.** Los archivos de los niveles son JavaScript, así que el navegador mismo sirve para comprobarlos. Al hacer `push` (o al cerrar el nivel) corre un "CI" con tres etapas, mostradas en la terminal y en el chat:
1. ¿Quedaron marcadores de conflicto?
2. ¿El archivo tiene sintaxis válida? (parser `acorn`, liviano)
3. Tests del nivel: unas pocas comprobaciones definidas por el nivel sobre el código resultante, ejecutadas en un Web Worker con límite de tiempo para que un bucle infinito no cuelgue la página.

**Consecuencias.** Si el CI falla, el push ya quedó hecho, igual que en la vida real: el jefe avisa de que producción se cayó, el nivel no se completa y hay que arreglarlo con un nuevo commit o con `revert`. En niveles fáciles el CI solo avisa antes de subir.

## Roadmap de niveles

1. **Lo básico:** init, status, add, commit, log, diff
2. **Deshacer:** restore, reset (soft/mixed/hard), revert, commit --amend, .gitignore
3. **Ramas:** branch, switch/checkout, merge (fast-forward y a tres vías), conflictos
4. **Stash:** stash, pop, apply, list, drop (ej.: "deja lo que estás haciendo, hay un bug")
5. **Remotos:** clone, remote, fetch, pull, push, push rechazado
6. **Trabajo en equipo:** compañero pushea a main, compañero toca tu rama, conflictos al hacer pull, hotfix urgente en producción
7. **Avanzado:** rebase, pull --rebase, cherry-pick, tag, reflog para recuperar trabajo

Además, un modo sandbox libre sin objetivos.

## Pasos de implementación

Cada paso termina jugable y con sus commits (Conventional Commits, rama `main`).

1. `git init`, guardar este diseño en `docs/superpowers/specs/2026-11-14-git-me-harder-design.md`, scaffold de Vite + React + TS + Vitest, i18n base.
2. Motor: repo, shell y comandos del capítulo 1, con TDD.
3. UI: terminal, layout de tres paneles (chat y objetivos | terminal | editor/grafo), sistema de niveles, tips, progreso en localStorage, pantalla de roadmap. Niveles del capítulo 1 en es/en.
4. Editor con diff en el margen, modo guiado ("cambia esta línea" + aplicar) y grafo de commits en SVG.
5. Capítulos 2 a 4: comandos del motor + niveles.
6. Remotos, guiones de compañeros, CI simulado con sus consecuencias, modo manual de edición y capítulos 5 y 6; el grafo muestra local y `origin`.
7. Capítulo 7 y modo sandbox.
8. Ajuste responsive para mobile, pulido visual, workflow de GitHub Actions para Pages (`base` configurado en `vite.config.ts`).

No se crea el repo en GitHub ni se hace push sin que el usuario lo pida.

## Verificación

- `npm test`: tests unitarios del motor por comando, más un test por nivel que ejecuta su solución y comprueba que todos los objetivos se cumplen (garantiza que cada nivel es superable).
- `npm run build` sin errores de TypeScript.
- `npm run dev` y jugar a mano al menos un nivel por capítulo: historia, tips, diff del editor, grafo, recarga de página conservando el progreso y cambio de idioma.
- Tests del CI simulado: un conflicto sin resolver, un archivo con error de sintaxis y una resolución incorrecta deben fallar cada uno en su etapa; la solución del nivel debe pasar.
- A mano: resolver mal un conflicto en un nivel difícil y comprobar que el push pasa, el CI falla, el jefe reacciona y el nivel se puede recuperar con un commit nuevo.
- Vista en ancho de celular con las devtools del navegador.
