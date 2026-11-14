import { useGame } from '../store';

export function LangToggle() {
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  return (
    <div className="lang" role="group" aria-label="Language">
      {(['es', 'en'] as const).map((l) => (
        <button key={l} type="button" className={l === lang ? 'active' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
