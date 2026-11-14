import { isAncestor } from '../../engine';
import { CART, boss, diego, guide, hasMarkers, localBase, obj, run, t, write } from '../helpers';
import type { Level } from '../types';

export const chapter3: Level[] = [
  {
    id: '3-1',
    chapter: 3,
    title: t('Una rama para ti', 'A branch of your own'),
    teaches: ['git branch', 'git switch -c'],
    editMode: 'guided',
    intro: [
      boss(
        'Vas a construir el login. Regla de la casa: nadie trabaja directo en `main`. Crea una rama `login` y haz tu trabajo ahí.',
        "You're building the login. House rule: nobody works directly on `main`. Create a `login` branch and do your work there.",
      ),
      guide(
        'Una rama es una línea de trabajo paralela. `git switch -c login` la crea y te cambia a ella. Para tener algo que guardar, crea un archivo: `echo "function login() {}" > login.js`.',
        'A branch is a parallel line of work. `git switch -c login` creates it and switches to it. To have something to save, create a file: `echo "function login() {}" > login.js`.',
      ),
    ],
    setup: (w) => localBase(w),
    objectives: [
      obj('branch', 'Crea la rama `login` y cámbiate a ella', 'Create the `login` branch and switch to it', (g) => g.branch === 'login'),
      obj('commit', 'Haz un commit en `login` (que no esté en `main`)', 'Make a commit on `login` (not on `main`)', (g) =>
        g.clean && !!g.repo.branches.login && g.repo.branches.login !== g.repo.branches.main && isAncestor(g.repo, g.repo.branches.main, g.repo.branches.login),
      ),
    ],
    hints: [
      t('`git branch` lista las ramas y marca con `*` en cuál estás.', '`git branch` lists branches and marks the current one with `*`.'),
      t('Solución: `git switch -c login` → `echo "function login() {}" > login.js` → `git add .` → `git commit -m "feat: login"`', 'Solution: `git switch -c login` → `echo "function login() {}" > login.js` → `git add .` → `git commit -m "feat: login"`'),
    ],
    outro: [guide('Mira el grafo de la derecha: `login` avanzó un commit y `main` se quedó donde estaba.', 'Look at the graph on the right: `login` moved one commit ahead and `main` stayed where it was.')],
    solution: ['git switch -c login', 'echo "function login() {}" > login.js', 'git add .', 'git commit -m "feat: login"'],
  },
  {
    id: '3-2',
    chapter: 3,
    title: t('De vuelta a main', 'Back to main'),
    teaches: ['git merge', 'git branch -d'],
    editMode: 'guided',
    intro: [
      boss('El login quedó bien. Intégralo en `main` y borra la rama, que no quiero ramas muertas por ahí.', "The login looks good. Integrate it into `main` and delete the branch, I don't want dead branches lying around."),
      guide(
        'Para integrar, colócate en la rama que **recibe** los cambios (`git switch main`) y ejecuta `git merge login`. Como `main` no cambió desde que saliste, git solo adelanta el puntero: un *fast-forward*.',
        'To integrate, stand on the branch that **receives** the changes (`git switch main`) and run `git merge login`. Since `main` has not changed since you left, git just moves the pointer forward: a *fast-forward*.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      run(w, 'git switch -c login');
      write(w, 'login.js', 'function login(user, pass) {\n  return user === "kiwi";\n}\n');
      run(w, 'git add .', 'git commit -m "feat: login"');
    },
    objectives: [
      obj('switch', 'Cámbiate a `main`', 'Switch to `main`', (g) => g.branch === 'main'),
      obj('merge', 'Integra `login` en `main`', 'Merge `login` into `main`', (g) => !!g.repo.branches.login && g.repo.branches.main === g.repo.branches.login),
      obj('delete', 'Borra la rama `login`', 'Delete the `login` branch', (g) => !('login' in g.repo.branches)),
    ],
    hints: [
      t('Si borras la rama antes de integrarla, git te avisa de que no está fusionada. Hazle caso.', 'If you delete the branch before merging, git warns you it is not merged. Listen to it.'),
      t('Solución: `git switch main` → `git merge login` → `git branch -d login`', 'Solution: `git switch main` → `git merge login` → `git branch -d login`'),
    ],
    solution: ['git switch main', 'git merge login', 'git branch -d login'],
  },
  {
    id: '3-3',
    chapter: 3,
    title: t('Caminos que se separan', 'Diverging paths'),
    teaches: ['merge commit', 'git log --graph'],
    editMode: 'guided',
    intro: [
      diego(
        'Terminé el buscador en la rama `search`. Mientras tanto alguien actualizó el README en `main`. ¿Lo integras tú? Estás en `main`.',
        "I finished the search feature on the `search` branch. Meanwhile someone updated the README on `main`. Can you merge it? You're on `main`.",
      ),
      guide(
        'Ahora las dos ramas tienen commits que la otra no tiene, así que no hay fast-forward posible: git crea un **commit de merge** con dos padres. Mira el grafo antes y después.',
        'Now both branches have commits the other lacks, so no fast-forward is possible: git creates a **merge commit** with two parents. Watch the graph before and after.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      run(w, 'git switch -c search');
      write(w, 'search.js', 'function search(items, text) {\n  return items.filter((i) => i.name.includes(text));\n}\n');
      run(w, 'git add .', 'git commit -m "feat: search"', 'git switch main');
      write(w, 'README.md', '# Kiwi Market\n\nOnline store for fresh fruit.\n\nNow with 20% more kiwis.\n');
      run(w, 'git commit -am "docs: update readme"');
    },
    objectives: [obj('merge', 'Integra `search` en `main`', 'Merge `search` into `main`', (g) => g.branch === 'main' && g.head?.parents.length === 2 && g.clean)],
    hints: [
      t('Es el mismo comando que antes; lo que cambia es lo que git hace por dentro.', 'Same command as before; what changes is what git does under the hood.'),
      t('Solución: `git merge search`. Después prueba `git log --oneline --graph`.', 'Solution: `git merge search`. Then try `git log --oneline --graph`.'),
    ],
    solution: ['git merge search'],
  },
  {
    id: '3-4',
    chapter: 3,
    title: t('Tu primer conflicto', 'Your first conflict'),
    teaches: ['conflictos', 'git add', 'git merge --abort'],
    editMode: 'guided',
    intro: [
      boss(
        'Integra la rama `promo` de Diego en `main`. Aviso: él y tú cambiaron la misma línea de `cart.js`. Gana la versión de Diego (el 10% de descuento).',
        "Merge Diego's `promo` branch into `main`. Heads up: you and he changed the same line of `cart.js`. Diego's version wins (the 10% discount).",
      ),
      guide(
        'Cuando dos ramas cambian la misma línea, git no adivina: se detiene y marca el archivo con `<<<<<<<`, `=======` y `>>>>>>>`. Arriba queda tu versión (HEAD) y abajo la que llega. Ábrelo en el editor, elige una con los botones, y después `git add` + `git commit` para cerrar el merge.',
        'When two branches change the same line, git does not guess: it stops and marks the file with `<<<<<<<`, `=======` and `>>>>>>>`. Your version (HEAD) is on top, the incoming one below. Open it in the editor, pick one with the buttons, then `git add` + `git commit` to conclude the merge.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      run(w, 'git switch -c promo');
      write(w, 'cart.js', CART.replace('return sum;', 'return sum * 0.9;'));
      run(w, 'git commit -am "feat: 10% promo"', 'git switch main');
      write(w, 'cart.js', CART.replace('return sum;', 'return sum + 5;'));
      run(w, 'git commit -am "feat: shipping cost"');
    },
    objectives: [
      obj('merge', 'Lanza el merge de `promo`', 'Start merging `promo`', (g) => g.repo.op?.kind === 'merge' || g.head?.parents.length === 2),
      obj('resolve', 'Resuelve el conflicto en `cart.js` y márcalo con `git add`', 'Resolve the conflict in `cart.js` and mark it with `git add`', (g) =>
        !g.repo.conflicts.length && !hasMarkers(g.file('cart.js')) && !!g.file('cart.js')?.includes('sum * 0.9'),
      ),
      obj('commit', 'Cierra el merge con un commit', 'Conclude the merge with a commit', (g) => g.clean && g.head?.parents.length === 2),
    ],
    hints: [
      t('`git status` te dice qué archivos están en conflicto ("both modified") y qué hacer después.', '`git status` tells you which files are in conflict ("both modified") and what to do next.'),
      t('Si te lías, `git merge --abort` deja todo como estaba antes del merge.', 'If you get lost, `git merge --abort` puts everything back as it was before the merge.'),
      t('Solución: `git merge promo` → en el editor, "Aceptar el suyo" → `git add cart.js` → `git commit -m "merge promo"`', 'Solution: `git merge promo` → in the editor, "Accept theirs" → `git add cart.js` → `git commit -m "merge promo"`'),
    ],
    solution: ['git merge promo', { resolve: ['cart.js', 'theirs'] }, 'git add cart.js', 'git commit -m "merge promo"'],
  },
];
