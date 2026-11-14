import { diffStat, formatTreeDiff } from '../diff';
import { mergeTrees } from '../merge';
import {
  ancestors,
  c,
  commitsBetween,
  currentBranch,
  decorations,
  diffTrees,
  getStatus,
  headHash,
  headTree,
  isAncestor,
  isClean,
  isIgnored,
  makeCommit,
  mergeBase,
  moveHead,
  mustResolve,
  requireRepo,
  resolveRef,
  setHead,
  short,
  treeOf,
} from '../repo';
import { GitError, type Head, type Repo } from '../types';
import {
  abortOp,
  applyMerge,
  applyTreeChange,
  checkOverwrite,
  commitStep,
  continueOp,
  describe,
  ensureNoOp,
  hardReset,
  matchPaths,
  parseArgs,
  runTodo,
  startSequence,
  statusLines,
  subject,
  trackingLines,
  unmergedError,
  type Command,
  type Ctx,
} from './core';

// ---------- init / config ----------
export const init: Command = ({ repo, out }) => {
  if (repo.initialized) return out('Reinitialized existing Git repository in /project/.git/');
  repo.initialized = true;
  repo.head = { type: 'branch', name: 'main' };
  out('Initialized empty Git repository in /project/.git/');
};

export const config: Command = ({ repo, out }, args) => {
  const p = parseArgs(args);
  const [key, value] = p.rest;
  if (key === 'user.name') {
    if (value === undefined) out(repo.user);
    else repo.user = value;
  }
};

// ---------- status / add / commit ----------
export const status: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  if (p.flags.has('-s') || p.flags.has('--short')) {
    const st = getStatus(repo);
    const code = { 'new file': 'A', modified: 'M', deleted: 'D' };
    for (const ch of st.staged) out(`${c.green(code[ch.kind])}  ${ch.path}`);
    for (const path of st.unmerged) out(`${c.red('UU')} ${path}`);
    for (const ch of st.unstaged) out(` ${c.red(code[ch.kind])} ${ch.path}`);
    for (const path of st.untracked) out(`${c.red('??')} ${path}`);
    return;
  }
  out(...statusLines(repo));
};

export const add: Command = ({ repo }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  const all = p.flags.has('-A') || p.flags.has('--all');
  const specs = all && !p.rest.length ? ['.'] : p.rest;
  if (!specs.length) throw new GitError(['Nothing specified, nothing added.', "hint: Maybe you wanted to say 'git add .'?"]);
  const candidates = [...new Set([...Object.keys(repo.workdir), ...Object.keys(repo.index)])];
  for (const spec of specs) {
    const matched = matchPaths(spec, candidates);
    if (!matched.length) throw new GitError(`fatal: pathspec '${spec}' did not match any files`);
    const explicit = matched.length === 1 && matched[0] === spec;
    for (const path of matched) {
      if (path in repo.workdir) {
        if (isIgnored(repo, path) && !(path in repo.index)) {
          if (explicit) {
            throw new GitError([
              'The following paths are ignored by one of your .gitignore files:',
              path,
              'hint: Use -f if you really want to add them.',
            ]);
          }
          continue;
        }
        repo.index[path] = repo.workdir[path];
      } else delete repo.index[path];
      repo.conflicts = repo.conflicts.filter((x) => x !== path);
    }
  }
};

export const commit: Command = (ctx, args) => {
  const { repo, world, out } = ctx;
  requireRepo(repo);
  const p = parseArgs(args, ['-m', '--message']);
  const message = p.values['-m'] ?? p.values['--message'];
  if (p.flags.has('-a') || p.flags.has('--all')) {
    for (const path of Object.keys(repo.index)) {
      if (repo.conflicts.includes(path)) continue;
      if (path in repo.workdir) repo.index[path] = repo.workdir[path];
      else delete repo.index[path];
    }
  }
  if (repo.conflicts.length) throw unmergedError();

  if (repo.op) {
    const op = repo.op;
    const made = commitStep(ctx, message);
    if (!made) throw new GitError('nothing to commit, working tree clean');
    if (op.kind === 'merge' || (op.kind !== 'rebase' && !op.todo.length)) repo.op = null;
    return;
  }

  const head = headHash(repo);
  const where = repo.head.type === 'branch' ? repo.head.name : 'detached HEAD';

  if (p.flags.has('--amend')) {
    if (!head) throw new GitError('fatal: You have nothing to amend.');
    const old = repo.commits[head];
    const hash = makeCommit(world, repo, { tree: repo.index, parents: old.parents, message: message ?? old.message, author: old.author });
    moveHead(repo, hash, `commit (amend): ${subject(message ?? old.message)}`);
    out(`[${where} ${short(hash)}] ${subject(repo.commits[hash].message)}`, diffStat(treeOf(repo, old.parents[0]), repo.index));
    ctx.events.push({ type: 'commit', hash });
    return;
  }

  if (!diffTrees(headTree(repo), repo.index).length && !p.flags.has('--allow-empty')) {
    throw new GitError(statusLines(repo));
  }
  if (message === undefined) {
    throw new GitError(['error: no commit message given.', 'hint: this terminal has no text editor, use: git commit -m "your message"']);
  }
  if (!message.trim()) throw new GitError('Aborting commit due to empty commit message.');

  const before = headTree(repo);
  const hash = makeCommit(world, repo, { tree: repo.index, parents: head ? [head] : [], message });
  moveHead(repo, hash, `commit${head ? '' : ' (initial)'}: ${subject(message)}`);
  out(`[${where}${head ? '' : ' (root-commit)'} ${short(hash)}] ${subject(message)}`, diffStat(before, repo.index));
  ctx.events.push({ type: 'commit', hash });
};

// ---------- history ----------
export const log: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args, ['-n']);
  let starts: (string | undefined)[];
  if (p.flags.has('--all')) starts = [headHash(repo), ...Object.values(repo.branches), ...Object.values(repo.remoteRefs)];
  else if (p.rest.length) starts = p.rest.map((r) => mustResolve(repo, r));
  else starts = [headHash(repo)];
  if (!starts.some(Boolean)) {
    throw new GitError(`fatal: your current branch '${currentBranch(repo) ?? 'HEAD'}' does not have any commits yet`);
  }
  const seen = new Set<string>();
  for (const s of starts) for (const h of ancestors(repo, s)) seen.add(h);
  let list = [...seen].sort((a, b) => repo.commits[b].time - repo.commits[a].time);
  if (p.values['-n']) list = list.slice(0, parseInt(p.values['-n'], 10));
  const graph = p.flags.has('--graph') ? `${c.red('*')} ` : '';
  const pad = graph ? `${c.red('|')} ` : '';
  list.forEach((h, i) => {
    const cm = repo.commits[h];
    if (p.flags.has('--oneline')) return out(`${graph}${c.yellow(short(h))}${decorations(repo, h)} ${subject(cm.message)}`);
    out(`${graph}${c.yellow('commit ' + h)}${decorations(repo, h)}`);
    if (cm.parents.length > 1) out(`${pad}Merge: ${cm.parents.map(short).join(' ')}`);
    out(`${pad}Author: ${cm.author} <${cm.author.toLowerCase().replace(/\s+/g, '.')}@example.com>`, pad);
    for (const line of cm.message.split('\n')) out(`${pad}    ${line}`);
    if (i < list.length - 1) out(pad);
  });
};

export const reflog: Command = ({ repo, out }) => {
  requireRepo(repo);
  repo.reflog.forEach((e, i) => out(`${c.yellow(short(e.hash))} HEAD@{${i}}: ${e.message}`));
};

export const diff: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  const refs: string[] = [];
  const paths: string[] = [...(p.afterDashes ?? [])];
  for (const a of p.rest) {
    const range = a.split(/\.\.\.?/);
    if (range.length === 2 && range.every((r) => resolveRef(repo, r))) refs.push(...range);
    else if (!paths.length && resolveRef(repo, a) && !(a in repo.workdir)) refs.push(a);
    else paths.push(a);
  }
  const staged = p.flags.has('--staged') || p.flags.has('--cached');
  let from = repo.index;
  let to = repo.workdir;
  if (refs.length === 2) [from, to] = [treeOf(repo, mustResolve(repo, refs[0])), treeOf(repo, mustResolve(repo, refs[1]))];
  else if (refs.length === 1) [from, to] = [treeOf(repo, mustResolve(repo, refs[0])), staged ? repo.index : repo.workdir];
  else if (staged) [from, to] = [headTree(repo), repo.index];
  else {
    // plain `git diff` ignores untracked files
    to = Object.fromEntries(Object.entries(repo.workdir).filter(([path]) => path in repo.index));
  }
  const all = [...new Set([...Object.keys(from), ...Object.keys(to)])];
  const allowed = paths.length ? new Set(paths.flatMap((s) => matchPaths(s, all))) : null;
  out(...formatTreeDiff(from, to, allowed ? (path) => allowed.has(path) : undefined));
};

export const show: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  const hash = mustResolve(repo, p.rest[0] ?? 'HEAD');
  const cm = repo.commits[hash];
  out(c.yellow(`commit ${hash}`) + decorations(repo, hash), `Author: ${cm.author}`, '');
  for (const line of cm.message.split('\n')) out(`    ${line}`);
  out('', ...formatTreeDiff(treeOf(repo, cm.parents[0]), cm.tree));
};

// ---------- undo ----------
export const restore: Command = ({ repo }, args) => {
  requireRepo(repo);
  const p = parseArgs(args, ['--source', '-s']);
  const specs = [...p.rest, ...(p.afterDashes ?? [])];
  if (!specs.length) throw new GitError('fatal: you must specify path(s) to restore');
  const staged = p.flags.has('--staged') || p.flags.has('-S');
  const worktree = p.flags.has('--worktree') || p.flags.has('-W') || !staged;
  const sourceRef = p.values['--source'] ?? p.values['-s'];
  const source = sourceRef ? treeOf(repo, mustResolve(repo, sourceRef)) : staged ? headTree(repo) : repo.index;
  const known = [...new Set([...Object.keys(source), ...Object.keys(repo.index)])];
  for (const spec of specs) {
    const matched = matchPaths(spec, known);
    if (!matched.length) throw new GitError(`error: pathspec '${spec}' did not match any file(s) known to git`);
    for (const path of matched) {
      if (staged) {
        if (path in source) repo.index[path] = source[path];
        else delete repo.index[path];
      }
      if (worktree) {
        const from = staged ? repo.index : source;
        if (path in from) repo.workdir[path] = from[path];
        else delete repo.workdir[path];
        repo.conflicts = repo.conflicts.filter((x) => x !== path);
      }
    }
  }
};

export const reset: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  const mode = ['--soft', '--mixed', '--hard'].find((m) => p.flags.has(m)) ?? '--mixed';
  let rest = [...p.rest];
  let target = headHash(repo);
  if (rest.length && resolveRef(repo, rest[0]) && !(rest[0] in repo.index)) target = resolveRef(repo, rest.shift()!);
  const paths = [...rest, ...(p.afterDashes ?? [])];
  if (paths.length) {
    const tree = treeOf(repo, target);
    const known = [...new Set([...Object.keys(tree), ...Object.keys(repo.index)])];
    for (const spec of paths) {
      const matched = matchPaths(spec, known);
      if (!matched.length) throw new GitError(`fatal: ambiguous argument '${spec}': unknown revision or path not in the working tree.`);
      for (const path of matched) {
        if (path in tree) repo.index[path] = tree[path];
        else delete repo.index[path];
      }
    }
  } else {
    if (!target) throw new GitError("fatal: Failed to resolve 'HEAD' as a valid ref.");
    if (mode === '--hard') {
      hardReset(repo, target);
      repo.op = null;
    } else if (mode === '--mixed') {
      repo.index = { ...repo.commits[target].tree };
      repo.conflicts = [];
      repo.op = null;
    }
    moveHead(repo, target, `reset: moving to ${p.rest[0] ?? 'HEAD'}`);
    if (mode === '--hard') out(`HEAD is now at ${describe(repo, target)}`);
  }
  if (mode !== '--hard') {
    const unstaged = getStatus(repo).unstaged;
    if (unstaged.length && mode === '--mixed') {
      out('Unstaged changes after reset:');
      for (const ch of unstaged) out(`${ch.kind === 'deleted' ? 'D' : 'M'}\t${ch.path}`);
    }
  }
};

export const rm: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args);
  if (!p.rest.length) throw new GitError('usage: git rm [--cached] <file>...');
  for (const spec of p.rest) {
    const matched = matchPaths(spec, Object.keys(repo.index));
    if (!matched.length) throw new GitError(`fatal: pathspec '${spec}' did not match any files`);
    for (const path of matched) {
      delete repo.index[path];
      if (!p.flags.has('--cached')) delete repo.workdir[path];
      repo.conflicts = repo.conflicts.filter((x) => x !== path);
      out(`rm '${path}'`);
    }
  }
};

function sequencerFlags(ctx: Ctx, kind: 'revert' | 'cherry-pick' | 'rebase', flags: Set<string>): boolean {
  if (flags.has('--abort')) {
    abortOp(ctx, kind);
    return true;
  }
  if (flags.has('--continue')) {
    continueOp(ctx, kind);
    return true;
  }
  if (flags.has('--skip')) {
    const { repo } = ctx;
    if (!repo.op || repo.op.kind !== kind) throw new GitError(`fatal: No ${kind} in progress?`);
    hardReset(repo, headHash(repo));
    runTodo(ctx);
    return true;
  }
  return false;
}

export const revert: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args);
  if (sequencerFlags(ctx, 'revert', p.flags)) return;
  ensureNoOp(repo, 'revert');
  if (!p.rest.length) throw new GitError('usage: git revert <commit>...');
  startSequence(ctx, 'revert', p.rest.map((r) => mustResolve(repo, r)));
};

export const cherryPick: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args);
  if (sequencerFlags(ctx, 'cherry-pick', p.flags)) return;
  ensureNoOp(repo, 'cherry-pick');
  if (!p.rest.length) throw new GitError('usage: git cherry-pick <commit>...');
  startSequence(ctx, 'cherry-pick', p.rest.map((r) => mustResolve(repo, r)));
};

// ---------- branches ----------
export function switchTo(ctx: Ctx, head: Head, hash: string | undefined, reflogMsg: string): void {
  const { repo } = ctx;
  ensureNoOp(repo, 'switch branch');
  const from = headTree(repo);
  const to = treeOf(repo, hash);
  checkOverwrite(repo, from, to, 'checkout');
  applyTreeChange(repo, from, to);
  setHead(repo, head, reflogMsg);
}

function createBranch(repo: Repo, name: string, start?: string): string | undefined {
  if (!/^[\w./-]+$/.test(name) || name.startsWith('-')) throw new GitError(`fatal: '${name}' is not a valid branch name`);
  if (name in repo.branches) throw new GitError(`fatal: a branch named '${name}' already exists`);
  const hash = start ? mustResolve(repo, start) : headHash(repo);
  if (hash) repo.branches[name] = hash;
  else if (start === undefined && !headHash(repo)) return undefined;
  if (start && repo.remoteRefs[start]) repo.upstream[name] = start;
  return hash;
}

function goToBranch(ctx: Ctx, name: string): void {
  const { repo, out } = ctx;
  if (currentBranch(repo) === name) return out(`Already on '${name}'`, ...trackingLines(repo, name));
  if (!(name in repo.branches)) {
    // like git: create a tracking branch if exactly one remote has it
    const remote = Object.keys(repo.remoteRefs).filter((r) => r.split('/').slice(1).join('/') === name);
    if (remote.length !== 1) throw new GitError(`fatal: invalid reference: ${name}`);
    repo.branches[name] = repo.remoteRefs[remote[0]];
    repo.upstream[name] = remote[0];
    switchTo(ctx, { type: 'branch', name }, repo.branches[name], `checkout: moving to ${name}`);
    return out(`branch '${name}' set up to track '${remote[0]}'.`, `Switched to a new branch '${name}'`);
  }
  switchTo(ctx, { type: 'branch', name }, repo.branches[name], `checkout: moving to ${name}`);
  out(`Switched to branch '${name}'`, ...trackingLines(repo, name));
}

function goDetached(ctx: Ctx, ref: string): void {
  const hash = mustResolve(ctx.repo, ref);
  switchTo(ctx, { type: 'detached', hash }, hash, `checkout: moving to ${ref}`);
  ctx.out(
    `Note: switching to '${ref}'.`,
    '',
    "You are in 'detached HEAD' state. You can look around, make experimental",
    'changes and commit them, and you can discard any commits you make in this',
    'state without impacting any branches by switching back to a branch.',
    '',
    `HEAD is now at ${describe(ctx.repo, hash)}`,
  );
}

function newBranchAndSwitch(ctx: Ctx, name: string, start?: string): void {
  const { repo, out } = ctx;
  if (!headHash(repo) && !start) {
    // unborn branch: just rename where HEAD points
    repo.head = { type: 'branch', name };
    return out(`Switched to a new branch '${name}'`);
  }
  const hash = createBranch(repo, name, start);
  try {
    switchTo(ctx, { type: 'branch', name }, hash, `checkout: moving to ${name}`);
  } catch (e) {
    delete repo.branches[name];
    throw e;
  }
  if (repo.upstream[name]) out(`branch '${name}' set up to track '${repo.upstream[name]}'.`);
  out(`Switched to a new branch '${name}'`);
}

export const switchCmd: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args, ['-c', '--create', '-C']);
  const create = p.values['-c'] ?? p.values['--create'] ?? p.values['-C'];
  if (create !== undefined) return newBranchAndSwitch(ctx, create, p.rest[0]);
  const [name] = p.rest;
  if (!name) throw new GitError('fatal: missing branch or commit argument');
  if (p.flags.has('--detach') || p.flags.has('-d')) return goDetached(ctx, name);
  if (!(name in repo.branches) && resolveRef(repo, name) && !Object.keys(repo.remoteRefs).some((r) => r.endsWith('/' + name))) {
    throw new GitError([`fatal: a branch is expected, got '${name}'`, 'hint: If you want to detach HEAD at the commit, try again with the --detach option.']);
  }
  goToBranch(ctx, name);
};

export const checkout: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args, ['-b', '-B']);
  const create = p.values['-b'] ?? p.values['-B'];
  if (create !== undefined) return newBranchAndSwitch(ctx, create, p.rest[0]);
  if (p.afterDashes) return restore(ctx, [...(p.rest[0] ? ['--source', p.rest[0]] : []), '--', ...p.afterDashes]);
  const [name] = p.rest;
  if (!name) throw new GitError('fatal: missing branch or commit argument');
  if (name in repo.branches || Object.keys(repo.remoteRefs).some((r) => r.split('/').slice(1).join('/') === name)) return goToBranch(ctx, name);
  if (resolveRef(repo, name)) return goDetached(ctx, name);
  if (matchPaths(name, Object.keys(repo.index)).length) return restore(ctx, p.rest);
  throw new GitError(`error: pathspec '${name}' did not match any file(s) known to git`);
};

export const branch: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args, ['-u', '--set-upstream-to']);
  const cur = currentBranch(repo);
  const del = p.flags.has('-d') || p.flags.has('--delete');
  const forceDel = p.flags.has('-D');
  if (del || forceDel) {
    for (const name of p.rest) {
      if (!(name in repo.branches)) throw new GitError(`error: branch '${name}' not found.`);
      if (name === cur) throw new GitError(`error: Cannot delete branch '${name}' checked out at '/project'`);
      const hash = repo.branches[name];
      const merged = isAncestor(repo, hash, headHash(repo)) || (repo.upstream[name] && isAncestor(repo, hash, repo.remoteRefs[repo.upstream[name]]));
      if (!forceDel && !merged) {
        throw new GitError([
          `error: The branch '${name}' is not fully merged.`,
          `If you are sure you want to delete it, run 'git branch -D ${name}'.`,
        ]);
      }
      delete repo.branches[name];
      delete repo.upstream[name];
      out(`Deleted branch ${name} (was ${short(hash)}).`);
    }
    return;
  }
  const up = p.values['-u'] ?? p.values['--set-upstream-to'];
  if (up !== undefined) {
    const name = p.rest[0] ?? cur;
    if (!name) throw new GitError('fatal: could not set upstream of HEAD when it does not point to any branch.');
    if (!repo.remoteRefs[up]) throw new GitError(`fatal: the requested upstream branch '${up}' does not exist`);
    repo.upstream[name] = up;
    return out(`branch '${name}' set up to track '${up}'.`);
  }
  if (p.flags.has('-m') || p.flags.has('-M') || p.flags.has('--move')) {
    const [a, b] = p.rest.length > 1 ? p.rest : [cur, p.rest[0]];
    if (!a || !b) throw new GitError('fatal: branch name required');
    if (b in repo.branches) throw new GitError(`fatal: a branch named '${b}' already exists`);
    if (!(a in repo.branches) && a !== cur) throw new GitError(`error: refname refs/heads/${a} not found`);
    if (a in repo.branches) {
      repo.branches[b] = repo.branches[a];
      delete repo.branches[a];
    }
    if (repo.upstream[a]) {
      repo.upstream[b] = repo.upstream[a];
      delete repo.upstream[a];
    }
    if (cur === a) repo.head = { type: 'branch', name: b };
    return;
  }
  if (p.rest.length) {
    if (!headHash(repo) && !p.rest[1]) throw new GitError(`fatal: not a valid object name: '${cur ?? 'HEAD'}'`);
    const name = p.rest[0];
    createBranch(repo, name, p.rest[1]);
    if (repo.upstream[name]) out(`branch '${name}' set up to track '${repo.upstream[name]}'.`);
    return;
  }
  // list
  const verbose = p.flags.has('-v') || p.flags.has('-vv');
  if (repo.head.type === 'detached') out(`* ${c.green(`(HEAD detached at ${short(repo.head.hash)})`)}`);
  if (!p.flags.has('-r')) {
    for (const name of Object.keys(repo.branches).sort()) {
      const extra = verbose ? ` ${describe(repo, repo.branches[name])}` : '';
      out(name === cur ? `* ${c.green(name)}${extra}` : `  ${name}${extra}`);
    }
  }
  if (p.flags.has('-a') || p.flags.has('-r') || p.flags.has('--all')) {
    for (const name of Object.keys(repo.remoteRefs).sort()) out(`  ${c.red((p.flags.has('-r') ? '' : 'remotes/') + name)}`);
  }
};

// ---------- merge ----------
/** Merge a commit into HEAD. Shared by `git merge` and `git pull`. */
export function mergeCommit(ctx: Ctx, theirs: string, label: string, opts: { noFf?: boolean; message?: string } = {}): void {
  const { repo, world, out } = ctx;
  const ours = headHash(repo);
  if (!ours) {
    // unborn branch: just adopt their history
    moveHead(repo, theirs, `merge ${label}: Fast-forward`);
    hardReset(repo, theirs);
    return;
  }
  if (isAncestor(repo, theirs, ours)) return out('Already up to date.');
  const oursTree = headTree(repo);
  if (isAncestor(repo, ours, theirs) && !opts.noFf) {
    const to = treeOf(repo, theirs);
    checkOverwrite(repo, oursTree, to, 'merge');
    applyTreeChange(repo, oursTree, to);
    moveHead(repo, theirs, `merge ${label}: Fast-forward`);
    out(`Updating ${short(ours)}..${short(theirs)}`, 'Fast-forward', diffStat(oursTree, to));
    return;
  }
  const base = mergeBase(repo, ours, theirs);
  const result = mergeTrees(treeOf(repo, base), oursTree, treeOf(repo, theirs), { ours: 'HEAD', theirs: label });
  checkOverwrite(repo, oursTree, result.tree, 'merge');
  const cur = currentBranch(repo);
  const message = opts.message ?? `Merge ${label.includes('/') && repo.remoteRefs[label] ? `remote-tracking branch '${label}'` : `branch '${label}'`}${cur && cur !== 'main' ? ` into ${cur}` : ''}`;
  applyMerge(repo, oursTree, result);
  if (result.conflicts.length) {
    repo.op = { kind: 'merge', origHead: { ...repo.head }, origHash: ours, mergeHead: theirs, message, todo: [] };
    for (const p of result.conflicts) out(`Auto-merging ${p.path}`, p.message);
    throw new GitError('Automatic merge failed; fix conflicts and then commit the result.');
  }
  const hash = makeCommit(world, repo, { tree: repo.index, parents: [ours, theirs], message });
  moveHead(repo, hash, `merge ${label}: Merge made by the 'ort' strategy.`);
  out("Merge made by the 'ort' strategy.", diffStat(oursTree, repo.index));
  ctx.events.push({ type: 'commit', hash });
}

export const merge: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args, ['-m']);
  if (p.flags.has('--abort')) return abortOp(ctx, 'merge');
  if (p.flags.has('--continue')) return continueOp(ctx, 'merge');
  if (repo.op?.kind === 'merge') {
    throw new GitError(['error: Merging is not possible because you have unmerged files.', 'fatal: Exiting because of an unresolved conflict.']);
  }
  ensureNoOp(repo, 'merge');
  const [ref] = p.rest;
  if (!ref) throw new GitError('fatal: No commit specified and merge.defaultToUpstream not set.');
  const theirs = resolveRef(repo, ref);
  if (!theirs) throw new GitError(`merge: ${ref} - not something we can merge`);
  mergeCommit(ctx, theirs, ref, { noFf: p.flags.has('--no-ff'), message: p.values['-m'] });
};

// ---------- rebase ----------
export function rebaseOnto(ctx: Ctx, onto: string, label: string): void {
  const { repo, out } = ctx;
  const head = headHash(repo);
  const cur = currentBranch(repo);
  if (!head) throw new GitError('fatal: no commits to rebase');
  if (!isClean(repo)) throw new GitError(['error: cannot rebase: You have unstaged changes.', 'error: Please commit or stash them.']);
  if (isAncestor(repo, onto, head)) return out(`Current branch ${cur ?? 'HEAD'} is up to date.`);
  const origHead = { ...repo.head } as Head;
  if (isAncestor(repo, head, onto)) {
    hardReset(repo, onto);
    moveHead(repo, onto, `rebase (finish): fast-forward to ${label}`);
    return out(`Successfully rebased and updated refs/heads/${cur}.`);
  }
  // replay our commits (skipping merges) on top of `onto`
  const todo = commitsBetween(repo, onto, head).filter((h) => repo.commits[h].parents.length < 2);
  hardReset(repo, onto);
  repo.head = { type: 'detached', hash: onto };
  repo.reflog.unshift({ hash: onto, message: `rebase (start): checkout ${label}` });
  startSequence(ctx, 'rebase', todo, { branch: cur, onto, origHead, origHash: head });
}

export const rebase: Command = (ctx, args) => {
  const { repo } = ctx;
  requireRepo(repo);
  const p = parseArgs(args);
  if (sequencerFlags(ctx, 'rebase', p.flags)) return;
  if (p.flags.has('-i') || p.flags.has('--interactive')) throw new GitError('error: interactive rebase is not available in this terminal.');
  ensureNoOp(repo, 'rebase');
  const [ref] = p.rest;
  const cur = currentBranch(repo);
  const target = ref ?? (cur ? repo.upstream[cur] : undefined);
  if (!target) throw new GitError('fatal: no upstream configured; specify the branch to rebase onto, e.g. git rebase main');
  const onto = resolveRef(repo, target);
  if (!onto) throw new GitError(`fatal: invalid upstream '${target}'`);
  rebaseOnto(ctx, onto, target);
};

// ---------- stash ----------
export const stash: Command = (ctx, args) => {
  const { repo, out } = ctx;
  requireRepo(repo);
  const [sub = 'push', ...restArgs] = args[0]?.startsWith('-') ? ['push', ...args] : args;
  const p = parseArgs(restArgs, ['-m', '--message']);
  const indexOf = (ref?: string) => {
    const m = /^(?:stash@\{(\d+)\}|(\d+))$/.exec(ref ?? 'stash@{0}');
    const i = m ? parseInt(m[1] ?? m[2], 10) : NaN;
    if (Number.isNaN(i) || !repo.stash[i]) {
      throw new GitError(repo.stash.length ? `error: ${ref} is not a valid reference` : 'No stash entries found.');
    }
    return i;
  };
  switch (sub) {
    case 'push':
    case 'save': {
      const head = headHash(repo);
      if (!head) throw new GitError('You do not have the initial commit yet');
      ensureNoOp(repo, 'stash');
      const st = getStatus(repo);
      const includeUntracked = p.flags.has('-u') || p.flags.has('--include-untracked');
      if (!st.staged.length && !st.unstaged.length && !(includeUntracked && st.untracked.length)) return out('No local changes to save');
      const tree = Object.fromEntries(
        Object.entries(repo.workdir).filter(([path]) => path in repo.index || path in headTree(repo) || (includeUntracked && !isIgnored(repo, path))),
      );
      // staged deletions / additions are part of the stash too
      for (const ch of st.staged) if (ch.kind === 'new file' && !(ch.path in tree)) tree[ch.path] = repo.index[ch.path];
      const where = currentBranch(repo) ?? '(no branch)';
      const custom = p.values['-m'] ?? p.values['--message'] ?? (sub === 'save' ? p.rest.join(' ') || undefined : undefined);
      const message = custom ? `On ${where}: ${custom}` : `WIP on ${where}: ${describe(repo, head)}`;
      repo.stash.unshift({ message, tree, base: head, branch: where });
      const keep = Object.fromEntries(Object.entries(repo.workdir).filter(([path]) => !(path in tree) && !(path in headTree(repo))));
      repo.workdir = { ...keep, ...headTree(repo) };
      repo.index = { ...headTree(repo) };
      out(`Saved working directory and index state ${message}`);
      return;
    }
    case 'list':
      repo.stash.forEach((s, i) => out(`stash@{${i}}: ${s.message}`));
      return;
    case 'show': {
      const s = repo.stash[indexOf(p.rest[0])];
      out(...formatTreeDiff(treeOf(repo, s.base), s.tree));
      return;
    }
    case 'drop': {
      const i = indexOf(p.rest[0]);
      repo.stash.splice(i, 1);
      out(`Dropped stash@{${i}}`);
      return;
    }
    case 'clear':
      repo.stash = [];
      return;
    case 'pop':
    case 'apply': {
      const i = indexOf(p.rest[0]);
      const s = repo.stash[i];
      ensureNoOp(repo, 'apply a stash');
      const base = treeOf(repo, s.base);
      // local edits to files the stash also touches would be lost: refuse like git does
      const touched = diffTrees(base, s.tree).map((ch) => ch.path);
      const dirty = touched.filter((path) => repo.workdir[path] !== headTree(repo)[path]);
      if (dirty.length) {
        throw new GitError([
          'error: Your local changes to the following files would be overwritten by merge:',
          ...dirty.map((d) => `\t${d}`),
          'Please commit your changes or stash them before you merge.',
          'Aborting',
          'The stash entry is kept in case you need it again.',
        ]);
      }
      const ours = headTree(repo);
      const result = mergeTrees(base, ours, s.tree, { ours: 'Updated upstream', theirs: 'Stashed changes' });
      const conflicted = new Set(result.conflicts.map((x) => x.path));
      for (const ch of diffTrees(ours, result.tree)) {
        if (ch.path in result.tree) repo.workdir[ch.path] = result.tree[ch.path];
        else delete repo.workdir[ch.path];
      }
      if (conflicted.size) {
        repo.conflicts = [...new Set([...repo.conflicts, ...conflicted])];
        for (const cf of result.conflicts) out(`Auto-merging ${cf.path}`, cf.message);
        if (sub === 'pop') out('The stash entry is kept in case you need it again.');
        throw new GitError([]);
      }
      out(...statusLines(repo));
      if (sub === 'pop') {
        repo.stash.splice(i, 1);
        out(`Dropped stash@{${i}}`);
      }
      return;
    }
    default:
      throw new GitError(`error: unknown subcommand: ${sub}`);
  }
};

// ---------- tags ----------
export const tag: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const p = parseArgs(args, ['-m']);
  if (p.flags.has('-d') || p.flags.has('--delete')) {
    for (const name of p.rest) {
      if (!(name in repo.tags)) throw new GitError(`error: tag '${name}' not found.`);
      out(`Deleted tag '${name}' (was ${short(repo.tags[name])})`);
      delete repo.tags[name];
    }
    return;
  }
  const [name, ref] = p.rest;
  if (!name) return out(...Object.keys(repo.tags).sort());
  if (name in repo.tags) throw new GitError(`fatal: tag '${name}' already exists`);
  repo.tags[name] = mustResolve(repo, ref ?? 'HEAD');
};
