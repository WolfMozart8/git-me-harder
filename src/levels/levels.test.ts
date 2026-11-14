import { describe, expect, it } from 'vitest';
import { createSession, directExecutor, levelById, LEVELS, playSolution, runLine, runPipeline, editFile } from './index';
import { SHIPPING_MERGED } from './chapters/ch6-teamwork';

describe('every level', () => {
  it('has a unique id', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  for (const level of LEVELS) {
    describe(`${level.id} ${level.title.en}`, () => {
      it('does not start already solved', () => {
        const s = createSession(level);
        expect(s.completed).toBe(false);
        expect(s.done).toEqual([]);
      });

      it('is beaten by its reference solution', async () => {
        const s = await playSolution(level, directExecutor);
        const missing = level.objectives.filter((o) => !s.done.includes(o.id)).map((o) => o.id);
        expect(missing).toEqual([]);
        expect(s.completed).toBe(true);
      });
    });
  }
});

describe('simulated CI on level 6-1', () => {
  const level = levelById('6-1')!;

  /** Pull, write `content` as the conflict resolution, commit and push. */
  async function pushResolution(content: string | null) {
    const s = createSession(level);
    runLine(s, level, 'git pull');
    if (content !== null) editFile(s, level, 'cart.js', content);
    runLine(s, level, 'git add cart.js');
    runLine(s, level, 'git commit -m "merge"');
    const { ciPush } = runLine(s, level, 'git push');
    expect(ciPush).toBeDefined();
    const ci = await runPipeline(s, level, ciPush!.hash, directExecutor);
    return { s, ci };
  }

  it('fails at "markers" when the conflict was committed unresolved', async () => {
    const { s, ci } = await pushResolution(null);
    expect(ci.passed).toBe(false);
    expect(ci.stages.at(-1)).toMatchObject({ id: 'markers', ok: false });
    expect(s.completed).toBe(false);
    expect(s.chat.at(-1)).toMatchObject({ from: 'boss', tone: 'angry' });
  });

  it('fails at "syntax" when the code does not parse', async () => {
    const { ci } = await pushResolution(SHIPPING_MERGED.replace('return sum - discount(sum) + SHIPPING;', 'return sum - discount(sum + SHIPPING;'));
    expect(ci.stages.at(-1)).toMatchObject({ id: 'syntax', ok: false });
  });

  it('fails at "tests" when one side of the conflict was dropped', async () => {
    const { ci } = await pushResolution(SHIPPING_MERGED.replace(' + SHIPPING;', ';'));
    expect(ci.stages.at(-1)).toMatchObject({ id: 'tests', ok: false });
  });

  it('lets the player recover with a follow-up commit', async () => {
    const { s } = await pushResolution(SHIPPING_MERGED.replace(' + SHIPPING;', ';'));
    editFile(s, level, 'cart.js', SHIPPING_MERGED);
    runLine(s, level, 'git commit -am "fix: add shipping back"');
    const { ciPush } = runLine(s, level, 'git push');
    const ci = await runPipeline(s, level, ciPush!.hash, directExecutor);
    expect(ci.passed).toBe(true);
    expect(s.completed).toBe(true);
  });
});
