import type { Commit, Repo, World } from '../engine';
import type { CiResult, CiSpec } from './ci';

/** Localized text. */
export interface L {
  es: string;
  en: string;
}

export type CharacterId = 'boss' | 'diego' | 'sofia' | 'ci' | 'guide';

export interface ChatMessage {
  from: CharacterId;
  text: L;
  tone?: 'normal' | 'angry' | 'happy';
}

/** Read-only view of the game that objectives and events inspect. */
export interface GameView {
  world: World;
  repo: Repo;
  origin: Repo | undefined;
  ci: CiResult | null;
  /** HEAD commit of the local repo. */
  head: Commit | undefined;
  branch: string | undefined;
  /** True when nothing is staged, modified or in conflict. */
  clean: boolean;
  /** Did the player run a command starting with these words? e.g. ran('git status') */
  ran: (prefix: string) => boolean;
  /** Content of a file in the working directory. */
  file: (path: string) => string | undefined;
}

export interface Objective {
  id: string;
  text: L;
  check: (g: GameView) => boolean;
}

/** Something that happens once when its condition becomes true (a teammate pushes, the boss writes…). */
export interface LevelEvent {
  id: string;
  when: (g: GameView) => boolean;
  run?: (world: World) => void;
  messages?: ChatMessage[];
}

/** A one-click code change offered in guided levels. */
export interface GuidedEdit {
  file: string;
  note: L;
  find: string;
  replace: string;
}

export type SolutionStep =
  | string
  | { edit: number }
  | { write: [path: string, content: string] }
  | { resolve: [path: string, choice: 'ours' | 'theirs' | 'both'] };

export interface Level {
  id: string;
  chapter: number;
  title: L;
  /** Commands this level introduces, shown on the roadmap. */
  teaches: string[];
  intro: ChatMessage[];
  outro?: ChatMessage[];
  setup: (world: World) => void;
  objectives: Objective[];
  hints: L[];
  events?: LevelEvent[];
  /** guided: one-click edits and conflict buttons. manual: type the code yourself. */
  editMode: 'guided' | 'manual';
  edits?: GuidedEdit[];
  ci?: CiSpec;
  /** A valid way to beat the level; executed by the test-suite. */
  solution: SolutionStep[];
}

export interface Chapter {
  id: number;
  title: L;
  blurb: L;
}
