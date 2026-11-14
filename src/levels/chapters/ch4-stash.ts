import { CART, CART_BUGGY, README, boss, guide, localBase, obj, run, t, write } from '../helpers';
import type { Level } from '../types';

const WISHLIST = 'function addToWishlist(list, item) {\n  list.push(item);\n}\n';
const WISHLIST_WIP = WISHLIST + '\nfunction removeFromWishlist(list, item) {\n  // TODO: a medias\n}\n';

export const chapter4: Level[] = [
  {
    id: '4-1',
    chapter: 4,
    title: t('Deja eso, hay un bug', 'Drop that, there is a bug'),
    teaches: ['git stash', 'git stash pop'],
    editMode: 'guided',
    intro: [
      boss(
        'Sé que estás a medias con la wishlist, pero el total del carrito está mal en `main` y lo necesito arreglado YA. Ve a `main`, corrige `cart.js` y haz commit. Después sigues con lo tuyo.',
        "I know you're halfway through the wishlist, but the cart total is wrong on `main` and I need it fixed NOW. Go to `main`, fix `cart.js` and commit. Then get back to your thing.",
        'angry',
      ),
      guide(
        'Tu trabajo a medias no está para un commit, y git no te dejará cambiar de rama con él. `git stash` lo guarda en un cajón aparte y deja la carpeta limpia; `git stash pop` lo devuelve cuando vuelvas.',
        'Your half-done work is not ready for a commit, and git will not let you switch branches with it. `git stash` puts it in a drawer and leaves the folder clean; `git stash pop` brings it back when you return.',
      ),
    ],
    setup: (w) => {
      localBase(w, CART_BUGGY);
      run(w, 'git switch -c wishlist');
      write(w, 'wishlist.js', WISHLIST);
      run(w, 'git add .', 'git commit -m "feat: wishlist"');
      write(w, 'wishlist.js', WISHLIST_WIP);
    },
    edits: [{ file: 'cart.js', note: t('Multiplica precio por cantidad', 'Multiply price by quantity'), find: 'item.price + item.qty', replace: 'item.price * item.qty' }],
    objectives: [
      obj('stash', 'Guarda tu trabajo a medias con `git stash`', 'Save your work in progress with `git stash`', (g) => g.repo.stash.length > 0 && g.clean),
      obj('fix', 'En `main`, corrige `cart.js` y haz commit', 'On `main`, fix `cart.js` and commit', (g) => !!g.repo.commits[g.repo.branches.main].tree['cart.js'].includes('item.price * item.qty')),
      obj('back', 'Vuelve a la rama `wishlist`', 'Go back to the `wishlist` branch', (g) => g.branch === 'wishlist'),
      obj('pop', 'Recupera tu trabajo con `git stash pop`', 'Get your work back with `git stash pop`', (g) => !g.repo.stash.length && !!g.file('wishlist.js')?.includes('removeFromWishlist')),
    ],
    hints: [
      t('Prueba a hacer `git switch main` sin guardar nada: git se niega para no pisar tu trabajo.', 'Try `git switch main` without saving anything: git refuses so it does not clobber your work.'),
      t('En `main`, abre `cart.js`, aplica el cambio sugerido y usa `git commit -am "fix: total"`.', 'On `main`, open `cart.js`, apply the suggested change and use `git commit -am "fix: total"`.'),
      t('Solución: `git stash` → `git switch main` → aplicar cambio → `git commit -am "fix: total"` → `git switch wishlist` → `git stash pop`', 'Solution: `git stash` → `git switch main` → apply change → `git commit -am "fix: total"` → `git switch wishlist` → `git stash pop`'),
    ],
    solution: ['git stash', 'git switch main', { edit: 0 }, 'git commit -am "fix: cart total"', 'git switch wishlist', 'git stash pop'],
  },
  {
    id: '4-2',
    chapter: 4,
    title: t('El cajón de los stashes', 'The stash drawer'),
    teaches: ['git stash list', 'git stash apply', 'git stash drop'],
    editMode: 'guided',
    intro: [
      boss(
        'Necesito el borrador de documentación que guardaste en un stash la semana pasada. Y ya que estás, tira ese otro experimento roto que tienes guardado.',
        'I need the documentation draft you stashed last week. And while you are at it, throw away that other broken experiment you have stashed.',
      ),
      guide(
        'Los stashes se apilan: el más reciente es `stash@{0}`. `git stash list` los muestra, `git stash apply stash@{1}` aplica uno concreto sin sacarlo de la pila, y `git stash drop stash@{n}` lo elimina.',
        'Stashes pile up: the most recent is `stash@{0}`. `git stash list` shows them, `git stash apply stash@{1}` applies a specific one without removing it from the pile, and `git stash drop stash@{n}` deletes it.',
      ),
    ],
    setup: (w) => {
      localBase(w);
      write(w, 'README.md', README + '\n## Draft\n\nHow to run the store locally.\n');
      run(w, 'git stash push -m "borrador docs"');
      write(w, 'cart.js', CART.replace('let sum = 0;', 'let sum = NaN; // ???'));
      run(w, 'git stash push -m "experimento roto"');
    },
    objectives: [
      obj('list', 'Mira qué hay guardado con `git stash list`', 'See what is stashed with `git stash list`', (g) => g.ran('git stash list')),
      obj('apply', 'Recupera el borrador de documentación', 'Recover the documentation draft', (g) => !!g.file('README.md')?.includes('## Draft')),
      obj('drop', 'Deja la pila de stashes vacía, sin el experimento en tus archivos', 'Leave the stash pile empty, without the experiment in your files', (g) => !g.repo.stash.length && g.file('cart.js') === CART && !!g.file('README.md')?.includes('## Draft')),
    ],
    hints: [
      t('El borrador es el más antiguo, así que es `stash@{1}`.', 'The draft is the older one, so it is `stash@{1}`.'),
      t('Después de un `drop` los índices se recolocan: lo que era `stash@{1}` pasa a ser `stash@{0}`.', 'After a `drop` the indexes shift: what was `stash@{1}` becomes `stash@{0}`.'),
      t('Solución: `git stash list` → `git stash apply stash@{1}` → `git stash drop stash@{1}` → `git stash drop`', 'Solution: `git stash list` → `git stash apply stash@{1}` → `git stash drop stash@{1}` → `git stash drop`'),
    ],
    solution: ['git stash list', 'git stash apply stash@{1}', 'git stash drop stash@{1}', 'git stash drop'],
  },
];
