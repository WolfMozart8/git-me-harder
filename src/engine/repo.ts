import { GitError, type Commit, type Head, type Repo, type Tree, type World } from './types';

// ---------- colors (ANSI, parsed by the terminal UI) ----------
const wrap = (code: number) => (s: string) => `\u001b[${code}m${s}\u001b[0m`;
export const c = {
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  cyan: wrap(36),
  dim: wrap(90),
  bold: wrap(1),
};
// eslint-disable-next-line no-control-regex
export const stripAnsi = (s: string) => s.replace(/\u001b\[\d+m/g, '');

// ---------- construction ----------
export function createRepo(url = 'local', user = 'You'): Repo {
  return {
    url,
    initialized: false,
    commits: {},
    branches: {},
    tags: {},
    remoteRefs: {},
    upstream: {},
    remotes: {},
    head: { type: 'branch', name: 'main' },
    index: {},
    workdir: {},
    stash: [],
    reflog: [],
    op: null,
    conflicts: [],
    user,
  };
}

export function createWorld(): World {
  return { local: createRepo(), remotes: {}, clock: 0 };
}

// ---------- hashing ----------
function fnv(str: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function hashCommit(cm: Omit<Commit, 'hash'>): string {
  const body = JSON.stringify([
    cm.parents,
    cm.message,
    cm.author,
    cm.time,
    Object.keys(cm.tree)
      .sort()
      .map((k) => [k, cm.tree[k]]),
  ]);
  return [0x811c9dc5, 0x1234567, 0x9e3779b9, 0xdeadbeef, 0x51ed270b].map((s) => fnv(body, s)).join('');
}

export const short = (hash: string) => hash.slice(0, 7);

// ---------- reading ----------
export function requireRepo(repo: Repo): void {
  if (!repo.initialized) {
    throw new GitError('fatal: not a git repository (or any of the parent directories): .git');
  }
}

export function headHash(repo: Repo): string | undefined {
  return repo.head.type === 'branch' ? repo.branches[repo.head.name] : repo.head.hash;
}

export function treeOf(repo: Repo, hash: string | undefined): Tree {
  return hash ? repo.commits[hash].tree : {};
}

export const headTree = (repo: Repo): Tree => treeOf(repo, headHash(repo));

export function currentBranch(repo: Repo): string | undefined {
  return repo.head.type === 'branch' ? repo.head.name : undefined;
}

/** All ancestors of a commit (including itself), newest first. */
export function ancestors(repo: Repo, start: string | undefined): string[] {
  if (!start) return [];
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const h = queue.shift()!;
    if (seen.has(h) || !repo.commits[h]) continue;
    seen.add(h);
    queue.push(...repo.commits[h].parents);
  }
  return [...seen].sort((a, b) => repo.commits[b].time - repo.commits[a].time);
}

export function isAncestor(repo: Repo, maybeAncestor: string | undefined, of: string | undefined): boolean {
  if (!maybeAncestor) return true;
  if (!of) return false;
  return ancestors(repo, of).includes(maybeAncestor);
}

export function mergeBase(repo: Repo, a: string, b: string): string | undefined {
  const setA = new Set(ancestors(repo, a));
  return ancestors(repo, b).find((h) => setA.has(h));
}

/** Commits reachable from `to` but not from `from`, oldest first. */
export function commitsBetween(repo: Repo, from: string | undefined, to: string | undefined): string[] {
  const exclude = new Set(ancestors(repo, from));
  return ancestors(repo, to)
    .filter((h) => !exclude.has(h))
    .reverse();
}

export function resolveRef(repo: Repo, ref: string): string | undefined {
  const m = /^(.*?)((?:~\d*|\^)*)$/.exec(ref)!;
  const base = m[1];
  let hash: string | undefined;
  if (base === 'HEAD' || base === '@') hash = headHash(repo);
  else if (repo.branches[base]) hash = repo.branches[base];
  else if (repo.remoteRefs[base]) hash = repo.remoteRefs[base];
  else if (repo.tags[base]) hash = repo.tags[base];
  else if (/^(HEAD|@)@\{\d+\}$/.test(base)) hash = repo.reflog[parseInt(base.split('{')[1], 10)]?.hash;
  else if (/^stash@\{\d+\}$/.test(base)) return undefined;
  else if (/^[0-9a-f]{4,40}$/.test(base)) {
    const found = Object.keys(repo.commits).filter((h) => h.startsWith(base));
    if (found.length === 1) hash = found[0];
  }
  if (!hash) return undefined;
  const steps = m[2].match(/~\d*|\^/g) ?? [];
  for (const s of steps) {
    const n = s === '^' || s === '~' ? 1 : parseInt(s.slice(1), 10);
    for (let i = 0; i < n; i++) {
      hash = repo.commits[hash!]?.parents[0];
      if (!hash) return undefined;
    }
  }
  return hash;
}

export function mustResolve(repo: Repo, ref: string): string {
  const h = resolveRef(repo, ref);
  if (!h) throw new GitError(`fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree.`);
  return h;
}

// ---------- writing ----------
export function makeCommit(
  world: World,
  repo: Repo,
  data: { tree: Tree; parents: string[]; message: string; author?: string },
): string {
  world.clock += 1;
  const body = {
    tree: { ...data.tree },
    parents: data.parents,
    message: data.message,
    author: data.author ?? repo.user,
    time: world.clock,
  };
  const hash = hashCommit(body);
  repo.commits[hash] = { hash, ...body };
  return hash;
}

/** Move the current branch (or detached HEAD) to a commit and record it in the reflog. */
export function moveHead(repo: Repo, hash: string, reflogMsg: string): void {
  if (repo.head.type === 'branch') repo.branches[repo.head.name] = hash;
  else repo.head = { type: 'detached', hash };
  repo.reflog.unshift({ hash, message: reflogMsg });
}

export function setHead(repo: Repo, head: Head, reflogMsg: string): void {
  repo.head = head;
  const h = headHash(repo);
  if (h) repo.reflog.unshift({ hash: h, message: reflogMsg });
}

// ---------- .gitignore ----------
export function isIgnored(repo: Repo, path: string): boolean {
  const file = repo.workdir['.gitignore'];
  if (!file) return false;
  const name = path.split('/').pop()!;
  return file
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .some((pat) => {
      if (pat.endsWith('/')) return path.startsWith(pat) || path.includes('/' + pat);
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      return re.test(name) || re.test(path);
    });
}

// ---------- status ----------
export type Change = { path: string; kind: 'new file' | 'modified' | 'deleted' };

export function diffTrees(from: Tree, to: Tree): Change[] {
  const out: Change[] = [];
  for (const path of [...new Set([...Object.keys(from), ...Object.keys(to)])].sort()) {
    if (!(path in from)) out.push({ path, kind: 'new file' });
    else if (!(path in to)) out.push({ path, kind: 'deleted' });
    else if (from[path] !== to[path]) out.push({ path, kind: 'modified' });
  }
  return out;
}

export interface StatusInfo {
  staged: Change[];
  unstaged: Change[];
  untracked: string[];
  unmerged: string[];
}

export function getStatus(repo: Repo): StatusInfo {
  const unmerged = [...repo.conflicts].sort();
  const isUnmerged = (p: string) => unmerged.includes(p);
  const staged = diffTrees(headTree(repo), repo.index).filter((ch) => !isUnmerged(ch.path));
  const unstaged: Change[] = [];
  const untracked: string[] = [];
  for (const ch of diffTrees(repo.index, repo.workdir)) {
    if (isUnmerged(ch.path)) continue;
    if (ch.kind === 'new file') {
      if (!isIgnored(repo, ch.path)) untracked.push(ch.path);
    } else unstaged.push(ch);
  }
  return { staged, unstaged, untracked, unmerged };
}

export function isClean(repo: Repo): boolean {
  const s = getStatus(repo);
  return !s.staged.length && !s.unstaged.length && !s.unmerged.length;
}

/** Ahead/behind counts of a local branch against its upstream. */
export function aheadBehind(repo: Repo, branch: string): { upstream: string; ahead: number; behind: number } | undefined {
  const upstream = repo.upstream[branch];
  if (!upstream || !repo.remoteRefs[upstream]) return undefined;
  const local = repo.branches[branch];
  const remote = repo.remoteRefs[upstream];
  return {
    upstream,
    ahead: commitsBetween(repo, remote, local).length,
    behind: commitsBetween(repo, local, remote).length,
  };
}

/** Ref names pointing at each commit, for log decorations. */
export function decorations(repo: Repo, hash: string): string {
  const parts: string[] = [];
  const cur = currentBranch(repo);
  if (repo.head.type === 'detached' && repo.head.hash === hash) parts.push(c.cyan('HEAD'));
  for (const [name, h] of Object.entries(repo.branches)) {
    if (h !== hash) continue;
    parts.push(name === cur ? c.cyan('HEAD -> ') + c.green(name) : c.green(name));
  }
  for (const [name, h] of Object.entries(repo.remoteRefs)) if (h === hash) parts.push(c.red(name));
  for (const [name, h] of Object.entries(repo.tags)) if (h === hash) parts.push(c.yellow(`tag: ${name}`));
  return parts.length ? ` ${c.yellow('(')}${parts.join(c.yellow(', '))}${c.yellow(')')}` : '';
}
