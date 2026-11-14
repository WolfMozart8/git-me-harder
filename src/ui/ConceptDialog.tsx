import { useEffect } from 'react';
import { pick, ui } from '../i18n';
import { CONCEPTS, conceptById } from '../levels/concepts';
import { useGame } from '../store';
import { Rich } from './rich';

/** "What is git stash?" — a plain-language explanation with examples that can be sent to the terminal. */
export function ConceptDialog() {
  const lang = useGame((s) => s.lang);
  const id = useGame((s) => s.concept);
  const show = useGame((s) => s.showConcept);
  const concept = id ? conceptById(id) : undefined;

  useEffect(() => {
    if (!concept) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && show(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [concept, show]);

  if (!concept) return null;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && show(null)}>
      <div className="modal concept" role="dialog" aria-modal="true" aria-labelledby="concept-title">
        <button type="button" className="btn btn-ghost concept-close" aria-label={ui('close', lang)} onClick={() => show(null)}>
          ✕
        </button>
        <h2 id="concept-title">{concept.title}</h2>

        <h3>{ui('conceptWhat', lang)}</h3>
        <p>
          <Rich text={pick(concept.what, lang)} />
        </p>

        <h3>{ui('conceptHow', lang)}</h3>
        <p>
          <Rich text={pick(concept.how, lang)} />
        </p>

        <h3>{ui('conceptExamples', lang)}</h3>
        {/* clicking an example sends it to the terminal, so get out of the way */}
        <ul className="examples" onClick={(e) => (e.target as HTMLElement).closest('.code-btn') && show(null)}>
          {concept.examples.map((ex) => (
            <li key={ex.cmd}>
              <Rich text={'`' + ex.cmd + '`'} />
              <span>
                <Rich text={pick(ex.note, lang)} />
              </span>
            </li>
          ))}
        </ul>
        <p className="concept-tip">{ui('conceptTip', lang)}</p>

        <h3>{ui('conceptMore', lang)}</h3>
        <div className="concept-chips">
          {CONCEPTS.map((c) => (
            <button key={c.id} type="button" className={`chip ${c.id === concept.id ? 'active' : ''}`} onClick={() => show(c.id)}>
              {c.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
