import type { ReactNode } from 'react';
import { useGame } from '../store';

/** Renders ANSI-colored terminal output as spans. */
export function Ansi({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cls = '';
  // eslint-disable-next-line no-control-regex
  text.split(/(\u001b\[\d+m)/).forEach((chunk, i) => {
    // eslint-disable-next-line no-control-regex
    const m = /^\u001b\[(\d+)m$/.exec(chunk);
    if (m) cls = m[1] === '0' ? '' : `ansi-${m[1]}`;
    else if (chunk) parts.push(cls ? <span key={i} className={cls}>{chunk}</span> : chunk);
  });
  return <>{parts}</>;
}

/** Tiny markdown: `code` (click to send to the terminal), **bold**, *italic* and line breaks. */
export function Rich({ text }: { text: string }) {
  const typeInTerminal = useGame((s) => s.typeInTerminal);
  const nodes: ReactNode[] = [];
  text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\n)/).forEach((part, i) => {
    if (!part) return;
    if (part === '\n') nodes.push(<br key={i} />);
    else if (part.startsWith('`')) {
      const code = part.slice(1, -1);
      const runnable = /^(git|echo|ls|cat|touch|rm)\b/.test(code) && !code.includes('<');
      nodes.push(
        runnable ? (
          <button key={i} type="button" className="code code-btn" title="→ terminal" onClick={() => typeInTerminal(code)}>
            {code}
          </button>
        ) : (
          <code key={i} className="code">{code}</code>
        ),
      );
    } else if (part.startsWith('**')) nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    else if (part.startsWith('*') && part.length > 2) nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
    else nodes.push(part);
  });
  return <>{nodes}</>;
}
