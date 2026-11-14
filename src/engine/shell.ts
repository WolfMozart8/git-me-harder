import type { Command, Ctx } from './commands/core';
import * as local from './commands/local';
import * as remote from './commands/remote';
import { c } from './repo';
import { GitError, type EngineEvent, type World } from './types';

const GIT: Record<string, Command> = {
  init: local.init,
  config: local.config,
  status: local.status,
  add: local.add,
  commit: local.commit,
  log: local.log,
  reflog: local.reflog,
  diff: local.diff,
  show: local.show,
  restore: local.restore,
  reset: local.reset,
  rm: local.rm,
  revert: local.revert,
  'cherry-pick': local.cherryPick,
  switch: local.switchCmd,
  checkout: local.checkout,
  branch: local.branch,
  merge: local.merge,
  rebase: local.rebase,
  stash: local.stash,
  tag: local.tag,
  remote: remote.remote,
  fetch: remote.fetch,
  pull: remote.pull,
  push: remote.push,
  clone: remote.clone,
};

export const GIT_COMMANDS = Object.keys(GIT).sort();
export const SHELL_COMMANDS = ['cat', 'clear', 'echo', 'git', 'help', 'ls', 'rm', 'touch'];

export interface ExecResult {
  lines: string[];
  ok: boolean;
  clear?: boolean;
  events: EngineEvent[];
}

/** Split a command line into words, honoring quotes. `&&` and `>` / `>>` become their own tokens. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  const flush = () => {
    if (has) tokens.push(cur);
    cur = '';
    has = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) cur += line[++i] === 'n' ? '\n' : line[i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) flush();
    else if (ch === '&' && line[i + 1] === '&') {
      flush();
      tokens.push('\u0000&&');
      i++;
    } else if (ch === '>') {
      flush();
      if (line[i + 1] === '>') {
        tokens.push('\u0000>>');
        i++;
      } else tokens.push('\u0000>');
    } else {
      cur += ch;
      has = true;
    }
  }
  flush();
  return tokens;
}

function shellCommand(ctx: Ctx, argv: string[], res: ExecResult): void {
  const { repo, out } = ctx;
  const [cmd, ...args] = argv;
  const files = args.filter((a) => !a.startsWith('-'));
  switch (cmd) {
    case 'git': {
      const [sub, ...rest] = args;
      if (!sub || sub === 'help' || sub === '--help') {
        return out('usage: git <command> [<args>]', '', 'Available commands:', '   ' + GIT_COMMANDS.join(', '));
      }
      if (sub === '--version' || sub === 'version') return out('git version 2.47.0 (simulated)');
      const fn = GIT[sub];
      if (!fn) throw new GitError(`git: '${sub}' is not a git command. See 'git --help'.`);
      return fn(ctx, rest);
    }
    case 'ls': {
      const names = Object.keys(repo.workdir).sort();
      if (args.includes('-a') || args.includes('-la') || args.includes('-al')) {
        if (repo.initialized) names.unshift(c.blue('.git/'));
      }
      return names.length ? out(names.join('  ')) : undefined;
    }
    case 'cat':
      for (const f of files) {
        if (!(f in repo.workdir)) throw new GitError(`cat: ${f}: No such file or directory`);
        out(...repo.workdir[f].replace(/\n$/, '').split('\n'));
      }
      return;
    case 'touch':
      for (const f of files) if (!(f in repo.workdir)) repo.workdir[f] = '';
      return;
    case 'rm':
      for (const f of files) {
        if (!(f in repo.workdir)) throw new GitError(`rm: cannot remove '${f}': No such file or directory`);
        delete repo.workdir[f];
      }
      return;
    case 'echo': {
      const at = args.findIndex((a) => a === '\u0000>' || a === '\u0000>>');
      if (at === -1) return out(args.join(' '));
      const file = args[at + 1];
      if (!file) throw new GitError('bash: syntax error near unexpected token `newline\'');
      const text = args.slice(0, at).join(' ') + '\n';
      repo.workdir[file] = args[at] === '\u0000>>' ? (repo.workdir[file] ?? '') + text : text;
      return;
    }
    case 'pwd':
      return out('/project');
    case 'clear':
      res.clear = true;
      return;
    case 'help':
      return out(
        'Shell: ' + SHELL_COMMANDS.join(', '),
        'Git:   ' + GIT_COMMANDS.join(', '),
        '',
        'echo "text" > file   write a file      echo "text" >> file   append to a file',
      );
    default:
      throw new GitError(`bash: ${cmd}: command not found`);
  }
}

/** Run one line typed in the terminal against the world (mutating it). */
export function exec(world: World, line: string): ExecResult {
  const res: ExecResult = { lines: [], ok: true, events: [] };
  const ctx: Ctx = { world, repo: world.local, out: (...l) => void res.lines.push(...l), events: res.events };
  const tokens = tokenize(line);
  const commands: string[][] = [[]];
  for (const t of tokens) {
    if (t === '\u0000&&') commands.push([]);
    else commands[commands.length - 1].push(t);
  }
  for (const argv of commands) {
    if (!argv.length) continue;
    try {
      shellCommand(ctx, argv, res);
      res.events.push({ type: 'command', argv });
    } catch (e) {
      if (!(e instanceof GitError)) throw e;
      res.lines.push(...e.lines);
      res.ok = false;
      res.events.push({ type: 'command', argv });
      break;
    }
  }
  return res;
}
