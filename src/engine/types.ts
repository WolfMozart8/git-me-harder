/** A snapshot of files: path → content. */
export type Tree = Record<string, string>;

export interface Commit {
  hash: string;
  tree: Tree;
  parents: string[];
  message: string;
  author: string;
  time: number;
}

export interface StashEntry {
  message: string;
  /** Working tree at the moment of stashing. */
  tree: Tree;
  /** Commit the stash was created on. */
  base: string;
  branch: string;
}

export type Head = { type: 'branch'; name: string } | { type: 'detached'; hash: string };

export type OpKind = 'merge' | 'cherry-pick' | 'revert' | 'rebase';

/** An operation that stopped half-way (usually because of conflicts). */
export interface Operation {
  kind: OpKind;
  /** HEAD before the operation started, to restore on --abort. */
  origHead: Head;
  origHash: string;
  /** cherry-pick / revert / rebase: the commit currently being applied. */
  current?: string;
  /** merge: the commit being merged in. */
  mergeHead?: string;
  /** Message for the commit that concludes the current step. */
  message: string;
  /** Author to keep for the current step (cherry-pick / rebase). */
  author?: string;
  /** rebase / cherry-pick: commits still to apply after the current one. */
  todo: string[];
  /** rebase: name of the branch being rebased and what it is rebased onto. */
  branch?: string;
  onto?: string;
}

export interface Repo {
  /** Display name / url, e.g. "origin" repos use their url. */
  url: string;
  initialized: boolean;
  commits: Record<string, Commit>;
  branches: Record<string, string>;
  tags: Record<string, string>;
  /** Remote-tracking refs, e.g. "origin/main" → hash. */
  remoteRefs: Record<string, string>;
  /** Local branch → upstream ("origin/main"). */
  upstream: Record<string, string>;
  /** Remote name → url of a repo in World.remotes. */
  remotes: Record<string, string>;
  head: Head;
  index: Tree;
  workdir: Tree;
  stash: StashEntry[];
  reflog: { hash: string; message: string }[];
  op: Operation | null;
  /** Paths with unresolved conflicts. */
  conflicts: string[];
  user: string;
}

export interface World {
  local: Repo;
  /** Simulated remote repositories, keyed by url. */
  remotes: Record<string, Repo>;
  /** Logical clock so commit times (and hashes) are deterministic. */
  clock: number;
}

export type EngineEvent =
  | { type: 'command'; argv: string[] }
  | { type: 'push'; remote: string; branch: string; hash: string }
  | { type: 'commit'; hash: string };

export class GitError extends Error {
  lines: string[];
  constructor(message: string | string[]) {
    const lines = Array.isArray(message) ? message : [message];
    super(lines.join('\n'));
    this.lines = lines;
  }
}
