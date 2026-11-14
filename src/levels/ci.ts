import { parse } from 'acorn';
import { CONFLICT_MARKER, type Tree } from '../engine';
import type { L } from './types';

export interface CiSpec {
  /** Remote branch whose pushes trigger the pipeline. */
  branch: string;
  /** File whose code the tests exercise. */
  entry: string;
  /** Each test is a JS expression evaluated after the entry file; it must be truthy. */
  tests: { name: L; expr: string }[];
}

export interface CiStage {
  id: 'markers' | 'syntax' | 'tests';
  ok: boolean;
  detail?: string;
}

export interface CiResult {
  passed: boolean;
  stages: CiStage[];
  hash: string;
}

/** Runs test expressions against some code. Resolves to `true` or an error description per test. */
export type TestExecutor = (code: string, exprs: string[]) => Promise<(true | string)[]>;

/** Runs in the current thread. Fine for tests; the app uses a Web Worker with a timeout instead. */
export const directExecutor: TestExecutor = async (code, exprs) =>
  exprs.map((expr) => {
    try {
      return new Function(`${code}\n;return (${expr});`)() ? true : 'assertion failed';
    } catch (e) {
      return String(e);
    }
  });

/** The simulated pipeline: conflict markers → syntax → the level's tests. Later stages are skipped after a failure. */
export async function runCi(tree: Tree, spec: CiSpec, hash: string, executor: TestExecutor): Promise<CiResult> {
  const stages: CiStage[] = [];
  const done = (): CiResult => ({ passed: stages.every((s) => s.ok), stages, hash });
  const sources = Object.entries(tree).filter(([path]) => path.endsWith('.js'));

  const marked = sources.filter(([, text]) => CONFLICT_MARKER.test(text)).map(([path]) => path);
  stages.push({ id: 'markers', ok: !marked.length, detail: marked.join(', ') || undefined });
  if (marked.length) return done();

  for (const [path, text] of sources) {
    try {
      parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (e) {
      stages.push({ id: 'syntax', ok: false, detail: `${path}: ${(e as Error).message}` });
      return done();
    }
  }
  stages.push({ id: 'syntax', ok: true });

  const code = tree[spec.entry];
  if (code === undefined) {
    stages.push({ id: 'tests', ok: false, detail: `${spec.entry}: file not found` });
    return done();
  }
  const results = await executor(code, spec.tests.map((t) => t.expr));
  const failed = results.findIndex((r) => r !== true);
  stages.push({
    id: 'tests',
    ok: failed === -1,
    detail: failed === -1 ? `${results.length}/${results.length}` : `${spec.tests[failed].expr} → ${results[failed]}`,
  });
  return done();
}
