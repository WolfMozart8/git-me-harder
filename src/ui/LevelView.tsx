import { useEffect, useState } from 'react';
import { pick, ui, type UiKey } from '../i18n';
import { CHAPTERS, nextLevel } from '../levels';
import { useGame } from '../store';
import { CommitGraph } from './CommitGraph';
import { EditorPanel } from './EditorPanel';
import { LangToggle } from './LangToggle';
import { Mission } from './Mission';
import { Terminal } from './Terminal';

type Side = 'editor' | 'graph';
type MobileTab = 'mission' | 'terminal' | Side;

export function LevelView() {
  const lang = useGame((s) => s.lang);
  const level = useGame((s) => s.level!);
  const session = useGame((s) => s.session!);
  const celebrate = useGame((s) => s.celebrate);
  const start = useGame((s) => s.start);
  const exit = useGame((s) => s.exit);
  const dismiss = useGame((s) => s.dismiss);
  const conflicts = session.world.local.conflicts.length;
  const pendingInput = useGame((s) => s.pendingInput);

  const [side, setSide] = useState<Side>('editor');
  const [tab, setTab] = useState<MobileTab>('mission');

  // a conflict is something to look at in the editor
  useEffect(() => {
    if (conflicts) setSide('editor');
  }, [conflicts]);

  // a command clicked anywhere lands in the terminal: show it on small screens
  useEffect(() => {
    if (pendingInput !== null) setTab('terminal');
  }, [pendingInput]);

  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  const next = nextLevel(level.id);
  const tabs: [MobileTab, UiKey][] = [
    ['mission', 'mission'],
    ['terminal', 'terminal'],
    ['editor', 'editor'],
    ['graph', 'graph'],
  ];
  const pickTab = (t: MobileTab) => {
    setTab(t);
    if (t === 'editor' || t === 'graph') setSide(t);
  };

  return (
    <div className="level" data-tab={tab}>
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={exit}>
          ← {ui('roadmap', lang)}
        </button>
        <div className="topbar-title">
          {chapter && (
            <span className="crumb">
              {ui('chapter', lang)} {chapter.id} · {pick(chapter.title, lang)}
            </span>
          )}
          <strong>
            {level.chapter ? `${level.id} ` : ''}
            {pick(level.title, lang)}
          </strong>
        </div>
        <div className="topbar-actions">
          {level.objectives.length > 0 && (
            <span className="pill">
              {session.done.length}/{level.objectives.length}
            </span>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => start(level.id)}>
            ↺ <span className="hide-sm">{ui('restart', lang)}</span>
          </button>
          <LangToggle />
        </div>
      </header>

      <nav className="mobile-tabs" role="tablist">
        {tabs.map(([id, key]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => pickTab(id)}>
            {ui(key, lang)}
            {id === 'editor' && conflicts > 0 && <span className="tab-alert">!</span>}
          </button>
        ))}
      </nav>

      <div className="panes">
        <section className="pane pane-mission" aria-label={ui('mission', lang)}>
          <Mission />
        </section>
        <section className="pane pane-terminal" aria-label={ui('terminal', lang)}>
          <Terminal />
        </section>
        <section className={`pane pane-side side-${side}`}>
          <div className="side-tabs" role="tablist">
            {(['editor', 'graph'] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={side === s} className={side === s ? 'active' : ''} onClick={() => setSide(s)}>
                {ui(s, lang)}
                {s === 'editor' && conflicts > 0 && <span className="tab-alert">!</span>}
              </button>
            ))}
          </div>
          <div className="side-body">{side === 'editor' ? <EditorPanel /> : <CommitGraph />}</div>
        </section>
      </div>

      {celebrate && (
        <div className="complete-bar" role="status">
          <span className="complete-text">
            <span aria-hidden>🥝</span> <strong>{ui('levelDone', lang)}</strong>
            <span className="hide-sm"> {next ? ui('levelDoneHint', lang) : ui('allDone', lang)}</span>
          </span>
          <span className="complete-actions">
            {next && (
              <button type="button" className="btn btn-primary" onClick={() => start(next.id)}>
                {ui('next', lang)} →
              </button>
            )}
            <button type="button" className="btn" onClick={exit}>
              {ui('backToMap', lang)}
            </button>
            <button type="button" className="btn btn-ghost" aria-label={ui('close', lang)} onClick={dismiss}>
              ✕
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
