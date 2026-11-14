# Git Me Harder

Un juego web para aprender git: una terminal, misiones que te da tu jefa, compañeros que tocan el mismo repositorio que tú y un pipeline que tumba producción si subes un conflicto mal resuelto.

Todo corre en el navegador. No hay servidor ni git real: el juego trae su propio motor de git simulado.

*A browser game to learn git. Spanish and English, no backend.*

## Qué incluye

- **29 niveles en 7 capítulos**: lo básico, deshacer, ramas, stash, remotos, trabajo en equipo y avanzado (rebase, cherry-pick, tags, reflog).
- **Terminal** con historial (↑ ↓), autocompletado (Tab) y la salida que daría git.
- **Editor** con marcas de diff en el margen (verde añadido, ámbar modificado, rojo borrado) y resaltado de conflictos.
- **Grafo de commits** y una vista de lo que hay de verdad en el servidor, incluido lo que aún no descargaste.
- **Compañeros simulados** que suben commits a `main` o a tu rama en mitad de un nivel.
- **CI simulado** en los niveles difíciles: revisa marcadores de conflicto, sintaxis y unos tests que ejecutan tu código.
- **Modo libre** sin objetivos.
- Progreso guardado en `localStorage`.

## Desarrollo

Requiere Node 20 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests del motor y de todos los niveles
npm run build    # comprobación de tipos + build en dist/
```

En Windows con Git Bash, entra a la carpeta con la letra de unidad en mayúscula (`cd /D/...`); con `/d/...` Vitest falla al arrancar.

## Estructura

```
src/
  engine/    Motor de git simulado, sin dependencias de UI
  levels/    Niveles como datos, runner de objetivos y CI simulado
  ui/        Componentes React (terminal, chat, editor, grafo, mapa)
  store.ts   Estado del juego (Zustand) y persistencia
  i18n.ts    Textos de la interfaz en español e inglés
```

### Añadir un nivel

Cada nivel es un objeto en `src/levels/chapters/`. Define el estado inicial (`setup`), los mensajes, los objetivos (funciones que inspeccionan el estado del repositorio, no los comandos escritos), las pistas y una `solution`. El test `src/levels/levels.test.ts` juega la solución de cada nivel y falla si alguno no se puede completar.

### Comandos soportados

`init`, `status`, `add`, `commit`, `log`, `diff`, `show`, `restore`, `reset`, `rm`, `revert`, `branch`, `switch`, `checkout`, `merge`, `rebase`, `cherry-pick`, `stash`, `tag`, `reflog`, `remote`, `clone`, `fetch`, `pull`, `push`, además de `ls`, `cat`, `touch`, `rm`, `echo "…" > archivo` y `clear`.

No hay rebase interactivo ni editor de mensajes: los commits necesitan `-m`.

## Despliegue

`.github/workflows/deploy.yml` publica en GitHub Pages con cada push a `main`. En el repositorio de GitHub hay que elegir una vez **Settings → Pages → Source: GitHub Actions**.
