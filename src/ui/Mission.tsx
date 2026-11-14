import { useEffect, useRef } from 'react';
import { CHARACTERS, pick, ui } from '../i18n';
import { useGame } from '../store';
import { Rich } from './rich';

export function Mission() {
  const lang = useGame((s) => s.lang);
  const level = useGame((s) => s.level!);
  const session = useGame((s) => s.session!);
  const hintsShown = useGame((s) => s.hintsShown);
  const showHint = useGame((s) => s.showHint);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [session.chat.length, hintsShown]);

  const current = level.objectives.find((o) => !session.done.includes(o.id))?.id;

  return (
    <div className="mission">
      <div className="chat">
        {session.chat.map((msg, i) => {
          const who = CHARACTERS[msg.from];
          return (
            <div key={i} className={`msg msg-${msg.tone ?? 'normal'}`}>
              <div className="avatar" style={{ borderColor: who.color }} aria-hidden>
                {who.avatar}
              </div>
              <div className="bubble">
                <div className="who" style={{ color: who.color }}>
                  {who.name} <span className="role">{pick(who.role, lang)}</span>
                </div>
                <div className="text">
                  <Rich text={pick(msg.text, lang)} />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {level.objectives.length > 0 && (
        <div className="objectives">
          <h3>{ui('objectives', lang)}</h3>
          <ol>
            {level.objectives.map((o) => {
              const done = session.done.includes(o.id);
              return (
                <li key={o.id} className={done ? 'done' : o.id === current ? 'current' : ''}>
                  <span className="check" aria-hidden>
                    {done ? '✔' : o.id === current ? '▸' : '·'}
                  </span>
                  <span>
                    <Rich text={pick(o.text, lang)} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {level.hints.length > 0 && (
        <div className="hints">
          {level.hints.slice(0, hintsShown).map((h, i) => (
            <div key={i} className="hint">
              <span aria-hidden>💡</span>
              <span>
                <Rich text={pick(h, lang)} />
              </span>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={showHint} disabled={hintsShown >= level.hints.length}>
            {hintsShown === 0 ? ui('hint', lang) : hintsShown >= level.hints.length ? ui('noMoreHints', lang) : ui('nextHint', lang)}
            {hintsShown < level.hints.length && ` (${hintsShown}/${level.hints.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
