import { CART, boss, diego, guide, history, localBase, obj, run, t, untracked, write } from '../helpers';
import type { Level } from '../types';

const COUNT = '\nfunction count(items) {\n  return items.length;\n}\n';

export const chapter2: Level[] = [
  {
    id: '2-1',
    chapter: 2,
    title: t('Ups', 'Oops'),
    teaches: ['git restore', 'git restore --staged'],
    editMode: 'guided',
    intro: [
      diego(
        'Hola, soy Diego, del backend. Oye… creo que dejé tu `cart.js` hecho un desastre probando cosas en tu máquina, y además añadí mis `notes.txt` al staging sin querer. Perdón 😅',
        "Hi, I'm Diego, backend. Listen… I think I left your `cart.js` in a mess while trying things on your machine, and I also staged my `notes.txt` by accident. Sorry 😅",
      ),
      guide(
        '`git restore <archivo>` descarta los cambios de un archivo y lo deja como en el último commit. `git restore --staged <archivo>` lo saca del staging sin tocar su contenido.',
        '`git restore <file>` discards changes in a file, back to the last commit. `git restore --staged <file>` takes it out of staging without touching its content.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'cart.js', CART.replace('let sum = 0;', 'let sum = 999999; // jeje\n  console.log("probando");'));
      write(w, 'notes.txt', 'comprar café\n');
      run(w, 'git add notes.txt');
    },
    objectives: [
      obj('discard', 'Descarta los cambios de `cart.js`', 'Discard the changes in `cart.js`', (g) => g.file('cart.js') === g.head?.tree['cart.js']),
      obj('unstage', 'Saca `notes.txt` del staging (sin borrarlo)', 'Unstage `notes.txt` (without deleting it)', (g) => !('notes.txt' in g.repo.index) && g.file('notes.txt') !== undefined),
    ],
    hints: [
      t('`git status` ya te sugiere los comandos exactos entre paréntesis.', '`git status` already suggests the exact commands in parentheses.'),
      t('Solución: `git restore cart.js` → `git restore --staged notes.txt`', 'Solution: `git restore cart.js` → `git restore --staged notes.txt`'),
    ],
    outro: [guide('Ojo: `git restore` sobre un archivo no tiene vuelta atrás. Lo descartado nunca estuvo en un commit, así que git no lo guardó.', 'Careful: `git restore` on a file cannot be undone. What you discarded was never in a commit, so git did not keep it.')],
    solution: ['git restore cart.js', 'git restore --staged notes.txt'],
  },
  {
    id: '2-2',
    chapter: 2,
    title: t('Esto no se sube', 'This stays out'),
    teaches: ['.gitignore'],
    editMode: 'guided',
    intro: [
      boss(
        'Antes de que pase una desgracia: el archivo `.env` tiene claves y los `.log` son basura. Ninguno debe entrar jamás al repositorio.',
        'Before something bad happens: the `.env` file has secrets and `.log` files are junk. None of them must ever get into the repository.',
      ),
      guide(
        'Un archivo `.gitignore` lista lo que git debe ignorar, un patrón por línea. Puedes crearlo desde la terminal: `echo ".env" > .gitignore` crea el archivo y `echo "*.log" >> .gitignore` le añade otra línea. Si prefieres, también puedes crearlo y escribirlo en el editor.',
        'A `.gitignore` file lists what git should ignore, one pattern per line. You can create it from the terminal: `echo ".env" > .gitignore` creates the file and `echo "*.log" >> .gitignore` appends another line. If you prefer, you can also create it and type it in the editor.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, '.env', 'API_KEY=sk-kiwi-123456\n');
      write(w, 'debug.log', '[12:01] started\n[12:02] crashed\n');
    },
    expects: [{ file: '.gitignore', cmd: 'echo ".env" > .gitignore' }],
    objectives: [
      obj('ignore', 'Crea un `.gitignore` que ignore `.env` y los `.log`', 'Create a `.gitignore` that ignores `.env` and `.log` files', (g) => g.file('.gitignore') !== undefined && !untracked(g).some((p) => p === '.env' || p.endsWith('.log'))),
      obj('commit', 'Haz commit del `.gitignore`', 'Commit the `.gitignore`', (g) => g.clean && !!g.head && '.gitignore' in g.head.tree && !('.env' in g.head.tree) && !('debug.log' in g.head.tree)),
    ],
    hints: [
      t('Después de crear el `.gitignore`, `git status` ya no debería mostrar `.env` ni `debug.log`.', 'After creating `.gitignore`, `git status` should no longer show `.env` or `debug.log`.'),
      t('Solución: `echo ".env" > .gitignore` → `echo "*.log" >> .gitignore` → `git add .gitignore` → `git commit -m "chore: gitignore"`', 'Solution: `echo ".env" > .gitignore` → `echo "*.log" >> .gitignore` → `git add .gitignore` → `git commit -m "chore: gitignore"`'),
    ],
    solution: ['echo ".env" > .gitignore', 'echo "*.log" >> .gitignore', 'git add .gitignore', 'git commit -m "chore: add gitignore"'],
  },
  {
    id: '2-3',
    chapter: 2,
    title: t('Mensaje para la posteridad', 'A message for posterity'),
    teaches: ['git commit --amend'],
    editMode: 'guided',
    intro: [
      boss(
        'Acabo de ver tu último commit: "asdf wip". ¿En serio? Ponle un mensaje decente antes de que alguien más lo vea.',
        'I just saw your last commit: "asdf wip". Seriously? Give it a decent message before anyone else sees it.',
      ),
      guide(
        '`git commit --amend -m "nuevo mensaje"` reemplaza el último commit por uno nuevo. Úsalo solo con commits que todavía no compartiste.',
        '`git commit --amend -m "new message"` replaces the last commit with a new one. Only use it on commits you have not shared yet.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'cart.js', CART + COUNT);
      run(w, 'git commit -am "asdf wip"');
    },
    objectives: [
      obj('amend', 'Cambia el mensaje del último commit (sin crear uno nuevo)', 'Change the last commit message (without creating a new commit)', (g) => !!g.head && g.head.message !== 'asdf wip' && history(g.repo, g.head.hash).length === 2),
    ],
    hints: [
      t('Mira el historial con `git log --oneline` antes y después: el hash del commit cambia, porque en realidad es un commit nuevo.', 'Look at the history with `git log --oneline` before and after: the commit hash changes, because it really is a new commit.'),
      t('Solución: `git commit --amend -m "feat: contar items del carrito"`', 'Solution: `git commit --amend -m "feat: count cart items"`'),
    ],
    solution: ['git commit --amend -m "feat: count cart items"'],
  },
  {
    id: '2-4',
    chapter: 2,
    title: t('Retroceder en el tiempo', 'Going back in time'),
    teaches: ['git reset --soft', 'git reset --hard'],
    editMode: 'guided',
    intro: [
      diego(
        'Ese commit "experimento" que hiciste… mejor que no exista. Deshazlo, pero ojo: primero quiero echarle un vistazo al archivo, así que no lo borres todavía.',
        'That "experiment" commit you made… better if it never existed. Undo it, but wait: I want to look at the file first, so do not delete it yet.',
      ),
      guide(
        '`git reset` mueve la rama a otro commit. `--soft` deja tus archivos y el staging intactos; `--hard` lo descarta todo. `HEAD~1` significa "el commit anterior al actual".',
        '`git reset` moves the branch to another commit. `--soft` leaves your files and staging intact; `--hard` throws everything away. `HEAD~1` means "the commit before the current one".',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'experiment.js', '// no tocar: prueba secreta\nconst magic = 42;\n');
      run(w, 'git add .', 'git commit -m "experimento"');
    },
    events: [
      {
        id: 'seen',
        when: (g) => !!g.head && history(g.repo, g.head.hash).length === 1 && g.file('experiment.js') !== undefined,
        messages: [diego('Listo, ya lo vi. No sirve para nada 😂 Ahora sí, bórralo del todo y deja la carpeta limpia.', "OK, I've seen it. It's useless 😂 Now delete it for good and leave the folder clean.")],
      },
    ],
    objectives: [
      obj('soft', 'Deshaz el último commit conservando `experiment.js`', 'Undo the last commit while keeping `experiment.js`', (g) => !!g.head && history(g.repo, g.head.hash).length === 1 && g.file('experiment.js') !== undefined),
      obj('hard', 'Ahora descarta el archivo y deja todo limpio', 'Now discard the file and leave everything clean', (g) => g.clean && g.file('experiment.js') === undefined),
    ],
    hints: [
      t('Para el primer paso: `git reset --soft HEAD~1`. El archivo queda en staging, como justo antes de hacer el commit.', 'For the first step: `git reset --soft HEAD~1`. The file stays staged, like right before you committed.'),
      t('Para el segundo: `git reset --hard` vuelve todo al último commit.', 'For the second: `git reset --hard` puts everything back to the last commit.'),
    ],
    solution: ['git reset --soft HEAD~1', 'git reset --hard'],
  },
  {
    id: '2-5',
    chapter: 2,
    title: t('Deshacer sin borrar', 'Undo without erasing'),
    teaches: ['git revert'],
    editMode: 'guided',
    intro: [
      boss(
        'El commit "feat: envío gratis para todos" nos está costando dinero. Ya lo tiene todo el equipo, así que **no** reescribas el historial: deshazlo con un commit nuevo.',
        'The "feat: free shipping for everyone" commit is costing us money. The whole team already has it, so do **not** rewrite history: undo it with a new commit.',
        'angry',
      ),
      guide(
        '`git revert <commit>` crea un commit que hace exactamente lo contrario de otro. El historial queda intacto, por eso es la forma segura de deshacer algo ya compartido.',
        '`git revert <commit>` creates a commit that does the exact opposite of another one. History stays intact, which makes it the safe way to undo something already shared.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'cart.js', CART.replace('return sum;', 'return 0; // envío gratis!!'));
      run(w, 'git commit -am "feat: envío gratis para todos"');
    },
    objectives: [
      obj('revert', 'Revierte el commit problemático', 'Revert the problematic commit', (g) => !!g.head && g.head.message.startsWith('Revert') && history(g.repo, g.head.hash).length === 3 && g.file('cart.js') === CART),
    ],
    hints: [
      t('`HEAD` es el commit actual, justo el que quieres revertir.', '`HEAD` is the current commit, exactly the one you want to revert.'),
      t('Solución: `git revert HEAD`', 'Solution: `git revert HEAD`'),
    ],
    outro: [guide('Mira `git log --oneline`: el commit malo sigue ahí, seguido de su "Revert". Nadie del equipo tendrá problemas al sincronizar.', 'Look at `git log --oneline`: the bad commit is still there, followed by its "Revert". Nobody on the team will have trouble syncing.')],
    solution: ['git log --oneline', 'git revert HEAD'],
  },
];
