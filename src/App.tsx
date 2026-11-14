import { useEffect } from 'react';
import { levelById } from './levels';
import { SANDBOX } from './levels/sandbox';
import { useGame } from './store';
import { LevelView } from './ui/LevelView';
import { Roadmap } from './ui/Roadmap';

/** Open the level named in the URL (#/level/2-1). */
function syncFromHash(): void {
  const id = /^#\/level\/(.+)$/.exec(location.hash)?.[1];
  const game = useGame.getState();
  if (!id) {
    if (game.level) game.exit();
  } else if (game.level?.id !== id) {
    if (id === SANDBOX.id || levelById(id)) game.start(id);
    else history.replaceState(null, '', location.pathname + location.search);
  }
}

export function App() {
  const playing = useGame((s) => !!s.level && !!s.session);
  const lang = useGame((s) => s.lang);

  useEffect(() => {
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return playing ? <LevelView /> : <Roadmap />;
}
