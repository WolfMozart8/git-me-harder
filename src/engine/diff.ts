import { diffLines, structuredPatch } from 'diff';
import { c, diffTrees } from './repo';
import type { Tree } from './types';

/** Unified diff between two trees, formatted like `git diff`. */
export function formatTreeDiff(from: Tree, to: Tree, only?: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const ch of diffTrees(from, to)) {
    if (only && !only(ch.path)) continue;
    const a = from[ch.path] ?? '';
    const b = to[ch.path] ?? '';
    out.push(c.bold(`diff --git a/${ch.path} b/${ch.path}`));
    if (ch.kind === 'new file') out.push(c.bold('new file mode 100644'));
    if (ch.kind === 'deleted') out.push(c.bold('deleted file mode 100644'));
    out.push(c.bold(`--- ${ch.kind === 'new file' ? '/dev/null' : 'a/' + ch.path}`));
    out.push(c.bold(`+++ ${ch.kind === 'deleted' ? '/dev/null' : 'b/' + ch.path}`));
    const patch = structuredPatch(ch.path, ch.path, a, b, '', '', { context: 3 });
    for (const h of patch.hunks) {
      out.push(c.cyan(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`));
      for (const line of h.lines) {
        if (line.startsWith('+')) out.push(c.green(line));
        else if (line.startsWith('-')) out.push(c.red(line));
        else if (!line.startsWith('\\')) out.push(line);
      }
    }
  }
  return out;
}

/** "2 files changed, 3 insertions(+), 1 deletion(-)" */
export function diffStat(from: Tree, to: Tree): string {
  const changes = diffTrees(from, to);
  let ins = 0;
  let del = 0;
  for (const ch of changes) {
    for (const part of diffLines(from[ch.path] ?? '', to[ch.path] ?? '')) {
      if (part.added) ins += part.count ?? 0;
      if (part.removed) del += part.count ?? 0;
    }
  }
  const parts = [` ${changes.length} file${changes.length === 1 ? '' : 's'} changed`];
  if (ins) parts.push(`${ins} insertion${ins === 1 ? '' : 's'}(+)`);
  if (del) parts.push(`${del} deletion${del === 1 ? '' : 's'}(-)`);
  return parts.join(', ');
}

export type LineMark = 'added' | 'modified';

/**
 * Per-line marks for the editor gutter, comparing a file against its committed version.
 * `deletedAfter` lists line numbers (0 = top of file) after which lines were removed.
 */
export function lineMarks(oldText: string | undefined, newText: string): { marks: Record<number, LineMark>; deletedAfter: number[] } {
  const marks: Record<number, LineMark> = {};
  const deletedAfter: number[] = [];
  if (oldText === undefined) {
    const n = newText === '' ? 0 : newText.replace(/\n$/, '').split('\n').length;
    for (let i = 1; i <= n; i++) marks[i] = 'added';
    return { marks, deletedAfter };
  }
  const parts = diffLines(oldText, newText);
  let line = 1;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const count = p.count ?? 0;
    if (p.removed) {
      const next = parts[i + 1];
      if (next?.added) {
        // replaced block: the first lines are "modified", extra new lines are "added"
        const nextCount = next.count ?? 0;
        for (let k = 0; k < nextCount; k++) marks[line + k] = k < count ? 'modified' : 'added';
        line += nextCount;
        i++;
      } else deletedAfter.push(line - 1);
    } else if (p.added) {
      for (let k = 0; k < count; k++) marks[line + k] = 'added';
      line += count;
    } else line += count;
  }
  return { marks, deletedAfter };
}
