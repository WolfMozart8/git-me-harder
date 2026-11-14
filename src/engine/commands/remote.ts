import { c, currentBranch, headHash, isAncestor, requireRepo, resolveRef, short } from '../repo';
import { GitError, type Repo } from '../types';
import { copyHistory, hardReset, parseArgs, type Command, type Ctx } from './core';
import { mergeCommit, rebaseOnto } from './local';

function remoteRepo(ctx: Ctx, name: string): Repo {
  const url = ctx.repo.remotes[name];
  const remote = url ? ctx.world.remotes[url] : undefined;
  if (!remote) {
    throw new GitError([
      `fatal: '${name}' does not appear to be a git repository`,
      'fatal: Could not read from remote repository.',
      '',
      'Please make sure you have the correct access rights',
      'and the repository exists.',
    ]);
  }
  return remote;
}

export const remote: Command = ({ repo, out }, args) => {
  requireRepo(repo);
  const [sub, name, url] = args.filter((a) => !a.startsWith('-'));
  if (sub === 'add') {
    if (!name || !url) throw new GitError('usage: git remote add <name> <url>');
    if (repo.remotes[name]) throw new GitError(`error: remote ${name} already exists.`);
    repo.remotes[name] = url;
    return;
  }
  if (sub === 'remove' || sub === 'rm') {
    if (!repo.remotes[name]) throw new GitError(`error: No such remote: '${name}'`);
    delete repo.remotes[name];
    for (const ref of Object.keys(repo.remoteRefs)) if (ref.startsWith(name + '/')) delete repo.remoteRefs[ref];
    for (const [b, up] of Object.entries(repo.upstream)) if (up.startsWith(name + '/')) delete repo.upstream[b];
    return;
  }
  for (const [n, u] of Object.entries(repo.remotes)) {
    if (args.includes('-v')) out(`${n}\t${u} (fetch)`, `${n}\t${u} (push)`);
    else out(n);
  }
};

/** Update remote-tracking refs. Returns the lines git would print. */
export function fetchRemote(ctx: Ctx, name: string): string[] {
  const { repo } = ctx;
  const from = remoteRepo(ctx, name);
  const lines: string[] = [];
  for (const [branch, hash] of Object.entries(from.branches)) {
    const ref = `${name}/${branch}`;
    const old = repo.remoteRefs[ref];
    if (old === hash) continue;
    copyHistory(from, repo, hash);
    repo.remoteRefs[ref] = hash;
    if (!old) lines.push(` * [new branch]      ${branch.padEnd(10)} -> ${ref}`);
    else if (isAncestor(repo, old, hash)) lines.push(`   ${short(old)}..${short(hash)}  ${branch.padEnd(10)} -> ${ref}`);
    else lines.push(` + ${short(old)}...${short(hash)} ${branch.padEnd(10)} -> ${ref}  (forced update)`);
  }
  for (const ref of Object.keys(repo.remoteRefs)) {
    const [r, ...b] = ref.split('/');
    if (r === name && !(b.join('/') in from.branches) && ctx.repo.remoteRefs[ref]) {
      delete repo.remoteRefs[ref];
      lines.push(` - [deleted]         (none)     -> ${ref}`);
    }
  }
  for (const [t, hash] of Object.entries(from.tags)) {
    if (repo.tags[t]) continue;
    copyHistory(from, repo, hash);
    repo.tags[t] = hash;
    lines.push(` * [new tag]         ${t.padEnd(10)} -> ${t}`);
  }
  return lines.length ? [`From ${from.url}`, ...lines] : [];
}

function defaultRemote(repo: Repo): string {
  const cur = currentBranch(repo);
  const up = cur ? repo.upstream[cur] : undefined;
  if (up) return up.split('/')[0];
  if (repo.remotes.origin || !Object.keys(repo.remotes).length) return 'origin';
  return Object.keys(repo.remotes)[0];
}

export const fetch: Command = (ctx, args) => {
  requireRepo(ctx.repo);
  const p = parseArgs(args);
  const names = p.flags.has('--all') ? Object.keys(ctx.repo.remotes) : [p.rest[0] ?? defaultRemote(ctx.repo)];
  for (const n of names) ctx.out(...fetchRemote(ctx, n));
};

export const pull: Command = (ctx, args) => {
  const { repo, out } = ctx;
  requireRepo(repo);
  const p = parseArgs(args);
  const cur = currentBranch(repo);
  if (repo.op) throw new GitError(['error: Pulling is not possible because you have unmerged files.', 'fatal: Exiting because of an unresolved conflict.']);
  const name = p.rest[0] ?? defaultRemote(repo);
  out(...fetchRemote(ctx, name));
  let target: string | undefined;
  if (p.rest[1]) target = `${name}/${p.rest[1]}`;
  else if (cur && repo.upstream[cur]) target = repo.upstream[cur];
  if (!target) {
    throw new GitError([
      'There is no tracking information for the current branch.',
      'Please specify which branch you want to merge with.',
      '',
      '    git pull <remote> <branch>',
      '',
      'If you wish to set tracking information for this branch you can do so with:',
      '',
      `    git branch --set-upstream-to=${name}/<branch> ${cur ?? ''}`,
    ]);
  }
  const theirs = repo.remoteRefs[target];
  if (!theirs) throw new GitError(`fatal: couldn't find remote ref ${target.split('/').slice(1).join('/')}`);
  if (p.flags.has('--rebase') || p.flags.has('-r')) return rebaseOnto(ctx, theirs, target);
  if (p.flags.has('--ff-only') && !isAncestor(repo, headHash(repo), theirs)) {
    throw new GitError('fatal: Not possible to fast-forward, aborting.');
  }
  mergeCommit(ctx, theirs, target, {
    message: `Merge branch '${target.split('/').slice(1).join('/')}' of ${remoteRepo(ctx, name).url}${cur && cur !== 'main' ? ` into ${cur}` : ''}`,
  });
};

export const push: Command = (ctx, args) => {
  const { repo, out } = ctx;
  requireRepo(repo);
  const p = parseArgs(args);
  const cur = currentBranch(repo);
  const setUp = p.flags.has('-u') || p.flags.has('--set-upstream');
  const force = p.flags.has('-f') || p.flags.has('--force');
  const lease = p.flags.has('--force-with-lease');
  const name = p.rest[0] ?? defaultRemote(repo);
  const to = remoteRepo(ctx, name);

  if (p.flags.has('--tags')) {
    const lines: string[] = [];
    for (const [t, hash] of Object.entries(repo.tags)) {
      if (to.tags[t]) continue;
      copyHistory(repo, to, hash);
      to.tags[t] = hash;
      lines.push(` * [new tag]         ${t} -> ${t}`);
    }
    return out(...(lines.length ? [`To ${to.url}`, ...lines] : ['Everything up-to-date']));
  }

  let spec = p.rest[1];
  if (p.flags.has('--delete') || p.flags.has('-d') || spec?.startsWith(':')) {
    const b = (spec ?? '').replace(/^:/, '');
    if (!(b in to.branches)) throw new GitError([`error: unable to delete '${b}': remote ref does not exist`, `error: failed to push some refs to '${to.url}'`]);
    delete to.branches[b];
    delete repo.remoteRefs[`${name}/${b}`];
    return out(`To ${to.url}`, ` - [deleted]         ${b}`);
  }

  if (!spec) {
    if (!cur) throw new GitError('fatal: You are not currently on a branch.');
    const up = repo.upstream[cur];
    if (!up && !setUp) {
      throw new GitError([
        `fatal: The current branch ${cur} has no upstream branch.`,
        'To push the current branch and set the remote as upstream, use',
        '',
        `    git push --set-upstream ${name} ${cur}`,
      ]);
    }
    spec = up ? `${cur}:${up.split('/').slice(1).join('/')}` : cur;
  }
  if (spec === 'HEAD' && cur) spec = cur;
  const [src, dst = src] = spec.split(':');

  if (repo.tags[src] && !repo.branches[src]) {
    if (to.tags[dst]) return out('Everything up-to-date');
    copyHistory(repo, to, repo.tags[src]);
    to.tags[dst] = repo.tags[src];
    return out(`To ${to.url}`, ` * [new tag]         ${src} -> ${dst}`);
  }

  const local = repo.branches[src] ?? resolveRef(repo, src);
  if (!local) throw new GitError([`error: src refspec ${src} does not match any`, `error: failed to push some refs to '${to.url}'`]);
  const remoteHash = to.branches[dst];
  const ref = `${name}/${dst}`;
  const track = () => {
    if (setUp && repo.branches[src]) {
      repo.upstream[src] = ref;
      out(`branch '${src}' set up to track '${ref}'.`);
    }
  };
  if (remoteHash === local) {
    repo.remoteRefs[ref] = local;
    out('Everything up-to-date');
    return track();
  }
  const fastForward = !remoteHash || isAncestor(repo, remoteHash, local);
  const leaseOk = lease && repo.remoteRefs[ref] === remoteHash;
  if (!fastForward && !force && !leaseOk) {
    const known = !!repo.commits[remoteHash];
    throw new GitError([
      `To ${to.url}`,
      ` ${c.red('! [rejected]')}        ${src} -> ${dst} (${lease ? 'stale info' : known ? 'non-fast-forward' : 'fetch first'})`,
      c.red(`error: failed to push some refs to '${to.url}'`),
      ...(known
        ? [
            'hint: Updates were rejected because the tip of your current branch is behind',
            "hint: its remote counterpart. Integrate the remote changes (e.g.",
            "hint: 'git pull ...') before pushing again.",
          ]
        : [
            'hint: Updates were rejected because the remote contains work that you do',
            'hint: not have locally. This is usually caused by another repository pushing',
            'hint: to the same ref. You may want to first integrate the remote changes',
            "hint: (e.g., 'git pull ...') before pushing again.",
          ]),
      "hint: See the 'Note about fast-forwards' in 'git push --help' for details.",
    ]);
  }
  copyHistory(repo, to, local);
  to.branches[dst] = local;
  repo.remoteRefs[ref] = local;
  out(`To ${to.url}`);
  if (!remoteHash) out(` * [new branch]      ${src} -> ${dst}`);
  else if (fastForward) out(`   ${short(remoteHash)}..${short(local)}  ${src} -> ${dst}`);
  else out(` + ${short(remoteHash)}...${short(local)} ${src} -> ${dst} (forced update)`);
  track();
  ctx.events.push({ type: 'push', remote: name, branch: dst, hash: local });
};

export const clone: Command = (ctx, args) => {
  const { repo, world, out } = ctx;
  const [url] = args.filter((a) => !a.startsWith('-'));
  if (!url) throw new GitError('fatal: You must specify a repository to clone.');
  const from = world.remotes[url];
  if (!from) throw new GitError([`fatal: repository '${url}' not found`]);
  if (repo.initialized) throw new GitError("fatal: destination path '.' already exists and is not an empty directory.");
  repo.initialized = true;
  repo.remotes.origin = url;
  out("Cloning into '.'...");
  fetchRemote(ctx, 'origin');
  const main = from.head.type === 'branch' ? from.head.name : 'main';
  repo.head = { type: 'branch', name: main };
  const hash = repo.remoteRefs[`origin/${main}`];
  if (hash) {
    repo.branches[main] = hash;
    repo.upstream[main] = `origin/${main}`;
    hardReset(repo, hash);
    repo.reflog.unshift({ hash, message: `clone: from ${url}` });
  } else out('warning: You appear to have cloned an empty repository.');
  out('done.');
};
