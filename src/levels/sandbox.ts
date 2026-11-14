import { CART, ORIGIN, README, guide, t, withOrigin, write } from './helpers';
import type { Level } from './types';

/** Free play: no objectives, a folder with two files and a server to clone from or push to. */
export const SANDBOX: Level = {
  id: 'sandbox',
  chapter: 0,
  title: t('Modo libre', 'Sandbox'),
  teaches: [],
  editMode: 'guided',
  intro: [
    guide(
      `Aquí no hay objetivos ni jefa. Tienes una carpeta con dos archivos y un servidor en \`${ORIGIN}\`. Empieza con \`git init\`, conecta el servidor con \`git remote add origin ${ORIGIN}\`, o rompe cosas a gusto: "Reiniciar nivel" lo deja todo como al principio.`,
      `No objectives and no boss here. You have a folder with two files and a server at \`${ORIGIN}\`. Start with \`git init\`, connect the server with \`git remote add origin ${ORIGIN}\`, or break things freely: "Restart level" puts everything back.`,
    ),
  ],
  setup: (w) => {
    withOrigin(w, { clone: false });
    write(w, 'README.md', README);
    write(w, 'cart.js', CART);
  },
  objectives: [],
  hints: [],
  solution: [],
};
