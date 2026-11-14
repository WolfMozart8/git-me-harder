import { isAncestor } from '../../engine';
import { CART, CART_BUGGY, boss, diego, guide, hasMarkers, headHas, mine, obj, run, sofia, t, teammate, withOrigin, write } from '../helpers';
import type { Level } from '../types';

const SHIPPING_MINE = 'const SHIPPING = 5;\n\n' + CART.replace('return sum;', 'return sum + SHIPPING;');
const DISCOUNT_THEIRS = CART.replace('return sum;', 'return sum - discount(sum);') + '\nfunction discount(sum) {\n  return sum >= 100 ? 10 : 0;\n}\n';
export const SHIPPING_MERGED = 'const SHIPPING = 5;\n\n' + DISCOUNT_THEIRS.replace('return sum - discount(sum);', 'return sum - discount(sum) + SHIPPING;');

const WISHLIST = 'function addToWishlist(list, item) {\n  list.push(item);\n}\n';
const WISHLIST_WIP = WISHLIST + '\nfunction removeFromWishlist(list, item) {\n  // TODO: a medias\n}\n';
const COUPONS = 'function applyCoupon(total, code) {\n  return code === "KIWI10" ? total * 0.9 : total;\n}\n';

export const PROMO_MERGED = CART.replace('return sum;', 'return Math.round(sum * 0.9);');

export const chapter6: Level[] = [
  {
    id: '6-1',
    chapter: 6,
    title: t('Dos manos en el mismo archivo', 'Two hands in the same file'),
    teaches: ['git pull', 'conflictos', 'CI'],
    editMode: 'manual',
    intro: [
      boss(
        'Sube tu cambio del costo de envío a `main`. Diego acaba de subir su descuento sobre la misma línea de `cart.js`, así que necesito **los dos**. La línea final tiene que quedar exactamente así:\n`return sum - discount(sum) + SHIPPING;`',
        "Push your shipping cost change to `main`. Diego just pushed his discount on the same line of `cart.js`, so I need **both**. The final line must read exactly:\n`return sum - discount(sum) + SHIPPING;`",
      ),
      guide(
        'Se acabaron los botones: aquí el conflicto se resuelve a mano. En el editor, borra las tres líneas de marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) y deja una sola línea `return` correcta. Cada push a `main` pasa por el pipeline de CI, que ejecuta el código de verdad: si subes algo roto, producción se cae.',
        'No more buttons: here you resolve the conflict by hand. In the editor, delete the three marker lines (`<<<<<<<`, `=======`, `>>>>>>>`) and leave a single correct `return` line. Every push to `main` goes through the CI pipeline, which really runs the code: if you push something broken, production goes down.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      write(w, 'cart.js', SHIPPING_MINE);
      run(w, 'git commit -am "feat: shipping cost"');
      teammate(w, { branch: 'main', author: 'Diego', message: 'feat: discount over 100', files: { 'cart.js': DISCOUNT_THEIRS } });
    },
    ci: {
      branch: 'main',
      entry: 'cart.js',
      tests: [
        { name: t('descuento + envío', 'discount + shipping'), expr: 'total([{ price: 100, qty: 1 }]) === 95' },
        { name: t('solo envío', 'shipping only'), expr: 'total([{ price: 10, qty: 2 }]) === 25' },
      ],
    },
    objectives: [
      obj('pull', 'Trae los cambios de Diego (aparecerá el conflicto)', "Bring in Diego's changes (the conflict will show up)", (g) => !!g.repo.op || g.repo.conflicts.length > 0 || headHas(g, 'feat: discount over 100')),
      obj('resolve', 'Resuelve el conflicto a mano y cierra el merge', 'Resolve the conflict by hand and conclude the merge', (g) => g.clean && headHas(g, 'feat: discount over 100') && headHas(g, 'feat: shipping cost')),
      obj('ci', 'Sube a `main` y deja el pipeline en verde', 'Push to `main` and get the pipeline green', (g) => !!g.ci?.passed && !!g.head && g.origin?.branches.main === g.head.hash),
    ],
    hints: [
      t('Empieza con `git pull`. Después abre `cart.js`: el conflicto está en la línea del `return`.', 'Start with `git pull`. Then open `cart.js`: the conflict is on the `return` line.'),
      t('Entre los marcadores hay dos líneas `return`. Reemplaza todo el bloque (marcadores incluidos) por: `  return sum - discount(sum) + SHIPPING;`', 'Between the markers there are two `return` lines. Replace the whole block (markers included) with: `  return sum - discount(sum) + SHIPPING;`'),
      t('Después: `git add cart.js` → `git commit -m "merge: descuento y envío"` → `git push`. Si el CI falla, corrige el archivo, haz otro commit y vuelve a subir.', 'Then: `git add cart.js` → `git commit -m "merge: discount and shipping"` → `git push`. If CI fails, fix the file, commit again and push again.'),
    ],
    solution: ['git pull', { write: ['cart.js', SHIPPING_MERGED] }, 'git add cart.js', 'git commit -m "merge: discount and shipping"', 'git push'],
  },
  {
    id: '6-2',
    chapter: 6,
    title: t('Alguien tocó tu rama', 'Someone touched your branch'),
    teaches: ['git pull --rebase', 'git push'],
    editMode: 'manual',
    intro: [
      boss(
        'Añade la función de compartir a tu rama `wishlist` y súbela. Basta con añadir una línea a `wishlist.js`, por ejemplo: `echo "function share() {}" >> wishlist.js`.',
        'Add the share feature to your `wishlist` branch and push it. Appending a line to `wishlist.js` is enough, e.g.: `echo "function share() {}" >> wishlist.js`.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      run(w, 'git switch -c wishlist');
      write(w, 'wishlist.js', WISHLIST);
      run(w, 'git add .', 'git commit -m "feat: wishlist"', 'git push -u origin wishlist');
    },
    events: [
      {
        id: 'sofia-pushes',
        when: (g) => g.branch === 'wishlist' && (mine(g) || []).length >= 2,
        run: (w) => teammate(w, { branch: 'wishlist', author: 'Sofía', message: 'style: wishlist styles', files: { 'wishlist.css': '.wishlist { color: green; }\n' } }),
        messages: [
          sofia(
            '¡Hola! Te subí los estilos directamente a tu rama `wishlist`, espero que no te moleste 🙈',
            'Hi! I pushed the styles straight to your `wishlist` branch, hope you don\'t mind 🙈',
          ),
          guide(
            'Tu rama del servidor ahora tiene un commit que tú no tienes: el push va a ser rechazado. Puedes integrar con `git pull` (crea un commit de merge) o con `git pull --rebase`, que recoloca tu commit encima del de Sofía y deja el historial en línea recta.',
            'Your branch on the server now has a commit you lack: the push will be rejected. You can integrate with `git pull` (creates a merge commit) or with `git pull --rebase`, which replays your commit on top of Sofía\'s and keeps history in a straight line.',
          ),
        ],
      },
    ],
    objectives: [
      obj('commit', 'Haz un commit nuevo en `wishlist`', 'Make a new commit on `wishlist`', (g) => g.branch === 'wishlist' && g.clean && (mine(g) || []).length >= 2),
      obj('sync', 'Integra el commit de Sofía en tu rama', "Integrate Sofía's commit into your branch", (g) => g.clean && headHas(g, 'style: wishlist styles') && (mine(g) || []).length >= 2),
      obj('push', 'Sube la rama al servidor', 'Push the branch to the server', (g) => !!g.head && g.origin?.branches.wishlist === g.head.hash),
    ],
    hints: [
      t('Tras tu commit, intenta `git push` y lee el rechazo.', 'After your commit, try `git push` and read the rejection.'),
      t('Solución: `echo "function share() {}" >> wishlist.js` → `git commit -am "feat: share"` → `git pull --rebase` → `git push`', 'Solution: `echo "function share() {}" >> wishlist.js` → `git commit -am "feat: share"` → `git pull --rebase` → `git push`'),
    ],
    solution: ['echo "function share() {}" >> wishlist.js', 'git commit -am "feat: share"', 'git push', 'git pull --rebase', 'git push'],
  },
  {
    id: '6-3',
    chapter: 6,
    title: t('Hotfix en producción', 'Production hotfix'),
    teaches: ['git stash', 'git pull', 'git merge', 'CI'],
    editMode: 'manual',
    intro: [
      boss(
        '🔥 PRODUCCIÓN ESTÁ COBRANDO MAL. En `cart.js` de `main` hay una suma donde va una multiplicación: tiene que decir `sum += item.price * item.qty;`. Deja lo que estés haciendo, arréglalo en `main` y súbelo. Después vuelves a tu rama.',
        '🔥 PRODUCTION IS CHARGING WRONG AMOUNTS. In `cart.js` on `main` there is an addition where a multiplication goes: it must read `sum += item.price * item.qty;`. Drop what you are doing, fix it on `main` and push. Then go back to your branch.',
        'angry',
      ),
      guide(
        'Estás en `wishlist` con cambios sin guardar. Tendrás que combinar todo lo aprendido: guardar tu trabajo, ir a `main`, ponerte al día (Diego subió algo hace un rato), corregir a mano, subir y volver. Nadie te dice el orden exacto: `git status` es tu amigo.',
        'You are on `wishlist` with unsaved changes. You will need everything you have learned: save your work, go to `main`, catch up (Diego pushed something a while ago), fix by hand, push and come back. Nobody tells you the exact order: `git status` is your friend.',
      ),
    ],
    setup: (w) => {
      withOrigin(w, { cart: CART_BUGGY });
      run(w, 'git switch -c wishlist');
      write(w, 'wishlist.js', WISHLIST);
      run(w, 'git add .', 'git commit -m "feat: wishlist"');
      write(w, 'wishlist.js', WISHLIST_WIP);
      teammate(w, { branch: 'main', author: 'Diego', message: 'feat: coupons', files: { 'coupons.js': COUPONS } });
    },
    ci: {
      branch: 'main',
      entry: 'cart.js',
      tests: [
        { name: t('2 unidades de 10', '2 units at 10'), expr: 'total([{ price: 10, qty: 2 }]) === 20' },
        { name: t('3 unidades de 3', '3 units at 3'), expr: 'total([{ price: 3, qty: 3 }]) === 9' },
      ],
    },
    objectives: [
      obj('stash', 'Guarda tu trabajo a medias', 'Save your work in progress', (g) => g.repo.stash.length > 0),
      obj('ci', 'Sube el arreglo a `main` con el pipeline en verde', 'Push the fix to `main` with a green pipeline', (g) => !!g.ci?.passed && !!g.origin?.commits[g.origin.branches.main].tree['cart.js'].includes('item.price * item.qty')),
      obj('back', 'Vuelve a `wishlist` y recupera tu trabajo', 'Go back to `wishlist` and recover your work', (g) => g.branch === 'wishlist' && !g.repo.stash.length && !!g.file('wishlist.js')?.includes('removeFromWishlist')),
    ],
    hints: [
      t('Orden sugerido: `git stash` → `git switch main` → `git pull` → corregir `cart.js` en el editor.', 'Suggested order: `git stash` → `git switch main` → `git pull` → fix `cart.js` in the editor.'),
      t('En `cart.js` cambia `item.price + item.qty` por `item.price * item.qty`. Luego `git commit -am "fix: total"` y `git push`.', 'In `cart.js` change `item.price + item.qty` to `item.price * item.qty`. Then `git commit -am "fix: total"` and `git push`.'),
      t('Para terminar: `git switch wishlist` → `git stash pop`.', 'To finish: `git switch wishlist` → `git stash pop`.'),
    ],
    outro: [boss('Producción vuelve a cobrar bien. Buen trabajo bajo presión.', 'Production is charging correctly again. Good work under pressure.', 'happy')],
    solution: [
      'git stash',
      'git switch main',
      'git pull',
      'git switch -c hotfix',
      { write: ['cart.js', CART] },
      'git commit -am "fix: cart total"',
      'git switch main',
      'git merge hotfix',
      'git push',
      'git switch wishlist',
      'git stash pop',
    ],
  },
  {
    id: '6-4',
    chapter: 6,
    title: t('Mantén tu rama al día', 'Keep your branch up to date'),
    teaches: ['git fetch', 'git merge origin/main', 'CI'],
    editMode: 'manual',
    intro: [
      boss(
        'Antes de revisar tu rama `promo` la quiero actualizada con `main`. Sofía subió el redondeo de precios y toca la misma línea que tú. Tienen que convivir los dos cambios:\n`return Math.round(sum * 0.9);`',
        'Before I review your `promo` branch I want it updated with `main`. Sofía pushed price rounding and it touches the same line as you. Both changes must live together:\n`return Math.round(sum * 0.9);`',
      ),
      diego(
        'Tip: no hace falta cambiar de rama. `git fetch` y después `git merge origin/main` traen `main` a tu rama. El CI también corre en `promo`.',
        'Tip: no need to switch branches. `git fetch` and then `git merge origin/main` bring `main` into your branch. CI also runs on `promo`.',
      ),
    ],
    setup: (w) => {
      withOrigin(w);
      run(w, 'git switch -c promo');
      write(w, 'cart.js', CART.replace('return sum;', 'return sum * 0.9;'));
      run(w, 'git commit -am "feat: 10% promo"', 'git push -u origin promo');
      teammate(w, { branch: 'main', author: 'Sofía', message: 'feat: round totals', files: { 'cart.js': CART.replace('return sum;', 'return Math.round(sum);') } });
    },
    ci: {
      branch: 'promo',
      entry: 'cart.js',
      tests: [
        { name: t('10% de descuento', '10% off'), expr: 'total([{ price: 10, qty: 1 }]) === 9' },
        { name: t('redondeo', 'rounding'), expr: 'total([{ price: 5, qty: 1 }]) === 5' },
      ],
    },
    objectives: [
      obj('fetch', 'Descarga las novedades de `main`', 'Download the news from `main`', (g) => g.repo.remoteRefs['origin/main'] === g.origin?.branches.main),
      obj('merge', 'Integra `origin/main` en `promo` resolviendo el conflicto', 'Merge `origin/main` into `promo`, resolving the conflict', (g) =>
        g.branch === 'promo' && g.clean && !hasMarkers(g.file('cart.js')) && isAncestor(g.repo, g.origin?.branches.main, g.head?.hash),
      ),
      obj('ci', 'Sube `promo` con el pipeline en verde', 'Push `promo` with a green pipeline', (g) => !!g.ci?.passed && !!g.head && g.origin?.branches.promo === g.head.hash),
    ],
    hints: [
      t('`git fetch` → `git merge origin/main`. El conflicto está otra vez en el `return`.', '`git fetch` → `git merge origin/main`. The conflict is on the `return` again.'),
      t('Deja una sola línea: `  return Math.round(sum * 0.9);` y borra los marcadores.', 'Leave a single line: `  return Math.round(sum * 0.9);` and delete the markers.'),
      t('Después: `git add cart.js` → `git commit -m "merge main"` → `git push`.', 'Then: `git add cart.js` → `git commit -m "merge main"` → `git push`.'),
    ],
    solution: ['git fetch', 'git merge origin/main', { write: ['cart.js', PROMO_MERGED] }, 'git add cart.js', 'git commit -m "merge main into promo"', 'git push'],
  },
];
