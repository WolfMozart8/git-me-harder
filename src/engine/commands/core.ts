import { mergeTrees, type TreeMerge } from '../merge';
import {
  aheadBehind,
  c,
  commitsBetween,
  diffTrees,
  getStatus,
  headHash,
  headTree,
  makeCommit,
  moveHead,
  short,
  treeOf,
} from '../repo';
import { GitError, type EngineEvent, type Head, type Repo, type Tree, type World } from '../types';

export interface Ctx {
  world: World;
  repo: Repo;
  out: (...lines: string[]) => void;
  events: EngineEvent[];
}

export type Command = (ctx: Ctx, args: string[]) => void;

// ---------- argument parsing ----------
export interface Parsed {
  flags: Set<string>;
  values: Record<string, string>;
  rest: string[];
  /** Arguments after a literal `--`. */
  afterDashes: string[] | null;
}

export function parseArgs(args: string[], valued: string[] = []): Parsed {
  const p: Parsed = { flags: new Set(), values: {}, rest: [], afterDashes: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (p.afterDashes) p.afterDashes.push(a);
    else if (a === '--') p.afterDashes = [];
    else if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      p.values[a.slice(0, eq)] = a.slice(eq + 1);
    } else if (valued.includes(a)) p.values[a] = args[++i] ?? '';
    else if (a === '-am' && valued.includes('-m')) {
      p.flags.add('-a');
      p.values['-m'] = args[++i] ?? '';
    } else if (/^-\d+$/.test(a)) p.values['-n'] = a.slice(1);
    else if (a.startsWith('-') && a.length > 1) p.flags.add(a);
    else p.rest.push(a);
  }
  return p;
}

// ---------- paths ----------
export function matchPaths(spec: string, candidates: string[]): string[] {
  const s = spec.replace(/^\.\//, '').replace(/\/$/, '');
  if (s === '.' || s === '' || s === '*') return candidates;
  if (s.includes('*')) {
    const re = new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return candidates.filter((p) => re.test(p));
  }
  return candidates.filter((p) => p === s || p.startsWith(s + '/'));
}

export const subject = (message: string) => message.split('\n')[0];

export function describe(repo: Repo, hash: string): string {
  return `${short(hash)} ${subject(repo.commits[hash].message)}`;
}

// ---------- working tree helpers ----------
/**
 * Refuse to continue if moving the tree `from` → `to` would clobber local changes.
 */
export function checkOverwrite(repo: Repo, from: Tree, to: Tree, op: string): void {
  const hit = diffTrees(from, to)
    .map((ch) => ch.path)
    .filter((p) => repo.workdir[p] !== from[p] || repo.index[p] !== from[p]);
  if (hit.length) {
    throw new GitError([
      `error: Your local changes to the following files would be overwritten by ${op}:`,
      ...hit.map((p) => `\t${p}`),
      `Please commit your changes or stash them before you ${op === 'checkout' ? 'switch branches' : op}.`,
      'Aborting',
    ]);
  }
}

/** Apply the difference `from` → `to` on the working tree and index, keeping unrelated local changes. */
export function applyTreeChange(repo: Repo, from: Tree, to: Tree): void {
  for (const ch of diffTrees(from, to)) {
    if (ch.path in to) {
      repo.workdir[ch.path] = to[ch.path];
      repo.index[ch.path] = to[ch.path];
    } else {
      delete repo.workdir[ch.path];
      delete repo.index[ch.path];
    }
  }
}

/** Reset index and tracked files to a commit, keeping untracked files. */
export function hardReset(repo: Repo, hash: string | undefined): void {
  const tree = treeOf(repo, hash);
  const tracked = new Set([...Object.keys(repo.index), ...Object.keys(headTree(repo)), ...repo.conflicts]);
  const untracked = Object.fromEntries(Object.entries(repo.workdir).filter(([p]) => !tracked.has(p)));
  repo.workdir = { ...untracked, ...tree };
  repo.index = { ...tree };
  repo.conflicts = [];
}

/** Write a merge result: clean paths go to index + workdir, conflicted paths only to the workdir. */
export function applyMerge(repo: Repo, ours: Tree, result: TreeMerge): void {
  const conflicted = new Set(result.conflicts.map((x) => x.path));
  for (const ch of diffTrees(ours, result.tree)) {
    const p = ch.path;
    if (p in result.tree) repo.workdir[p] = result.tree[p];
    else delete repo.workdir[p];
    if (conflicted.has(p)) continue;
    if (p in result.tree) repo.index[p] = result.tree[p];
    else delete repo.index[p];
  }
  repo.conflicts = [...conflicted];
}

export function trackingLines(repo: Repo, branch: string): string[] {
  const ab = aheadBehind(repo, branch);
  if (!ab) return [];
  const s = (n: number) => (n === 1 ? '' : 's');
  if (!ab.ahead && !ab.behind) return [`Your branch is up to date with '${ab.upstream}'.`];
  if (ab.ahead && !ab.behind) {
    return [`Your branch is ahead of '${ab.upstream}' by ${ab.ahead} commit${s(ab.ahead)}.`, '  (use "git push" to publish your local commits)'];
  }
  if (!ab.ahead) {
    return [
      `Your branch is behind '${ab.upstream}' by ${ab.behind} commit${s(ab.behind)}, and can be fast-forwarded.`,
      '  (use "git pull" to update your local branch)',
    ];
  }
  return [
    `Your branch and '${ab.upstream}' have diverged,`,
    `and have ${ab.ahead} and ${ab.behind} different commits each, respectively.`,
    '  (use "git pull" if you want to integrate the remote branch with yours)',
  ];
}

// ---------- sequencer: cherry-pick / revert / rebase ----------
type PickKind = 'cherry-pick' | 'revert' | 'rebase';

function pickPlan(repo: Repo, hash: string, kind: PickKind) {
  const cm = repo.commits[hash];
  const parentTree = treeOf(repo, cm.parents[0]);
  const desc = `${short(hash)} (${subject(cm.message)})`;
  if (kind === 'revert') {
    return {
      base: cm.tree,
      theirs: parentTree,
      label: `parent of ${desc}`,
      message: `Revert "${subject(cm.message)}"\n\nThis reverts commit ${hash}.`,
      author: undefined as string | undefined,
    };
  }
  return { base: parentTree, theirs: cm.tree, label: desc, message: cm.message, author: cm.author };
}

/**
 * Apply one commit on top of HEAD. Returns false when it stopped on conflicts
 * (repo.op is then updated with the step in progress).
 */
function pickOne(ctx: Ctx, hash: string, kind: PickKind): boolean {
  const { repo, world } = ctx;
  const plan = pickPlan(repo, hash, kind);
  const ours = headTree(repo);
  const result = mergeTrees(plan.base, ours, plan.theirs, { ours: 'HEAD', theirs: plan.label });
  checkOverwrite(repo, ours, result.tree, kind);
  applyMerge(repo, ours, result);
  if (result.conflicts.length) {
    for (const cf of result.conflicts) ctx.out(cf.message);
    repo.op!.current = hash;
    repo.op!.message = plan.message;
    repo.op!.author = plan.author;
    ctx.out(`error: could not ${kind === 'rebase' ? 'apply' : kind} ${short(hash)}... ${subject(repo.commits[hash].message)}`);
    const cont = `git ${kind} --continue`;
    ctx.out(`hint: After resolving the conflicts, mark them with "git add <pathspec>",`, `hint: then run "${cont}".`);
    ctx.out(`hint: To abort and get back to the state before "git ${kind}", run "git ${kind} --abort".`);
    return false;
  }
  if (!diffTrees(ours, result.tree).length) {
    if (kind !== 'rebase') ctx.out(`The previous ${kind} is now empty, skipping ${short(hash)}.`);
    return true;
  }
  const parent = headHash(repo)!;
  const newHash = makeCommit(world, repo, { tree: repo.index, parents: [parent], message: plan.message, author: plan.author });
  moveHead(repo, newHash, `${kind}: ${subject(plan.message)}`);
  if (kind !== 'rebase') {
    const where = repo.head.type === 'branch' ? repo.head.name : 'detached HEAD';
    ctx.out(`[${where} ${short(newHash)}] ${subject(plan.message)}`);
  }
  return true;
}

function finishOp(ctx: Ctx): void {
  const { repo } = ctx;
  const op = repo.op!;
  if (op.kind === 'rebase' && op.branch) {
    const tip = headHash(repo)!;
    repo.branches[op.branch] = tip;
    repo.head = { type: 'branch', name: op.branch };
    repo.reflog.unshift({ hash: tip, message: `rebase (finish): returning to refs/heads/${op.branch}` });
    ctx.out(`Successfully rebased and updated refs/heads/${op.branch}.`);
  }
  repo.op = null;
}

/** Run the remaining todo list of the current operation. */
export function runTodo(ctx: Ctx): void {
  const op = ctx.repo.op!;
  const kind = op.kind as PickKind;
  while (op.todo.length) {
    const next = op.todo.shift()!;
    if (!pickOne(ctx, next, kind)) return;
  }
  finishOp(ctx);
}

export function startSequence(ctx: Ctx, kind: PickKind, todo: string[], extra: { branch?: string; onto?: string; origHead?: Head; origHash?: string } = {}): void {
  const { repo } = ctx;
  repo.op = {
    kind,
    origHead: extra.origHead ?? { ...repo.head },
    origHash: extra.origHash ?? headHash(repo)!,
    message: '',
    todo: [...todo],
    branch: extra.branch,
    onto: extra.onto,
  };
  runTodo(ctx);
}

export function unmergedError(): GitError {
  return new GitError([
    'error: Committing is not possible because you have unmerged files.',
    "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
    'hint: as appropriate to mark resolution and make a commit.',
    'fatal: Exiting because of an unresolved conflict.',
  ]);
}

/** Commit the step in progress of an operation (if there is something to commit). */
export function commitStep(ctx: Ctx, messageOverride?: string): string | undefined {
  const { repo, world } = ctx;
  const op = repo.op!;
  if (repo.conflicts.length) throw unmergedError();
  const head = headHash(repo)!;
  const isMerge = op.kind === 'merge';
  if (!isMerge && !diffTrees(headTree(repo), repo.index).length) return undefined;
  const hash = makeCommit(world, repo, {
    tree: repo.index,
    parents: isMerge ? [head, op.mergeHead!] : [head],
    message: messageOverride ?? op.message,
    author: op.author,
  });
  moveHead(repo, hash, `commit (${op.kind}): ${subject(messageOverride ?? op.message)}`);
  const where = repo.head.type === 'branch' ? repo.head.name : 'detached HEAD';
  ctx.out(`[${where} ${short(hash)}] ${subject(repo.commits[hash].message)}`);
  ctx.events.push({ type: 'commit', hash });
  return hash;
}

export function continueOp(ctx: Ctx, kind: string): void {
  const { repo } = ctx;
  if (!repo.op || repo.op.kind !== kind) throw new GitError(`fatal: No ${kind} in progress?`);
  commitStep(ctx);
  if (repo.op.kind === 'merge') repo.op = null;
  else runTodo(ctx);
}

export function abortOp(ctx: Ctx, kind: string): void {
  const { repo } = ctx;
  const op = repo.op;
  if (!op || op.kind !== kind) {
    throw new GitError(kind === 'merge' ? 'fatal: There is no merge to abort (MERGE_HEAD missing).' : `fatal: No ${kind} in progress?`);
  }
  hardReset(repo, op.origHash);
  repo.head = op.origHead;
  if (op.origHead.type === 'branch') repo.branches[op.origHead.name] = op.origHash;
  repo.reflog.unshift({ hash: op.origHash, message: `${kind} (abort)` });
  repo.op = null;
}

export function ensureNoOp(repo: Repo, action: string): void {
  if (!repo.op) return;
  const what = { merge: 'merging', rebase: 'rebasing', 'cherry-pick': 'cherry-picking', revert: 'reverting' }[repo.op.kind];
  throw new GitError([`fatal: cannot ${action} while ${what}.`, `hint: finish it, or run "git ${repo.op.kind} --abort".`]);
}

// ---------- status ----------
export function statusLines(repo: Repo): string[] {
  const out: string[] = [];
  const op = repo.op;
  const head = headHash(repo);
  if (op?.kind === 'rebase') out.push(`${c.red('rebase in progress;')} onto ${c.red(short(op.onto ?? ''))}`);
  else if (repo.head.type === 'branch') out.push(`On branch ${repo.head.name}`);
  else out.push(`${c.red('HEAD detached at')} ${short(repo.head.hash)}`);
  if (repo.head.type === 'branch' && !op) out.push(...trackingLines(repo, repo.head.name));
  if (!head) out.push('', 'No commits yet');

  const st = getStatus(repo);
  if (op) {
    const fixed = !st.unmerged.length;
    out.push('');
    if (op.kind === 'merge') {
      out.push(
        ...(fixed
          ? ['All conflicts fixed but you are still merging.', '  (use "git commit" to conclude merge)']
          : ['You have unmerged paths.', '  (fix conflicts and run "git commit")', '  (use "git merge --abort" to abort the merge)']),
      );
    } else {
      const ing = { rebase: 'rebasing', 'cherry-pick': 'cherry-picking', revert: 'reverting' }[op.kind];
      const target = op.kind === 'rebase' ? `branch '${op.branch}' on '${short(op.onto ?? '')}'` : `commit ${short(op.current ?? '')}`;
      out.push(`You are currently ${ing} ${target}.`);
      out.push(
        fixed
          ? `  (all conflicts fixed: run "git ${op.kind} --continue")`
          : `  (fix conflicts and then run "git ${op.kind} --continue")`,
        `  (use "git ${op.kind} --abort" to cancel the ${op.kind} operation)`,
      );
    }
  }
  if (st.staged.length) {
    out.push('', 'Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)');
    for (const ch of st.staged) out.push('\t' + c.green(`${(ch.kind + ':').padEnd(12)}${ch.path}`));
  }
  if (st.unmerged.length) {
    out.push('', 'Unmerged paths:', '  (use "git add <file>..." to mark resolution)');
    for (const p of st.unmerged) out.push('\t' + c.red(`both modified:   ${p}`));
  }
  if (st.unstaged.length) {
    out.push(
      '',
      'Changes not staged for commit:',
      '  (use "git add <file>..." to update what will be committed)',
      '  (use "git restore <file>..." to discard changes in working directory)',
    );
    for (const ch of st.unstaged) out.push('\t' + c.red(`${(ch.kind + ':').padEnd(12)}${ch.path}`));
  }
  if (st.untracked.length) {
    out.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)');
    for (const p of st.untracked) out.push('\t' + c.red(p));
  }
  out.push('');
  if (!st.staged.length && !st.unmerged.length) {
    if (st.unstaged.length) out.push('no changes added to commit (use "git add" and/or "git commit -a")');
    else if (st.untracked.length) out.push('nothing added to commit but untracked files present (use "git add" to track)');
    else if (!op) out.push('nothing to commit, working tree clean');
    else out.pop();
  } else out.pop();
  return out;
}

/** Copy a commit and all its history from one repo to another. */
export function copyHistory(from: Repo, to: Repo, hash: string | undefined): void {
  if (!hash) return;
  const queue = [hash];
  while (queue.length) {
    const h = queue.pop()!;
    if (to.commits[h] || !from.commits[h]) continue;
    to.commits[h] = from.commits[h];
    queue.push(...from.commits[h].parents);
  }
}

export { commitsBetween };
