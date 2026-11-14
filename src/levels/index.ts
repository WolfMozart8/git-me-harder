import { chapter1 } from './chapters/ch1-basics';
import { chapter2 } from './chapters/ch2-undo';
import { chapter3 } from './chapters/ch3-branches';
import { chapter4 } from './chapters/ch4-stash';
import { chapter5 } from './chapters/ch5-remotes';
import { chapter6 } from './chapters/ch6-teamwork';
import { chapter7 } from './chapters/ch7-advanced';
import type { Chapter, Level } from './types';

export * from './types';
export * from './runner';
export * from './ci';

export const CHAPTERS: Chapter[] = [
  { id: 1, title: { es: 'Lo básico', en: 'The basics' }, blurb: { es: 'Repositorios, staging y commits.', en: 'Repositories, staging and commits.' } },
  { id: 2, title: { es: 'Deshacer', en: 'Undoing' }, blurb: { es: 'Todos nos equivocamos. Git perdona.', en: 'Everyone makes mistakes. Git forgives.' } },
  { id: 3, title: { es: 'Ramas', en: 'Branches' }, blurb: { es: 'Trabajo en paralelo, merges y conflictos.', en: 'Parallel work, merges and conflicts.' } },
  { id: 4, title: { es: 'Stash', en: 'Stash' }, blurb: { es: 'Guardar trabajo a medias.', en: 'Shelving half-done work.' } },
  { id: 5, title: { es: 'Remotos', en: 'Remotes' }, blurb: { es: 'El servidor del equipo: clone, push y pull.', en: "The team's server: clone, push and pull." } },
  { id: 6, title: { es: 'Trabajo en equipo', en: 'Teamwork' }, blurb: { es: 'Conflictos reales, CI y producción.', en: 'Real conflicts, CI and production.' } },
  { id: 7, title: { es: 'Avanzado', en: 'Advanced' }, blurb: { es: 'Rebase, cherry-pick, tags y reflog.', en: 'Rebase, cherry-pick, tags and reflog.' } },
];

export const LEVELS: Level[] = [...chapter1, ...chapter2, ...chapter3, ...chapter4, ...chapter5, ...chapter6, ...chapter7];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);

export function nextLevel(id: string): Level | undefined {
  return LEVELS[LEVELS.findIndex((l) => l.id === id) + 1];
}
