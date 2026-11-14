import { addRemoteRepo, ancestors, diffTrees, exec, getStatus, teammateCommit, treeOf, type Repo, type World } from '../engine';
import type { CharacterId, ChatMessage, GameView, L, Objective } from './types';

export const ORIGIN = 'https://git.kiwilabs.dev/kiwi-market.git';

export const README = '# Kiwi Market\n\nOnline store for fresh fruit.\n';

/** The file most levels revolve around. Plain script, so the simulated CI can run it. */
export const CART = `function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.qty;
  }
  return sum;
}
`;

export const CART_BUGGY = CART.replace('item.price * item.qty', 'item.price + item.qty');

export const t = (es: string, en: string): L => ({ es, en });

const speaker =
  (from: CharacterId) =>
  (es: string, en: string, tone?: ChatMessage['tone']): ChatMessage => ({ from, text: { es, en }, tone });
export const boss = speaker('boss');
export const diego = speaker('diego');
export const sofia = speaker('sofia');
export const guide = speaker('guide');

export const obj = (id: string, es: string, en: string, check: Objective['check']): Objective => ({ id, text: { es, en }, check });

/** Run setup commands, failing loudly if a level's setup is broken. */
export function run(world: World, ...commands: string[]): void {
  for (const cmd of commands) {
    const r = exec(world, cmd);
    if (!r.ok) throw new Error(`level setup failed at "${cmd}":\n${r.lines.join('\n')}`);
  }
}

export function write(world: World, path: string, content: string): void {
  world.local.workdir[path] = content;
}

/** A local repo with one commit containing the README and cart.js. */
export function localBase(world: World, cart = CART): void {
  run(world, 'git init');
  write(world, 'README.md', README);
  write(world, 'cart.js', cart);
  run(world, 'git add .', 'git commit -m "Initial commit"');
}

/** Create the team's remote with some history. Optionally clone it. */
export function withOrigin(world: World, opts: { clone?: boolean; cart?: string } = {}): void {
  addRemoteRepo(world, ORIGIN);
  teammateCommit(world, ORIGIN, { branch: 'main', author: 'Marta', message: 'Initial commit', files: { 'README.md': README } });
  teammateCommit(world, ORIGIN, { branch: 'main', author: 'Diego', message: 'feat: cart total', files: { 'cart.js': opts.cart ?? CART } });
  if (opts.clone !== false) run(world, `git clone ${ORIGIN}`);
}

export const teammate = (world: World, change: Parameters<typeof teammateCommit>[2]) => teammateCommit(world, ORIGIN, change);

// ---------- checks ----------
export const history = (repo: Repo, tip: string | undefined) => ancestors(repo, tip).map((h) => repo.commits[h]);

/** Files a commit changed relative to its first parent. */
export const changedFiles = (repo: Repo, hash: string) =>
  diffTrees(treeOf(repo, repo.commits[hash].parents[0]), repo.commits[hash].tree).map((ch) => ch.path);

export const hasMarkers = (text: string | undefined) => !!text && /^(<{7}|={7}|>{7})/m.test(text);

export const untracked = (g: GameView) => getStatus(g.repo).untracked;

/** Does the current history contain a commit with this message? */
export const headHas = (g: GameView, message: string) => !!g.head && history(g.repo, g.head.hash).some((cm) => cm.message.startsWith(message));

export const mine = (g: GameView) => !!g.head && history(g.repo, g.head.hash).filter((cm) => cm.author === g.repo.user);
