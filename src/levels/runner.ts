import {
  createWorld,
  exec,
  getStatus,
  headHash,
  currentBranch,
  resolveConflicts,
  type EngineEvent,
  type ExecResult,
  type World,
} from '../engine';
import { runCi, type CiResult, type TestExecutor } from './ci';
import type { ChatMessage, GameView, Level, SolutionStep } from './types';

/** Everything that changes while a level is being played. Plain data, so it can be cloned. */
export interface Session {
  levelId: string;
  world: World;
  /** Ids of objectives already achieved. */
  done: string[];
  /** Ids of events already fired. */
  fired: string[];
  /** Every command the player ran, as argv. */
  history: string[][];
  chat: ChatMessage[];
  ci: CiResult | null;
  completed: boolean;
}

export function createSession(level: Level): Session {
  const world = createWorld();
  level.setup(world);
  const session: Session = { levelId: level.id, world, done: [], fired: [], history: [], chat: [...level.intro], ci: null, completed: false };
  evaluate(session, level);
  return session;
}

export function viewOf(session: Session): GameView {
  const { world } = session;
  const repo = world.local;
  const head = headHash(repo);
  const st = getStatus(repo);
  const originUrl = repo.remotes.origin ?? Object.keys(world.remotes)[0];
  return {
    world,
    repo,
    origin: originUrl ? world.remotes[originUrl] : undefined,
    ci: session.ci,
    head: head ? repo.commits[head] : undefined,
    branch: currentBranch(repo),
    clean: !st.staged.length && !st.unstaged.length && !st.unmerged.length && !repo.op,
    history: session.history,
    ran: (prefix) => {
      const want = prefix.split(' ');
      return session.history.some((argv) => want.every((w, i) => argv[i] === w));
    },
    file: (path) => repo.workdir[path],
  };
}

/** Fire pending events and tick objectives (in order) until nothing else changes. */
export function evaluate(session: Session, level: Level): void {
  let changed = true;
  while (changed) {
    changed = false;
    const view = viewOf(session);
    for (const ev of level.events ?? []) {
      if (session.fired.includes(ev.id) || !ev.when(view)) continue;
      session.fired.push(ev.id);
      ev.run?.(session.world);
      if (ev.messages) session.chat.push(...ev.messages);
      changed = true;
    }
    for (const obj of level.objectives) {
      if (session.done.includes(obj.id)) continue;
      if (!obj.check(viewOf(session))) break;
      session.done.push(obj.id);
      changed = true;
    }
  }
  if (!session.completed && level.objectives.length > 0 && session.done.length === level.objectives.length) {
    session.completed = true;
    if (level.outro) session.chat.push(...level.outro);
  }
}

/** Run a terminal line. Returns the output plus the push (if any) that should trigger CI. */
export function runLine(session: Session, level: Level, line: string): { result: ExecResult; ciPush: Extract<EngineEvent, { type: 'push' }> | undefined } {
  const result = exec(session.world, line);
  for (const ev of result.events) if (ev.type === 'command') session.history.push(ev.argv);
  evaluate(session, level);
  const ciPush = level.ci
    ? result.events.find((ev): ev is Extract<EngineEvent, { type: 'push' }> => ev.type === 'push' && ev.branch === level.ci!.branch)
    : undefined;
  return { result, ciPush };
}

export function editFile(session: Session, level: Level, path: string, content: string): void {
  session.world.local.workdir[path] = content;
  evaluate(session, level);
}

export function applyGuidedEdit(session: Session, level: Level, index: number): boolean {
  const edit = level.edits?.[index];
  const text = edit ? session.world.local.workdir[edit.file] : undefined;
  if (!edit || text === undefined || !text.includes(edit.find)) return false;
  editFile(session, level, edit.file, text.replace(edit.find, edit.replace));
  return true;
}

const BOSS_ON_FAIL: Record<string, ChatMessage['text']> = {
  markers: {
    es: '¿¡Subiste el archivo con los marcadores `<<<<<<<` del conflicto adentro!? Producción está caída. Arréglalo y vuelve a subir. YA.',
    en: 'You pushed the file with the `<<<<<<<` conflict markers still in it?! Production is down. Fix it and push again. NOW.',
  },
  syntax: {
    es: 'El código que subiste ni siquiera arranca: tiene un error de sintaxis y producción se cayó. Corrígelo con un nuevo commit y súbelo.',
    en: "The code you pushed doesn't even start: it has a syntax error and production went down. Fix it with a new commit and push.",
  },
  tests: {
    es: 'Tu cambio pasó a producción y los clientes están viendo datos incorrectos. Los tests fallan. Revisa qué debía quedar en el archivo, corrige, commit y push.',
    en: 'Your change reached production and customers are seeing wrong numbers. Tests are failing. Check what the file should contain, fix it, commit and push.',
  },
};

/** Run the pipeline for a pushed commit. Does not touch the session. */
export function computeCi(session: Session, level: Level, hash: string, executor: TestExecutor): Promise<CiResult> {
  const tree = Object.values(session.world.remotes).find((r) => r.commits[hash])?.commits[hash].tree ?? {};
  return runCi(tree, level.ci!, hash, executor);
}

/** Record a pipeline result: chat messages (the boss is not happy when it fails) and objectives. */
export function applyCi(session: Session, level: Level, ci: CiResult): void {
  session.ci = ci;
  const failed = ci.stages.find((s) => !s.ok);
  if (failed) {
    session.chat.push({
      from: 'ci',
      tone: 'angry',
      text: { es: `❌ Pipeline falló en la etapa **${failed.id}**: \`${failed.detail}\``, en: `❌ Pipeline failed at stage **${failed.id}**: \`${failed.detail}\`` },
    });
    session.chat.push({ from: 'boss', tone: 'angry', text: BOSS_ON_FAIL[failed.id] });
  } else {
    session.chat.push({ from: 'ci', tone: 'happy', text: { es: '✅ Pipeline en verde. Desplegado a producción.', en: '✅ Pipeline is green. Deployed to production.' } });
  }
  evaluate(session, level);
}

export async function runPipeline(session: Session, level: Level, hash: string, executor: TestExecutor): Promise<CiResult> {
  const ci = await computeCi(session, level, hash, executor);
  applyCi(session, level, ci);
  return ci;
}

/** Play a level's reference solution (used by tests). */
export async function playSolution(level: Level, executor: TestExecutor): Promise<Session> {
  const session = createSession(level);
  const step = async (s: SolutionStep) => {
    if (typeof s === 'string') {
      const { ciPush } = runLine(session, level, s);
      if (ciPush) await runPipeline(session, level, ciPush.hash, executor);
    } else if ('edit' in s) {
      if (!applyGuidedEdit(session, level, s.edit)) throw new Error(`${level.id}: guided edit ${s.edit} does not apply`);
    } else if ('write' in s) editFile(session, level, s.write[0], s.write[1]);
    else {
      const [path, choice] = s.resolve;
      editFile(session, level, path, resolveConflicts(session.world.local.workdir[path], choice));
    }
  };
  for (const s of level.solution) await step(s);
  return session;
}
