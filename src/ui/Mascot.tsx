import { useState } from 'react';
import { pick, type Lang } from '../i18n';
import type { L } from '../levels';

/** What the git logo answers after every crack of the whip. */
const COMEBACKS: L[] = [
  { es: '¿Eso es todo?', en: 'Is that all you’ve got?' },
  { es: 'Más fuerte, que ni me entero.', en: 'Harder. I barely felt that.' },
  { es: 'He sobrevivido a merges peores.', en: 'I’ve survived worse merges.' },
  { es: 'Primero haz commit, luego hablamos.', en: 'Commit first, then we talk.' },
  { es: 'Ni un rebase me hace llorar.', en: 'Not even a rebase makes me cry.' },
  { es: 'Uy… casi me haces un conflicto.', en: 'Ooh… you almost gave me a conflict.' },
  { es: 'Otra vez. Pero con -m.', en: 'Again. But with -m this time.' },
];

/**
 * The logo: a kawaii git diamond taking a whipping like a champ.
 * All motion is CSS (so prefers-reduced-motion stops it); every crack of the
 * whip advances the speech bubble, and clicking cracks it on demand.
 */
export function Mascot({ lang, label }: { lang: Lang; label: string }) {
  const [line, setLine] = useState(0);
  const [take, setTake] = useState(0);
  const next = () => setLine((n) => (n + 1) % COMEBACKS.length);

  return (
    <div className="mascot">
      <p className="mascot-bubble" aria-live="polite" key={line}>
        {pick(COMEBACKS[line], lang)}
      </p>
      <button
        type="button"
        className="mascot-btn"
        aria-label={label}
        title={label}
        onClick={() => {
          next();
          setTake((t) => t + 1);
        }}
      >
        <svg key={take} viewBox="0 0 340 300" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="gm-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff7a52" />
              <stop offset="1" stopColor="#e2401f" />
            </linearGradient>
          </defs>

          {/* floor shadow */}
          <ellipse className="m-shadow" cx="190" cy="282" rx="78" ry="10" fill="rgba(0,0,0,0.35)" />

          {/* the whip: handle off-frame on the left, lash curling onto the logo */}
          <g className="m-whip" onAnimationIteration={next}>
            <rect x="-6" y="38" width="64" height="16" rx="8" fill="#6b3f22" transform="rotate(-24 26 46)" />
            <rect x="48" y="24" width="10" height="20" rx="3" fill="#c9a24a" transform="rotate(-24 53 34)" />
            <path d="M58 28 C 120 -10, 190 10, 205 70 S 170 150, 132 120" fill="none" stroke="#3a2416" strokeWidth="7" strokeLinecap="round" />
            <path d="M132 120 l -14 -4 m 14 4 l -6 12" stroke="#3a2416" strokeWidth="4" strokeLinecap="round" />
          </g>

          {/* the logo itself */}
          <g className="m-body">
            {/* stubby feet */}
            <ellipse cx="160" cy="268" rx="16" ry="9" fill="#c2361a" />
            <ellipse cx="220" cy="268" rx="16" ry="9" fill="#c2361a" />
            {/* rounded diamond */}
            <rect x="110" y="88" width="160" height="160" rx="30" fill="url(#gm-body)" stroke="#1b1206" strokeWidth="5" transform="rotate(45 190 168)" />
            {/* branch graph on the forehead */}
            <g stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="#fff">
              <line x1="190" y1="66" x2="190" y2="128" />
              <path d="M190 84 C 190 100, 222 96, 222 116" fill="none" />
              <circle cx="190" cy="66" r="9" />
              <circle cx="222" cy="118" r="9" />
              <circle cx="190" cy="128" r="9" />
            </g>
            {/* bandage: it has done this before */}
            <g transform="rotate(-30 252 132)">
              <rect x="234" y="124" width="36" height="14" rx="6" fill="#ffe2c4" stroke="#1b1206" strokeWidth="2.5" />
              <circle cx="246" cy="131" r="1.6" fill="#c9a07a" />
              <circle cx="258" cy="131" r="1.6" fill="#c9a07a" />
            </g>
            {/* face: one big shiny eye, one smug wink, smirk */}
            <ellipse cx="165" cy="176" rx="13" ry="16" fill="#1b1206" />
            <circle cx="170" cy="169" r="5" fill="#fff" />
            <circle cx="161" cy="183" r="2.4" fill="#fff" />
            <path d="M203 178 q 12 -12 24 0" fill="none" stroke="#1b1206" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="148" cy="200" rx="10" ry="6" fill="#ff9f8a" opacity="0.75" />
            <ellipse cx="232" cy="200" rx="10" ry="6" fill="#ff9f8a" opacity="0.75" />
            <path d="M178 204 q 10 10 22 -2" fill="none" stroke="#1b1206" strokeWidth="4.5" strokeLinecap="round" />
            {/* sweat drop */}
            <path className="m-sweat" d="M246 152 q 9 14 0 20 q -9 -6 0 -20 z" fill="#8fd3ff" stroke="#1b1206" strokeWidth="2" />
            {/* tiny arm on the hip */}
            <path d="M262 214 q 22 4 18 -18" fill="none" stroke="#1b1206" strokeWidth="5" strokeLinecap="round" />
          </g>

          {/* impact */}
          <g className="m-impact">
            <path
              d="M118 118 l10 -22 l4 20 l20 -12 l-10 20 l22 4 l-22 8 l12 18 l-20 -8 l-4 22 l-8 -20 l-18 12 l6 -20 l-20 -6 l20 -6 z"
              fill="#ffd34d"
              stroke="#1b1206"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <text x="132" y="136" textAnchor="middle" fontSize="15" fontWeight="900" fill="#1b1206" fontFamily="system-ui, sans-serif">
              {lang === 'es' ? '¡ZAS!' : 'WHAP!'}
            </text>
          </g>

          {/* speed lines */}
          <g className="m-lines" stroke="#ffd34d" strokeWidth="4" strokeLinecap="round">
            <line x1="92" y1="88" x2="72" y2="78" />
            <line x1="96" y1="110" x2="70" y2="110" />
            <line x1="98" y1="134" x2="76" y2="146" />
          </g>
        </svg>
      </button>
    </div>
  );
}
