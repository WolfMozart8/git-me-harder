import { describe, expect, it } from 'vitest';
import { createWorld, exec } from '../engine';
import { CONCEPTS, conceptsFor } from './concepts';
import { LEVELS } from './index';

describe('concept explanations', () => {
  it('every level offers at least one explanation', () => {
    const without = LEVELS.filter((l) => !conceptsFor(l).length).map((l) => l.id);
    expect(without).toEqual([]);
  });

  it('every command a level teaches is covered by some concept', () => {
    const uncovered = LEVELS.flatMap((l) => l.teaches).filter((cmd) => !CONCEPTS.some((c) => c.match.test(cmd)));
    expect(uncovered).toEqual([]);
  });

  it('example commands are understood by the simulated shell', () => {
    const unknown: string[] = [];
    for (const c of CONCEPTS) {
      for (const ex of c.examples) {
        const out = exec(createWorld(), ex.cmd).lines.join('\n');
        if (/is not a git command|command not found|unknown subcommand/.test(out)) unknown.push(ex.cmd);
      }
    }
    expect(unknown).toEqual([]);
  });
});
