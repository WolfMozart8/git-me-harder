import { create } from 'zustand';
import { c, currentBranch, resolveConflicts, short, type ConflictChoice, type Repo } from './engine';
import type { Lang } from './i18n';
import {
  applyCi,
  applyGuidedEdit,
  computeCi,
  createSession,
  editFile,
  levelById,
  runLine,
  type Level,
  type Session,
} from './levels';
import { SANDBOX } from './levels/sandbox';
import { workerExecutor } from './ui/ciExecutor';

const STORAGE_KEY = 'git-me-harder:v1';

interface Saved {
  lang: Lang;
  completed: string[];
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      lang: raw.lang === 'en' || raw.lang === 'es' ? raw.lang : navigator.language.startsWith('es') ? 'es' : 'en',
      completed: Array.isArray(raw.completed) ? raw.completed.filter((x: unknown) => typeof x === 'string') : [],
    };
  } catch {
    return { lang: 'es', completed: [] };
  }
}

function save(data: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode): the game still works, progress just is not kept
  }
}

export interface TermLine {
  kind: 'cmd' | 'out';
  text: string;
  prompt?: string;
}

export function promptOf(repo: Repo): string {
  if (!repo.initialized) return 'kiwi-market';
  const where = repo.head.type === 'branch' ? currentBranch(repo) : short(repo.head.hash);
  const state = repo.op ? `|${{ merge: 'MERGING', rebase: 'REBASE', 'cherry-pick': 'CHERRY-PICKING', revert: 'REVERTING' }[repo.op.kind]}` : '';
  return `kiwi-market (${where}${state})`;
}

interface GameState extends Saved {
  level: Level | null;
  session: Session | null;
  term: TermLine[];
  hintsShown: number;
  ciRunning: boolean;
  openFile: string | null;
  /** Show the "level complete" banner. */
  celebrate: boolean;
  /** Text queued to be typed into the terminal (clicking a command in the chat). */
  pendingInput: string | null;

  start: (id: string) => void;
  exit: () => void;
  run: (line: string) => void;
  edit: (path: string, content: string) => void;
  applyEdit: (index: number) => void;
  resolve: (path: string, choice: ConflictChoice, block: number) => void;
  showHint: () => void;
  open: (path: string | null) => void;
  dismiss: () => void;
  typeInTerminal: (text: string | null) => void;
  setLang: (lang: Lang) => void;
  resetProgress: () => void;
}

/** Keep the URL in sync so a reload (or a shared link) lands on the same level. */
function setHash(levelId: string | null): void {
  const want = levelId ? `#/level/${levelId}` : '';
  if (location.hash !== want) history.pushState(null, '', want || location.pathname + location.search);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useGame = create<GameState>((set, get) => {
  /** Apply a mutation to a copy of the session, then publish it (and record completion). */
  const mutate = (fn: (session: Session, level: Level) => void, extra: Partial<GameState> = {}) => {
    const { session: current, level, completed, lang } = get();
    if (!current || !level) return;
    const session = structuredClone(current);
    fn(session, level);
    const patch: Partial<GameState> = { session, ...extra };
    if (session.completed && !current.completed) {
      patch.celebrate = true;
      if (!completed.includes(level.id)) {
        patch.completed = [...completed, level.id];
        save({ lang, completed: patch.completed });
      }
    }
    // keep the open file valid; open a conflicted file automatically
    const files = Object.keys(session.world.local.workdir);
    const open = get().openFile;
    const newConflict = session.world.local.conflicts.find((p) => !current.world.local.conflicts.includes(p));
    if (newConflict) patch.openFile = newConflict;
    else if (open && !files.includes(open)) patch.openFile = files.sort()[0] ?? null;
    else if (!open && files.length) patch.openFile = files.sort()[0];
    set(patch);
  };

  return {
    ...load(),
    level: null,
    session: null,
    term: [],
    hintsShown: 0,
    ciRunning: false,
    openFile: null,
    celebrate: false,
    pendingInput: null,

    start: (id) => {
      const level = id === SANDBOX.id ? SANDBOX : levelById(id);
      if (!level) return;
      const session = createSession(level);
      setHash(level.id);
      const files = Object.keys(session.world.local.workdir).sort();
      const preferred = level.edits?.[0]?.file;
      set({
        level,
        session,
        term: [],
        hintsShown: 0,
        ciRunning: false,
        celebrate: false,
        pendingInput: null,
        openFile: preferred && files.includes(preferred) ? preferred : (files.find((f) => f.endsWith('.js')) ?? files[0] ?? null),
      });
    },

    exit: () => {
      setHash(null);
      set({ level: null, session: null, term: [], celebrate: false });
    },

    run: (line) => {
      const { session: current, term } = get();
      if (!current || !line.trim()) return;
      const prompt = promptOf(current.world.local);
      let pushed: { hash: string } | undefined;
      let cleared = false;
      const out: TermLine[] = [];
      mutate((session, level) => {
        const { result, ciPush } = runLine(session, level, line);
        pushed = ciPush;
        cleared = !!result.clear;
        for (const text of result.lines) out.push({ kind: 'out', text });
      });
      set({ term: cleared ? [] : [...term, { kind: 'cmd', text: line, prompt }, ...out] });
      if (pushed) void runCiFor(pushed.hash);
    },

    edit: (path, content) => {
      if (get().session?.world.local.workdir[path] === content) return;
      mutate((session, level) => editFile(session, level, path, content));
    },

    applyEdit: (index) => mutate((session, level) => void applyGuidedEdit(session, level, index)),

    resolve: (path, choice, block) =>
      mutate((session, level) => {
        const text = session.world.local.workdir[path];
        if (text !== undefined) editFile(session, level, path, resolveConflicts(text, choice, block));
      }),

    showHint: () => {
      const { level, hintsShown } = get();
      if (level) set({ hintsShown: Math.min(hintsShown + 1, level.hints.length) });
    },

    open: (path) => set({ openFile: path }),
    dismiss: () => set({ celebrate: false }),
    typeInTerminal: (text) => set({ pendingInput: text }),

    setLang: (lang) => {
      set({ lang });
      save({ lang, completed: get().completed });
    },

    resetProgress: () => {
      set({ completed: [] });
      save({ lang: get().lang, completed: [] });
    },
  };

  /** The simulated pipeline: prints its stages in the terminal, then reports in the chat. */
  async function runCiFor(hash: string): Promise<void> {
    const start = get();
    if (!start.session || !start.level) return;
    const levelId = start.level.id;
    const say = (text: string) => set({ term: [...get().term, { kind: 'out', text }] });
    set({ ciRunning: true });
    say(c.dim(`remote: CI pipeline #${short(hash)} started…`));
    const [ci] = await Promise.all([computeCi(start.session, start.level, hash, workerExecutor), sleep(900)]);
    if (get().level?.id !== levelId || !get().session) return set({ ciRunning: false });
    for (const stage of ci.stages) {
      say(`remote:   ${stage.ok ? c.green('✔') : c.red('✘')} ${stage.id}${stage.detail ? c.dim('  ' + stage.detail) : ''}`);
    }
    say(ci.passed ? c.green('remote: pipeline passed — deployed') : c.red('remote: pipeline FAILED'));
    mutate((session, level) => applyCi(session, level, ci), { ciRunning: false });
  }
});
