import { ancestors, currentBranch, headHash, short, type Repo } from '../engine';
import { ui } from '../i18n';
import { useGame } from '../store';

const ROW = 40;
const LANE = 20;
const PAD = 14;
const COLORS = ['#8ddb6a', '#6cb6ff', '#f2b84b', '#e58fd8', '#ff8f6b', '#7fe0d0'];

interface Node {
  hash: string;
  lane: number;
  row: number;
}

/** Assign every reachable commit a row (newest first) and a lane. */
export function layoutGraph(repo: Repo): { nodes: Node[]; lanes: number } {
  const tips = [headHash(repo), ...Object.values(repo.branches), ...Object.values(repo.remoteRefs), ...Object.values(repo.tags)];
  const all = new Set<string>();
  for (const tip of tips) for (const h of ancestors(repo, tip)) all.add(h);
  const sorted = [...all].sort((a, b) => repo.commits[b].time - repo.commits[a].time);

  const lanes: (string | null)[] = [];
  const free = () => {
    const i = lanes.indexOf(null);
    return i === -1 ? lanes.push(null) - 1 : i;
  };
  let width = 1;
  const nodes = sorted.map((hash, row) => {
    let lane = lanes.indexOf(hash);
    if (lane === -1) lane = free();
    // other lanes waiting for this same commit end here
    lanes.forEach((x, i) => {
      if (x === hash && i !== lane) lanes[i] = null;
    });
    const [first, ...others] = repo.commits[hash].parents;
    // keep following the first parent, unless another lane is already heading to it
    lanes[lane] = first && !lanes.includes(first) ? first : null;
    for (const p of others) if (!lanes.includes(p)) lanes[free()] = p;
    width = Math.max(width, lanes.length);
    return { hash, lane, row };
  });
  return { nodes, lanes: width };
}

export function CommitGraph() {
  const lang = useGame((s) => s.lang);
  const world = useGame((s) => s.session!.world);
  const repo = world.local;
  const originUrl = repo.remotes.origin ?? Object.keys(world.remotes)[0];
  const origin = originUrl ? world.remotes[originUrl] : undefined;

  if (!repo.initialized) {
    return (
      <div className="graph">
        <div className="empty-note center">{ui('noRepo', lang)}</div>
        <Server />
      </div>
    );
  }

  const { nodes, lanes } = layoutGraph(repo);
  const pos = new Map(nodes.map((n) => [n.hash, n]));
  const x = (lane: number) => PAD + lane * LANE;
  const y = (row: number) => row * ROW + ROW / 2;
  const head = headHash(repo);
  const cur = currentBranch(repo);
  const gutter = PAD * 2 + (lanes - 1) * LANE;

  const refsAt = (hash: string) => {
    const refs: { name: string; kind: string }[] = [];
    if (repo.head.type === 'detached' && head === hash) refs.push({ name: 'HEAD', kind: 'head' });
    for (const [name, h] of Object.entries(repo.branches)) if (h === hash) refs.push({ name, kind: name === cur ? 'current' : 'branch' });
    for (const [name, h] of Object.entries(repo.remoteRefs)) if (h === hash) refs.push({ name, kind: 'remote' });
    for (const [name, h] of Object.entries(repo.tags)) if (h === hash) refs.push({ name, kind: 'tag' });
    return refs;
  };

  return (
    <div className="graph">
      <h3>{ui('local', lang)}</h3>
      {!nodes.length ? (
        <div className="empty-note">{ui('noCommits', lang)}</div>
      ) : (
        <div className="graph-rows" style={{ height: nodes.length * ROW }}>
          <svg width={gutter} height={nodes.length * ROW} aria-hidden>
            {nodes.flatMap((n) =>
              repo.commits[n.hash].parents.map((p) => {
                const to = pos.get(p);
                if (!to) return null;
                const [x1, y1, x2, y2] = [x(n.lane), y(n.row), x(to.lane), y(to.row)];
                const d = x1 === x2 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${x1} ${y1 + ROW * 0.7}, ${x2} ${y2 - ROW * 0.7}, ${x2} ${y2}`;
                return <path key={n.hash + p} d={d} fill="none" stroke={COLORS[Math.max(n.lane, to.lane) % COLORS.length]} strokeWidth={2} />;
              }),
            )}
            {nodes.map((n) => {
              const color = COLORS[n.lane % COLORS.length];
              const unpushed = origin && !origin.commits[n.hash];
              return (
                <circle
                  key={n.hash}
                  cx={x(n.lane)}
                  cy={y(n.row)}
                  r={n.hash === head ? 7 : 5.5}
                  fill={unpushed ? 'var(--panel)' : color}
                  stroke={n.hash === head ? '#fff' : color}
                  strokeWidth={n.hash === head ? 2.5 : 2}
                />
              );
            })}
          </svg>
          <div className="graph-labels" style={{ left: gutter }}>
            {nodes.map((n) => {
              const cm = repo.commits[n.hash];
              return (
                <div key={n.hash} className="graph-row" style={{ height: ROW }}>
                  <div className="graph-line">
                    <span className="hash">{short(n.hash)}</span>
                    {refsAt(n.hash).map((r) => (
                      <span key={r.kind + r.name} className={`ref ref-${r.kind}`}>
                        {r.kind === 'current' && 'HEAD → '}
                        {r.kind === 'tag' && '🏷 '}
                        {r.name}
                      </span>
                    ))}
                  </div>
                  <div className="graph-sub">
                    <span className="subject">{cm.message.split('\n')[0]}</span>
                    <span className="author"> · {cm.author}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Server />
    </div>
  );
}

/** What is really on the server right now, including what you have not fetched yet. */
function Server() {
  const lang = useGame((s) => s.lang);
  const world = useGame((s) => s.session!.world);
  const repo = world.local;
  const url = repo.remotes.origin ?? Object.keys(world.remotes)[0];
  const origin = url ? world.remotes[url] : undefined;
  if (!origin) return null;
  const branches = Object.entries(origin.branches).sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));
  return (
    <div className="server">
      <h3>☁ {ui('server', lang)}</h3>
      <div className="server-url">{origin.url}</div>
      {branches.map(([name, hash]) => {
        const cm = origin.commits[hash];
        const stale = repo.remoteRefs[`origin/${name}`] !== hash;
        return (
          <div key={name} className="server-row">
            <span className="ref ref-remote">{name}</span>
            <span className="hash">{short(hash)}</span>
            <span className="subject">{cm.message.split('\n')[0]}</span>
            <span className="author"> · {cm.author}</span>
            {stale && repo.remotes.origin && <span className="ref ref-stale">{ui('notFetched', lang)}</span>}
          </div>
        );
      })}
      {Object.keys(origin.tags).map((tag) => (
        <div key={tag} className="server-row">
          <span className="ref ref-tag">🏷 {tag}</span>
        </div>
      ))}
    </div>
  );
}
