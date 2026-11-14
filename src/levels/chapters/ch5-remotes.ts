import { ORIGIN, boss, diego, guide, headHas, mine, obj, run, sofia, t, teammate, withOrigin, write } from '../helpers';
import type { Level } from '../types';

const COUPONS = 'function applyCoupon(total, code) {\n  return code === "KIWI10" ? total * 0.9 : total;\n}\n';
const WISHLIST = 'function addToWishlist(list, item) {\n  list.push(item);\n}\n';

export const chapter5: Level[] = [
  {
    id: '5-1',
    chapter: 5,
    title: t('Clonar el repo del equipo', "Cloning the team's repo"),
    teaches: ['git clone', 'git remote -v'],
    editMode: 'guided',
    intro: [
      boss(
        `Se acabó trabajar solo. El repositorio del equipo vive en nuestro servidor: \`${ORIGIN}\`. Clónalo.`,
        `No more working alone. The team repository lives on our server: \`${ORIGIN}\`. Clone it.`,
      ),
      guide(
        '`git clone <url>` descarga el repositorio completo, con todo su historial, y lo deja conectado al servidor con el nombre `origin`. Compruébalo con `git remote -v`.',
        '`git clone <url>` downloads the whole repository, with all its history, and leaves it connected to the server under the name `origin`. Check it with `git remote -v`.',
      ),
    ],
    setup: (w) => withOrigin(w, { clone: false }),
    objectives: [
      obj('clone', 'Clona el repositorio', 'Clone the repository', (g) => g.repo.initialized && !!g.repo.remotes.origin && !!g.head),
      obj('remote', 'Comprueba el remoto con `git remote -v`', 'Check the remote with `git remote -v`', (g) => g.ran('git remote')),
    ],
    hints: [
      t('Puedes pegar la URL en la terminal (Ctrl+V).', 'You can paste the URL into the terminal (Ctrl+V).'),
      t(`Solución: \`git clone ${ORIGIN}\` → \`git remote -v\``, `Solution: \`git clone ${ORIGIN}\` → \`git remote -v\``),
    ],
    outro: [guide('En el grafo ahora aparece `origin/main`: es la última posición que conoces de la rama `main` del servidor.', 'The graph now shows `origin/main`: the last position you know of the server\'s `main` branch.')],
    solution: [`git clone ${ORIGIN}`, 'git remote -v'],
  },
  {
    id: '5-2',
    chapter: 5,
    title: t('Tu primer push', 'Your first push'),
    teaches: ['git push'],
    editMode: 'guided',
    intro: [
      boss('Añade al README cómo contactar al equipo y súbelo al servidor.', 'Add how to contact the team to the README and upload it to the server.'),
      guide(
        'Un commit vive solo en tu máquina hasta que lo subes. `git push` envía tus commits a `origin`. `git status` te avisa cuando vas "ahead" (por delante) del remoto.',
        'A commit lives only on your machine until you upload it. `git push` sends your commits to `origin`. `git status` tells you when you are "ahead" of the remote.',
      ),
    ],
    setup: (w) => withOrigin(w),
    edits: [{ file: 'README.md', note: t('Añade la sección de contacto', 'Add the contact section'), find: 'Online store for fresh fruit.\n', replace: 'Online store for fresh fruit.\n\nContact: team@kiwilabs.dev\n' }],
    objectives: [
      obj('commit', 'Edita el README y haz commit', 'Edit the README and commit', (g) => g.clean && (mine(g) || []).length > 0),
      obj('push', 'Sube tu commit con `git push`', 'Upload your commit with `git push`', (g) => !!g.head && g.origin?.branches.main === g.head.hash),
    ],
    hints: [
      t('Después del commit, mira `git status`: "Your branch is ahead of \'origin/main\' by 1 commit".', 'After committing, look at `git status`: "Your branch is ahead of \'origin/main\' by 1 commit".'),
      t('Solución: aplicar el cambio → `git commit -am "docs: contacto"` → `git push`', 'Solution: apply the change → `git commit -am "docs: contact"` → `git push`'),
    ],
    solution: [{ edit: 0 }, 'git commit -am "docs: add contact"', 'git push'],
  },
  {
    id: '5-3',
    chapter: 5,
    title: t('Una rama en el servidor', 'A branch on the server'),
    teaches: ['git push -u origin <rama>'],
    editMode: 'guided',
    intro: [
      sofia(
        '¡Hola! Soy Sofía, del frontend. ¿Me subes tu rama `wishlist` al servidor? Así voy viendo lo que haces.',
        "Hi! I'm Sofía, frontend. Could you push your `wishlist` branch to the server? That way I can follow what you do.",
      ),
      guide(
        'Una rama nueva solo existe en tu máquina. La primera vez hay que decirle a git a dónde va: `git push -u origin wishlist`. El `-u` deja la rama enlazada con la del servidor, y desde entonces basta con `git push`.',
        'A new branch only exists on your machine. The first time you must tell git where it goes: `git push -u origin wishlist`. The `-u` links the branch to the one on the server, and from then on plain `git push` is enough.',
      ),
    ],
    setup: (w) => withOrigin(w),
    objectives: [
      obj('branch', 'Crea la rama `wishlist` con al menos un commit', 'Create the `wishlist` branch with at least one commit', (g) => g.branch === 'wishlist' && g.clean && (mine(g) || []).length > 0),
      obj('push', 'Súbela a `origin` dejándola enlazada (`-u`)', 'Push it to `origin` with tracking (`-u`)', (g) => !!g.head && g.origin?.branches.wishlist === g.head.hash && g.repo.upstream.wishlist === 'origin/wishlist'),
    ],
    hints: [
      t('Para tener un commit: `echo "function addToWishlist() {}" > wishlist.js`, luego `git add .` y `git commit`.', 'To get a commit: `echo "function addToWishlist() {}" > wishlist.js`, then `git add .` and `git commit`.'),
      t('Si pruebas `git push` a secas, git te dice exactamente qué comando falta.', 'If you try a plain `git push`, git tells you exactly which command is missing.'),
      t('Solución: `git switch -c wishlist` → crear archivo → `git add .` → `git commit -m "feat: wishlist"` → `git push -u origin wishlist`', 'Solution: `git switch -c wishlist` → create file → `git add .` → `git commit -m "feat: wishlist"` → `git push -u origin wishlist`'),
    ],
    solution: ['git switch -c wishlist', 'echo "function addToWishlist() {}" > wishlist.js', 'git add .', 'git commit -m "feat: wishlist"', 'git push -u origin wishlist'],
  },
  {
    id: '5-4',
    chapter: 5,
    title: t('Ponerse al día', 'Catching up'),
    teaches: ['git fetch', 'git pull'],
    editMode: 'guided',
    intro: [
      diego('Acabo de subir los cupones de descuento a `main`. Actualiza cuando puedas.', 'I just pushed the discount coupons to `main`. Update when you can.'),
      guide(
        'Tu repositorio no se entera solo de lo que pasa en el servidor. `git fetch` descarga las novedades y mueve `origin/main`, pero **no toca tus archivos**: así puedes mirar antes de integrar. `git pull` hace las dos cosas: fetch + merge.',
        'Your repository does not find out by itself what happens on the server. `git fetch` downloads the news and moves `origin/main`, but **does not touch your files**: you can look before integrating. `git pull` does both: fetch + merge.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      teammate(w, { branch: 'main', author: 'Diego', message: 'feat: coupons', files: { 'coupons.js': COUPONS } });
    },
    objectives: [
      obj('fetch', 'Descarga las novedades con `git fetch`', 'Download the news with `git fetch`', (g) => g.repo.remoteRefs['origin/main'] === g.origin?.branches.main),
      obj('pull', 'Integra los cambios en tu `main`', 'Integrate the changes into your `main`', (g) => g.repo.branches.main === g.origin?.branches.main && g.file('coupons.js') !== undefined),
    ],
    hints: [
      t('Tras el fetch, `git status` dice que vas "behind" (por detrás) y `git log --oneline origin/main` te enseña qué llegó.', 'After fetching, `git status` says you are "behind" and `git log --oneline origin/main` shows what arrived.'),
      t('Solución: `git fetch` → `git status` → `git pull`', 'Solution: `git fetch` → `git status` → `git pull`'),
    ],
    solution: ['git fetch', 'git status', 'git pull'],
  },
  {
    id: '5-5',
    chapter: 5,
    title: t('Push rechazado', 'Push rejected'),
    teaches: ['git pull', 'git push'],
    editMode: 'guided',
    intro: [
      boss('Sube ya tu commit de la wishlist a `main`, que lo quiero enseñar en la reunión.', 'Push your wishlist commit to `main` now, I want to show it in the meeting.'),
      guide(
        'Sorpresa: Diego subió algo a `main` hace un minuto. Git rechaza un push cuando el servidor tiene commits que tú no tienes, para que nadie pise el trabajo de otro. La salida es integrar primero (`git pull`) y subir después.',
        'Surprise: Diego pushed something to `main` a minute ago. Git rejects a push when the server has commits you lack, so nobody overwrites anyone else\'s work. The way out is to integrate first (`git pull`) and push afterwards.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      write(w, 'wishlist.js', WISHLIST);
      run(w, 'git add .', 'git commit -m "feat: wishlist"');
      teammate(w, { branch: 'main', author: 'Diego', message: 'feat: coupons', files: { 'coupons.js': COUPONS } });
    },
    objectives: [
      obj('try', 'Intenta subir con `git push`', 'Try to upload with `git push`', (g) => g.ran('git push')),
      obj('pull', 'Integra el trabajo de Diego', "Integrate Diego's work", (g) => headHas(g, 'feat: coupons') || (!!g.head && g.head.parents.some((p) => g.repo.commits[p].message === 'feat: coupons')) || g.file('coupons.js') !== undefined),
      obj('push', 'Ahora sí: sube todo', 'Now push everything', (g) => !!g.head && g.clean && g.origin?.branches.main === g.head.hash),
    ],
    hints: [
      t('Lee el mensaje de rechazo con calma: el propio git te dice que hagas `git pull`.', 'Read the rejection message calmly: git itself tells you to `git pull`.'),
      t('Como tocaron archivos distintos, el pull crea el commit de merge solo, sin conflictos.', 'Since you touched different files, the pull creates the merge commit by itself, no conflicts.'),
      t('Solución: `git push` (falla) → `git pull` → `git push`', 'Solution: `git push` (fails) → `git pull` → `git push`'),
    ],
    solution: ['git push', 'git pull', 'git push'],
  },
];
