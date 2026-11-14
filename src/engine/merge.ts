import { diff3Merge } from 'node-diff3';
import type { Tree } from './types';

const toLines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'));
const fromLines = (lines: string[]) => (lines.length ? lines.join('\n') + '\n' : '');

export const CONFLICT_MARKER = /^(<{7}|={7}|>{7})( |$)/m;

/** Three-way merge of one file. Conflicts are written with git-style markers. */
export function mergeFile(
  base: string,
  ours: string,
  theirs: string,
  labels: { ours: string; theirs: string },
): { content: string; conflict: boolean } {
  const regions = diff3Merge(toLines(ours), toLines(base), toLines(theirs));
  const out: string[] = [];
  let conflict = false;
  for (const r of regions) {
    if (r.ok) out.push(...r.ok);
    else if (r.conflict) {
      conflict = true;
      out.push(`<<<<<<< ${labels.ours}`, ...r.conflict.a, '=======', ...r.conflict.b, `>>>>>>> ${labels.theirs}`);
    }
  }
  return { content: fromLines(out), conflict };
}

export interface TreeMerge {
  tree: Tree;
  /** Paths left with conflicts, with a git-like description. */
  conflicts: { path: string; message: string }[];
}

/** Three-way merge of whole trees. */
export function mergeTrees(base: Tree, ours: Tree, theirs: Tree, labels: { ours: string; theirs: string }): TreeMerge {
  const tree: Tree = {};
  const conflicts: TreeMerge['conflicts'] = [];
  const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  const put = (p: string, v: string | undefined) => {
    if (v !== undefined) tree[p] = v;
  };
  for (const p of [...paths].sort()) {
    const o = base[p];
    const a = ours[p];
    const b = theirs[p];
    if (a === b) put(p, a);
    else if (a === o) put(p, b);
    else if (b === o) put(p, a);
    else if (a === undefined || b === undefined) {
      // modify/delete: keep the surviving version and flag it
      put(p, a ?? b);
      const deletedIn = a === undefined ? labels.ours : labels.theirs;
      conflicts.push({ path: p, message: `CONFLICT (modify/delete): ${p} deleted in ${deletedIn} and modified in the other side.` });
    } else {
      const m = mergeFile(o ?? '', a, b, labels);
      tree[p] = m.content;
      if (m.conflict) {
        const kind = o === undefined ? 'add/add' : 'content';
        conflicts.push({ path: p, message: `CONFLICT (${kind}): Merge conflict in ${p}` });
      }
    }
  }
  return { tree, conflicts };
}
