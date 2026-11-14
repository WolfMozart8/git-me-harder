import { pick, ui } from '../i18n';
import { CHAPTERS, LEVELS } from '../levels';
import { SANDBOX } from '../levels/sandbox';
import { useGame } from '../store';
import { LangToggle } from './LangToggle';

export function Roadmap() {
  const lang = useGame((s) => s.lang);
  const completed = useGame((s) => s.completed);
  const start = useGame((s) => s.start);
  const resetProgress = useGame((s) => s.resetProgress);

  const done = LEVELS.filter((l) => completed.includes(l.id)).length;
  const nextUp = LEVELS.find((l) => !completed.includes(l.id));

  return (
    <div className="roadmap">
      <header className="hero">
        <div className="hero-top">
          <LangToggle />
        </div>
        <h1>
          git me <span>harder</span>
        </h1>
        <p className="tagline">{ui('tagline', lang)}</p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={LEVELS.length} aria-valuenow={done}>
          <div className="progress-bar" style={{ width: `${(done / LEVELS.length) * 100}%` }} />
        </div>
        <p className="progress-text">
          {done} / {LEVELS.length} {ui('progress', lang)}
        </p>
      </header>

      <main className="chapters">
        {CHAPTERS.map((ch) => (
          <section key={ch.id} className="chapter">
            <div className="chapter-head">
              <span className="chapter-num">{ch.id}</span>
              <div>
                <h2>{pick(ch.title, lang)}</h2>
                <p>{pick(ch.blurb, lang)}</p>
              </div>
            </div>
            <div className="level-grid">
              {LEVELS.filter((l) => l.chapter === ch.id).map((l) => {
                const isDone = completed.includes(l.id);
                const state = isDone ? 'done' : l.id === nextUp?.id ? 'next' : 'open';
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`level-card level-${state}`}
                    onClick={() => start(l.id)}
                  >
                    <span className="level-id">{l.id}</span>
                    {isDone && <span className="level-check">✔ {ui('completed', lang)}</span>}
                    {state === 'next' && <span className="level-check level-suggested">▸ {ui('suggested', lang)}</span>}
                    <span className="level-title">{pick(l.title, lang)}</span>
                    <span className="level-teaches">
                      {l.teaches.map((cmd) => (
                        <code key={cmd}>{cmd}</code>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="chapter">
          <div className="chapter-head">
            <span className="chapter-num">∞</span>
            <div>
              <h2>{ui('sandbox', lang)}</h2>
              <p>{ui('sandboxBlurb', lang)}</p>
            </div>
          </div>
          <div className="level-grid">
            <button type="button" className="level-card level-open" onClick={() => start(SANDBOX.id)}>
              <span className="level-id">$_</span>
              <span className="level-title">{ui('sandbox', lang)}</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="roadmap-foot">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!completed.length}
          onClick={() => window.confirm(ui('confirmReset', lang)) && resetProgress()}
        >
          {ui('resetProgress', lang)}
        </button>
      </footer>
    </div>
  );
}
