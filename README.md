# Git Me Harder

Un juego web para aprender git: una terminal, misiones que te da tu jefa, compañeros que tocan el mismo repositorio que tú y un pipeline que tumba producción si subes un conflicto mal resuelto.

Todo corre en el navegador. No hay servidor ni git real: el juego trae su propio motor de git simulado.

*A browser game to learn git. Spanish and English, no backend.*

## Qué incluye

- **29 niveles en 7 capítulos**: lo básico, deshacer, ramas, stash, remotos, trabajo en equipo y avanzado (rebase, cherry-pick, tags, reflog).
- **Terminal** con historial (↑ ↓), autocompletado (Tab) y la salida que daría git.
- **Editor** con marcas de diff en el margen (verde añadido, ámbar modificado, rojo borrado), resaltado de conflictos y creación de archivos.
- **Modo manual** conmutable: con él apagado los cambios se aplican con un clic; encendido, escribes tú el código. Los niveles difíciles lo traen encendido.
- **"¿Qué es…?"**: explicaciones desde cero de cada concepto, con ejemplos que se envían a la terminal.
- **Grafo de commits** y una vista de lo que hay de verdad en el servidor, incluido lo que aún no descargaste.
- **Compañeros simulados** que suben commits a `main` o a tu rama en mitad de un nivel.
- **CI simulado** en los niveles difíciles: revisa marcadores de conflicto, sintaxis y unos tests que ejecutan tu código.
- **Modo libre** sin objetivos.
- Todos los niveles abiertos desde el inicio; el progreso se guarda en `localStorage`.

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

Las explicaciones de "¿Qué es…?" están en `src/levels/concepts.ts` y se asocian a cada nivel a partir de su lista `teaches`.

### Comandos soportados

`init`, `status`, `add`, `commit`, `log`, `diff`, `show`, `restore`, `reset`, `rm`, `revert`, `branch`, `switch`, `checkout`, `merge`, `rebase`, `cherry-pick`, `stash`, `tag`, `reflog`, `remote`, `clone`, `fetch`, `pull`, `push`, además de `ls`, `cat`, `touch`, `rm`, `echo "…" > archivo` y `clear`.

No hay rebase interactivo ni editor de mensajes: los commits necesitan `-m`.

## Créditos

La mascota es un dibujo propio en SVG ([src/ui/Mascot.tsx](src/ui/Mascot.tsx)) inspirado en el logo de Git de Jason Long (CC BY 3.0). Si algún día se encarga una ilustración, basta con reemplazar ese componente.

## Despliegue

`.github/workflows/deploy.yml` publica en GitHub Pages con cada push a `main`. En el repositorio de GitHub hay que elegir una vez **Settings → Pages → Source: GitHub Actions**.
