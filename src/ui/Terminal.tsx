import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GIT_COMMANDS, SHELL_COMMANDS, type Repo } from '../engine';
import { ui } from '../i18n';
import { promptOf, useGame } from '../store';
import { Ansi, Rich } from './rich';

/** Candidates for Tab completion of the last word on the line. */
function complete(line: string, repo: Repo): string[] {
  const words = line.split(/\s+/);
  const last = words[words.length - 1];
  let pool: string[];
  if (words.length === 1) pool = SHELL_COMMANDS;
  else if (words[0] === 'git' && words.length === 2) pool = GIT_COMMANDS;
  else {
    pool = [
      ...Object.keys(repo.workdir),
      ...Object.keys(repo.branches),
      ...Object.keys(repo.remoteRefs),
      ...Object.keys(repo.remotes),
      ...Object.keys(repo.tags),
    ];
  }
  return [...new Set(pool.filter((x) => x.startsWith(last) && x !== last))].sort();
}

function commonPrefix(items: string[]): string {
  let p = items[0] ?? '';
  for (const it of items) while (!it.startsWith(p)) p = p.slice(0, -1);
  return p;
}

export function Terminal() {
  const lang = useGame((s) => s.lang);
  const term = useGame((s) => s.term);
  const repo = useGame((s) => s.session!.world.local);
  const run = useGame((s) => s.run);
  const pendingInput = useGame((s) => s.pendingInput);
  const typeInTerminal = useGame((s) => s.typeInTerminal);
  const ciRunning = useGame((s) => s.ciRunning);

  const [value, setValue] = useState('');
  const [past, setPast] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [options, setOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [term, options, ciRunning]);

  // a command clicked in the chat lands in the input
  useEffect(() => {
    if (pendingInput === null) return;
    setValue(pendingInput);
    typeInTerminal(null);
    inputRef.current?.focus();
  }, [pendingInput, typeInTerminal]);

  const submit = () => {
    const line = value.trim();
    setValue('');
    setOptions([]);
    setCursor(-1);
    if (!line) return;
    setPast((p) => (p[0] === line ? p : [line, ...p]));
    run(line);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(cursor + 1, past.length - 1);
      if (past[next] !== undefined) {
        setCursor(next);
        setValue(past[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cursor - 1;
      setCursor(Math.max(next, -1));
      setValue(next < 0 ? '' : past[next]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const found = complete(value, repo);
      if (!found.length) return;
      const words = value.split(/\s+/);
      const prefix = commonPrefix(found);
      words[words.length - 1] = prefix;
      setValue(words.join(' ') + (found.length === 1 ? ' ' : ''));
      setOptions(found.length > 1 ? found : []);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      run('clear');
    } else if (options.length) setOptions([]);
  };

  const prompt = promptOf(repo);

  return (
    <div className="terminal" onClick={() => window.getSelection()?.isCollapsed && inputRef.current?.focus()}>
      <div className="term-scroll">
        {!term.length && (
          <div className="term-line term-dim">
            <Rich text={ui('termWelcome', lang)} />
          </div>
        )}
        {term.map((line, i) =>
          line.kind === 'cmd' ? (
            <div key={i} className="term-line">
              <Prompt text={line.prompt ?? ''} /> {line.text}
            </div>
          ) : (
            <div key={i} className="term-line">
              <Ansi text={line.text} />
              {line.text === '' && ' '}
            </div>
          ),
        )}
        {options.length > 0 && <div className="term-line term-dim">{options.join('   ')}</div>}
        {ciRunning && <div className="term-line term-dim blink">{ui('ciRunning', lang)}</div>}
        <div className="term-input-row">
          <Prompt text={prompt} />
          <input
            ref={inputRef}
            className="term-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={ui('typeHere', lang)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label={ui('terminal', lang)}
            enterKeyHint="send"
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  const m = /^(\S+)(?: (\(.*\)))?$/.exec(text);
  return (
    <span className="prompt">
      <span className="prompt-dir">{m?.[1] ?? text}</span>
      {m?.[2] && <span className="prompt-branch"> {m[2]}</span>}
      <span className="prompt-sign"> $</span>
    </span>
  );
}
