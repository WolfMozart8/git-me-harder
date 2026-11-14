import { CART, CART_BUGGY, README, boss, changedFiles, guide, history, localBase, obj, run, t, write } from '../helpers';
import type { Level } from '../types';

export const chapter1: Level[] = [
  {
    id: '1-1',
    chapter: 1,
    title: t('Primer día', 'First day'),
    teaches: ['git init', 'git status'],
    editMode: 'guided',
    intro: [
      boss(
        '¡Bienvenido a Kiwi Labs! Soy Marta, la CTO. Te dejé el proyecto en tu carpeta, pero todavía no tiene control de versiones. Empieza por ahí.',
        "Welcome to Kiwi Labs! I'm Marta, the CTO. I left the project in your folder, but it has no version control yet. Start there.",
      ),
      guide(
        'Escribe los comandos en la terminal del centro. `git init` convierte la carpeta en un repositorio y `git status` te dice en qué estado está todo. Usa `ls` para ver los archivos.',
        'Type commands in the terminal in the middle. `git init` turns the folder into a repository and `git status` tells you the state of everything. Use `ls` to list the files.',
      ),
    ],
    setup: (w) => {
      write(w, 'README.md', README);
      write(w, 'cart.js', CART);
    },
    objectives: [
      obj('init', 'Crea el repositorio con `git init`', 'Create the repository with `git init`', (g) => g.repo.initialized),
      obj('status', 'Mira el estado con `git status`', 'Check the state with `git status`', (g) => {
        // only a status run *after* the repository exists counts
        const cmds = g.history.map((argv) => argv.slice(0, 2).join(' '));
        return cmds.lastIndexOf('git status') > cmds.indexOf('git init');
      }),
    ],
    hints: [
      t('Git todavía no conoce esta carpeta. Hay un comando para "iniciar" un repositorio.', "Git doesn't know this folder yet. There's a command to \"initialize\" a repository."),
      t('Ejecuta `git init` y después `git status`.', 'Run `git init` and then `git status`.'),
    ],
    outro: [
      guide(
        'Los archivos aparecen en rojo como *untracked*: git los ve, pero aún no los sigue. Eso se arregla en el próximo nivel.',
        'The files show up in red as *untracked*: git sees them but is not tracking them yet. We fix that in the next level.',
      ),
    ],
    solution: ['git init', 'git status'],
  },
  {
    id: '1-2',
    chapter: 1,
    title: t('Tu primer commit', 'Your first commit'),
    teaches: ['git add', 'git commit', 'git log'],
    editMode: 'guided',
    intro: [
      boss(
        'Guarda el estado actual del proyecto para que tengamos un punto de partida.',
        'Save the current state of the project so we have a starting point.',
      ),
      guide(
        'Un commit es una foto del proyecto. Primero eliges qué entra en la foto con `git add` (el *staging area*) y después la tomas con `git commit -m "mensaje"`.',
        'A commit is a snapshot of the project. First you choose what goes into the snapshot with `git add` (the *staging area*), then you take it with `git commit -m "message"`.',
      ),
    ],
    setup: (w) => {
      run(w, 'git init');
      write(w, 'README.md', README);
      write(w, 'cart.js', CART);
    },
    objectives: [
      obj('stage', 'Añade los dos archivos al staging', 'Stage both files', (g) => 'cart.js' in g.repo.index && 'README.md' in g.repo.index),
      obj('commit', 'Crea un commit con un mensaje', 'Create a commit with a message', (g) => !!g.head && g.clean),
      obj('log', 'Revisa el historial con `git log`', 'Review the history with `git log`', (g) => g.ran('git log')),
    ],
    hints: [
      t('`git add .` añade todo lo que hay en la carpeta. También puedes nombrar archivos: `git add cart.js`.', '`git add .` stages everything in the folder. You can also name files: `git add cart.js`.'),
      t('Después: `git commit -m "Primer commit"`. Las comillas son importantes.', 'Then: `git commit -m "First commit"`. The quotes matter.'),
      t('Solución: `git add .` → `git commit -m "Primer commit"` → `git log`', 'Solution: `git add .` → `git commit -m "First commit"` → `git log`'),
    ],
    solution: ['git add .', 'git commit -m "Initial commit"', 'git log'],
  },
  {
    id: '1-3',
    chapter: 1,
    title: t('¿Qué cambió?', 'What changed?'),
    teaches: ['git diff'],
    editMode: 'guided',
    intro: [
      boss(
        'Los totales del carrito salen mal: alguien escribió una suma donde iba una multiplicación en `cart.js`. Corrígelo.',
        'Cart totals are wrong: someone wrote an addition where a multiplication should be in `cart.js`. Fix it.',
      ),
      guide(
        'Abre `cart.js` en el editor de la derecha y pulsa **Aplicar** en el cambio sugerido. Fíjate en el margen: las líneas modificadas se marcan en color. Con `git diff` ves lo mismo en la terminal antes de hacer commit.',
        'Open `cart.js` in the editor on the right and press **Apply** on the suggested change. Watch the gutter: modified lines get a colored mark. `git diff` shows you the same thing in the terminal before committing.',
      ),
    ],
    setup: (w) => localBase(w, CART_BUGGY),
    edits: [
      {
        file: 'cart.js',
        note: t('Multiplica precio por cantidad', 'Multiply price by quantity'),
        find: 'item.price + item.qty',
        replace: 'item.price * item.qty',
      },
    ],
    objectives: [
      obj('fix', 'Corrige la línea en `cart.js`', 'Fix the line in `cart.js`', (g) => !!g.file('cart.js')?.includes('item.price * item.qty')),
      obj('diff', 'Revisa tu cambio con `git diff`', 'Review your change with `git diff`', (g) => g.ran('git diff')),
      obj('commit', 'Haz commit de la corrección', 'Commit the fix', (g) => g.clean && !!g.head?.tree['cart.js'].includes('item.price * item.qty')),
    ],
    hints: [
      t('En el diff, las líneas con `-` (rojo) son lo que había y las de `+` (verde) lo nuevo.', 'In the diff, lines with `-` (red) are what was there and `+` (green) is what is new.'),
      t('Un archivo modificado también necesita `git add` antes del commit.', 'A modified file also needs `git add` before committing.'),
      t('Solución: aplicar el cambio → `git diff` → `git add cart.js` → `git commit -m "fix: total"`', 'Solution: apply the change → `git diff` → `git add cart.js` → `git commit -m "fix: total"`'),
    ],
    solution: [{ edit: 0 }, 'git diff', 'git add cart.js', 'git commit -m "fix: multiply price by quantity"'],
  },
  {
    id: '1-4',
    chapter: 1,
    title: t('Un commit, una idea', 'One commit, one idea'),
    teaches: ['git add <file>'],
    editMode: 'guided',
    intro: [
      boss(
        'Veo que tocaste el código y la documentación a la vez. No me los mezcles: quiero un commit para `cart.js` y otro para el `README.md`.',
        "I see you touched code and docs at the same time. Don't mix them: I want one commit for `cart.js` and another for `README.md`.",
      ),
      guide(
        'Para eso existe el staging: solo lo que añadas con `git add <archivo>` entra en el próximo commit. El resto se queda esperando.',
        'This is what staging is for: only what you add with `git add <file>` goes into the next commit. The rest waits.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'cart.js', CART + '\nfunction count(items) {\n  return items.length;\n}\n');
      write(w, 'README.md', README + '\n## Cart\n\nUse `total(items)` to get the price.\n');
    },
    objectives: [
      obj('stage', 'Añade solo `cart.js` al staging', 'Stage only `cart.js`', (g) => g.repo.index['cart.js'] === g.file('cart.js') && g.repo.index['README.md'] === g.head?.tree['README.md']),
      obj('first', 'Haz un commit que solo contenga `cart.js`', 'Make a commit containing only `cart.js`', (g) =>
        !!g.head && history(g.repo, g.head.hash).some((cm) => cm.parents.length === 1 && changedFiles(g.repo, cm.hash).join() === 'cart.js'),
      ),
      obj('second', 'Haz otro commit con el `README.md`', 'Make another commit with `README.md`', (g) => g.clean && !!g.head?.tree['README.md'].includes('## Cart')),
    ],
    hints: [
      t('`git status` te muestra dos secciones: lo que está en staging (verde) y lo que no (rojo).', '`git status` shows two sections: what is staged (green) and what is not (red).'),
      t('Si añadiste de más, `git restore --staged <archivo>` lo saca del staging sin perder el cambio.', 'If you staged too much, `git restore --staged <file>` unstages it without losing the change.'),
      t('Solución: `git add cart.js` → `git commit -m "feat: count"` → `git add README.md` → `git commit -m "docs: cart"`', 'Solution: `git add cart.js` → `git commit -m "feat: count"` → `git add README.md` → `git commit -m "docs: cart"`'),
    ],
    solution: ['git add cart.js', 'git commit -m "feat: add count"', 'git add README.md', 'git commit -m "docs: describe the cart"'],
  },
];
