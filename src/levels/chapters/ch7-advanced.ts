import { commitsBetween, isAncestor } from '../../engine';
import { CART, boss, diego, guide, hasMarkers, headHas, localBase, obj, run, sofia, t, teammate, withOrigin, write } from '../helpers';
import type { Level } from '../types';

export const chapter7: Level[] = [
  {
    id: '7-1',
    chapter: 7,
    title: t('Historia en línea recta', 'A straight-line history'),
    teaches: ['git rebase'],
    editMode: 'guided',
    intro: [
      boss(
        'Tu rama `search` salió de un `main` antiguo. No quiero commits de merge ensuciando el historial: ponla al día con un rebase.',
        'Your `search` branch started from an old `main`. I do not want merge commits cluttering history: bring it up to date with a rebase.',
      ),
      guide(
        '`git rebase main` toma los commits de tu rama y los **vuelve a aplicar** encima del `main` actual, como si hubieras empezado hoy. Son commits nuevos (cambian de hash), por eso solo se hace con ramas que nadie más usa.',
        '`git rebase main` takes your branch\'s commits and **re-applies** them on top of the current `main`, as if you had started today. They are new commits (hashes change), which is why you only do it on branches nobody else uses.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      run(w, 'git switch -c search');
      write(w, 'search.js', 'function search(items, text) {\n  return items.filter((i) => i.name.includes(text));\n}\n');
      run(w, 'git add .', 'git commit -m "feat: search"');
      write(w, 'search.js', 'function search(items, text) {\n  const q = text.toLowerCase();\n  return items.filter((i) => i.name.toLowerCase().includes(q));\n}\n');
      run(w, 'git commit -am "feat: case-insensitive search"', 'git switch main');
      write(w, 'README.md', '# Kiwi Market\n\nOnline store for fresh fruit.\n\nNow with 20% more kiwis.\n');
      run(w, 'git commit -am "docs: update readme"', 'git switch search');
    },
    objectives: [
      obj('rebase', 'Rebasa `search` sobre `main`', 'Rebase `search` onto `main`', (g) => {
        const { repo } = g;
        if (g.branch !== 'search' || repo.op || !g.head) return false;
        const own = commitsBetween(repo, repo.branches.main, g.head.hash);
        return isAncestor(repo, repo.branches.main, g.head.hash) && own.length === 2 && own.every((h) => repo.commits[h].parents.length === 1);
      }),
    ],
    hints: [
      t('Mira el grafo antes: `search` y `main` se separan. Después del rebase quedan en una sola línea.', 'Look at the graph first: `search` and `main` fork. After the rebase they form a single line.'),
      t('Solución: `git rebase main`', 'Solution: `git rebase main`'),
    ],
    solution: ['git rebase main'],
  },
  {
    id: '7-2',
    chapter: 7,
    title: t('Rebase con tropiezo', 'Rebase with a bump'),
    teaches: ['git rebase --continue', 'git rebase --abort'],
    editMode: 'guided',
    intro: [
      diego(
        'Rebasa tu rama `promo` sobre `main`. Ojo, que yo cambié la misma línea en `main`. Tu descuento del 10% es el que vale.',
        'Rebase your `promo` branch onto `main`. Careful, I changed the same line on `main`. Your 10% discount is the one that counts.',
      ),
      guide(
        'Un rebase puede detenerse en cada commit que choque. Se resuelve igual que en un merge, pero se continúa con `git rebase --continue` (no con `git commit`). **Trampa:** durante un rebase los lados se invierten: "HEAD / el mío" es `main` y "el suyo" es **tu** commit que se está reaplicando.',
        'A rebase can stop at every commit that clashes. You resolve it like a merge, but continue with `git rebase --continue` (not `git commit`). **Gotcha:** during a rebase the sides are swapped: "HEAD / ours" is `main` and "theirs" is **your** commit being re-applied.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      run(w, 'git switch -c promo');
      write(w, 'cart.js', CART.replace('return sum;', 'return sum * 0.9;'));
      run(w, 'git commit -am "feat: 10% promo"', 'git switch main');
      write(w, 'cart.js', CART.replace('return sum;', 'return sum * 0.95;'));
      run(w, 'git commit -am "feat: 5% promo"', 'git switch promo');
    },
    objectives: [
      obj('start', 'Lanza el rebase sobre `main`', 'Start the rebase onto `main`', (g) => g.repo.op?.kind === 'rebase' || (g.branch === 'promo' && isAncestor(g.repo, g.repo.branches.main, g.head?.hash))),
      obj('resolve', 'Resuelve el conflicto dejando el 10% y márcalo con `git add`', 'Resolve the conflict keeping the 10% and mark it with `git add`', (g) => !g.repo.conflicts.length && !hasMarkers(g.file('cart.js')) && !!g.file('cart.js')?.includes('sum * 0.9;')),
      obj('continue', 'Termina con `git rebase --continue`', 'Finish with `git rebase --continue`', (g) => !g.repo.op && g.branch === 'promo' && g.clean && isAncestor(g.repo, g.repo.branches.main, g.head?.hash)),
    ],
    hints: [
      t('`git status` durante un rebase te dice en qué commit estás parado y qué hacer.', '`git status` during a rebase tells you which commit you are stopped at and what to do.'),
      t('En el editor elige "Aceptar el suyo": en un rebase, ese es tu commit.', 'In the editor choose "Accept theirs": in a rebase, that is your commit.'),
      t('Solución: `git rebase main` → "Aceptar el suyo" → `git add cart.js` → `git rebase --continue`', 'Solution: `git rebase main` → "Accept theirs" → `git add cart.js` → `git rebase --continue`'),
    ],
    solution: ['git rebase main', { resolve: ['cart.js', 'theirs'] }, 'git add cart.js', 'git rebase --continue'],
  },
  {
    id: '7-3',
    chapter: 7,
    title: t('Solo ese commit', 'Just that commit'),
    teaches: ['git cherry-pick'],
    editMode: 'guided',
    intro: [
      diego(
        'En mi rama `experiment` del servidor hay un commit, "fix: empty cart crash", que arregla un fallo real. El resto de la rama es un caos que no debe llegar a `main`. ¿Te lo llevas solo a él?',
        'On my `experiment` branch on the server there is a commit, "fix: empty cart crash", that fixes a real bug. The rest of the branch is chaos that must not reach `main`. Can you take just that one?',
      ),
      guide(
        '`git cherry-pick <commit>` copia un commit suelto a tu rama actual. Primero `git fetch`, luego busca el commit con `git log --oneline origin/experiment` y usa su hash.',
        '`git cherry-pick <commit>` copies a single commit onto your current branch. First `git fetch`, then find the commit with `git log --oneline origin/experiment` and use its hash.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      teammate(w, { branch: 'experiment', author: 'Diego', message: 'wip: new checkout', files: { 'checkout.js': '// TODO todo\nfunction checkout() { throw "no" }\n' } });
      teammate(w, { branch: 'experiment', author: 'Diego', message: 'fix: empty cart crash', files: { 'cart.js': CART.replace('  let sum = 0;', '  if (!items) return 0;\n  let sum = 0;') } });
      teammate(w, { branch: 'experiment', author: 'Diego', message: 'wip: romper todo', files: { 'checkout.js': 'function checkout() { while (true) {} }\n' } });
    },
    objectives: [
      obj('fetch', 'Descarga la rama de Diego', "Download Diego's branch", (g) => !!g.repo.remoteRefs['origin/experiment']),
      obj('pick', 'Trae a `main` solo el commit del fix', 'Bring only the fix commit to `main`', (g) => g.branch === 'main' && g.clean && headHas(g, 'fix: empty cart crash') && g.file('checkout.js') === undefined),
      obj('push', 'Sube `main`', 'Push `main`', (g) => !!g.head && g.origin?.branches.main === g.head.hash),
    ],
    hints: [
      t('El fix es el penúltimo commit de la rama: también puedes referirte a él como `origin/experiment~1`.', 'The fix is the second-to-last commit on the branch: you can also refer to it as `origin/experiment~1`.'),
      t('Solución: `git fetch` → `git cherry-pick origin/experiment~1` → `git push`', 'Solution: `git fetch` → `git cherry-pick origin/experiment~1` → `git push`'),
    ],
    solution: ['git fetch', 'git log --oneline origin/experiment', 'git cherry-pick origin/experiment~1', 'git push'],
  },
  {
    id: '7-4',
    chapter: 7,
    title: t('Versión 1.0', 'Version 1.0'),
    teaches: ['git tag', 'git push origin <tag>'],
    editMode: 'guided',
    intro: [
      boss('¡Lanzamos! Marca el commit actual de `main` como `v1.0` y sube la etiqueta al servidor.', 'We are launching! Mark the current commit on `main` as `v1.0` and push the tag to the server.', 'happy'),
      guide(
        'Una etiqueta (*tag*) es un nombre fijo para un commit: a diferencia de una rama, no se mueve. `git tag v1.0` la crea. Las etiquetas no viajan con un push normal: hay que subirlas con `git push origin v1.0`.',
        'A tag is a fixed name for a commit: unlike a branch, it never moves. `git tag v1.0` creates it. Tags do not travel with a normal push: you upload them with `git push origin v1.0`.',
      ),
    ],
    setup: (w) => withOrigin(w),
    objectives: [
      obj('tag', 'Crea la etiqueta `v1.0`', 'Create the `v1.0` tag', (g) => !!g.repo.tags['v1.0']),
      obj('push', 'Súbela al servidor', 'Push it to the server', (g) => !!g.origin?.tags['v1.0']),
    ],
    hints: [
      t('`git tag` sin argumentos lista las etiquetas; `git log --oneline` las muestra junto al commit.', '`git tag` with no arguments lists tags; `git log --oneline` shows them next to the commit.'),
      t('Solución: `git tag v1.0` → `git push origin v1.0`', 'Solution: `git tag v1.0` → `git push origin v1.0`'),
    ],
    solution: ['git tag v1.0', 'git push origin v1.0'],
  },
  {
    id: '7-5',
    chapter: 7,
    title: t('Rescate con reflog', 'Reflog rescue'),
    teaches: ['git reflog', 'git reset --hard'],
    editMode: 'guided',
    intro: [
      sofia(
        'Creo que la lié… Estaba en tu máquina, hice `git reset --hard HEAD~1` y tu commit de la wishlist desapareció. ¿Se puede recuperar? Dime que sí 😰',
        'I think I messed up… I was on your machine, ran `git reset --hard HEAD~1` and your wishlist commit vanished. Can it be recovered? Please say yes 😰',
      ),
      guide(
        'Casi nada se pierde de verdad en git. `git reflog` es el diario de todos los sitios por los que pasó `HEAD`, incluidos los commits que ya no cuelgan de ninguna rama. Encuentra el commit perdido y vuelve a él con `git reset --hard <hash>`.',
        'Almost nothing is truly lost in git. `git reflog` is the diary of everywhere `HEAD` has been, including commits no branch points to anymore. Find the lost commit and go back to it with `git reset --hard <hash>`.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'wishlist.js', 'function addToWishlist(list, item) {\n  list.push(item);\n}\n');
      run(w, 'git add .', 'git commit -m "feat: wishlist"', 'git reset --hard HEAD~1');
    },
    objectives: [
      obj('reflog', 'Consulta `git reflog`', 'Check `git reflog`', (g) => g.ran('git reflog')),
      obj('rescue', 'Recupera el commit "feat: wishlist" en `main`', 'Recover the "feat: wishlist" commit on `main`', (g) => g.branch === 'main' && headHas(g, 'feat: wishlist') && g.file('wishlist.js') !== undefined),
    ],
    hints: [
      t('En el reflog, busca la línea `commit: feat: wishlist`. El hash está al principio.', 'In the reflog, look for the line `commit: feat: wishlist`. The hash is at the start.'),
      t('También vale la notación del reflog: `git reset --hard HEAD@{1}`.', 'Reflog notation works too: `git reset --hard HEAD@{1}`.'),
    ],
    outro: [
      boss(
        'Has pasado por todo: commits, ramas, conflictos, remotos, hotfixes y rescates. Ya eres oficialmente la persona a la que el equipo le pregunta sobre git. Felicidades.',
        'You have been through it all: commits, branches, conflicts, remotes, hotfixes and rescues. You are now officially the person the team asks about git. Congratulations.',
        'happy',
      ),
    ],
    solution: ['git reflog', 'git reset --hard HEAD@{1}'],
  },
];
