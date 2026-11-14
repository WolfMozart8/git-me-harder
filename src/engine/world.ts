import { createRepo, makeCommit } from './repo';
import type { Repo, Tree, World } from './types';

/** Add a simulated remote repository (not yet connected to the local repo). */
export function addRemoteRepo(world: World, url: string): Repo {
  const repo = createRepo(url, 'origin');
  repo.initialized = true;
  world.remotes[url] = repo;
  return repo;
}

export interface TeammateCommit {
  branch: string;
  author: string;
  message: string;
  /** Files to write; `null` deletes the file. */
  files: Record<string, string | null>;
  /** Branch to start from when `branch` does not exist yet (default: main). */
  from?: string;
}

/** A teammate commits straight on the remote, as if they had pushed. Returns the new hash. */
export function teammateCommit(world: World, url: string, change: TeammateCommit): string {
  const repo = world.remotes[url];
  const parent = repo.branches[change.branch] ?? repo.branches[change.from ?? 'main'];
  const tree: Tree = { ...(parent ? repo.commits[parent].tree : {}) };
  for (const [path, content] of Object.entries(change.files)) {
    if (content === null) delete tree[path];
    else tree[path] = content;
  }
  const hash = makeCommit(world, repo, { tree, parents: parent ? [parent] : [], message: change.message, author: change.author });
  repo.branches[change.branch] = hash;
  return hash;
}

export function writeFile(world: World, path: string, content: string): void {
  world.local.workdir[path] = content;
}

export const cloneWorld = (world: World): World => structuredClone(world);
