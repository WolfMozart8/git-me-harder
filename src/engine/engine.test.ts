import { describe, expect, it } from 'vitest';
import { addRemoteRepo, createWorld, exec, getStatus, headHash, stripAnsi, teammateCommit, type World } from './index';

const REMOTE_URL = 'https://git.example/app.git';

/** Run commands; returns the plain-text output of the last one. */
function sh(world: World, ...lines: string[]): string {
  let last = '';
  for (const line of lines) last = stripAnsi(exec(world, line).lines.join('\n'));
  return last;
}
const ok = (world: World, line: string) => exec(world, line).ok;

function repoWithCommit(): World {
  const w = createWorld();
  sh(w, 'git init', 'echo "one" > a.txt', 'git add a.txt', 'git commit -m "first"');
  return w;
}

/** A world with an origin holding one commit, already cloned locally. */
function cloned(): World {
  const w = createWorld();
  addRemoteRepo(w, REMOTE_URL);
  teammateCommit(w, REMOTE_URL, { branch: 'main', author: 'Ana', message: 'init', files: { 'app.js': 'a\nb\nc\n' } });
  sh(w, `git clone ${REMOTE_URL}`);
  return w;
}

describe('basics', () => {
  it('requires a repository', () => {
    const w = createWorld();
    expect(sh(w, 'git status')).toContain('fatal: not a git repository');
    expect(sh(w, 'git init')).toContain('Initialized empty Git repository');
  });

  it('tracks untracked → staged → committed', () => {
    const w = createWorld();
    sh(w, 'git init', 'echo "hello" > a.txt');
    expect(sh(w, 'git status')).toContain('Untracked files:');
    expect(sh(w, 'git add a.txt', 'git status')).toMatch(/Changes to be committed:[\s\S]*new file:\s+a.txt/);
    expect(sh(w, 'git commit -m "first commit"')).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] first commit\n 1 file changed, 1 insertion\(\+\)/);
    expect(sh(w, 'git status')).toContain('nothing to commit, working tree clean');
  });

  it('refuses to commit nothing or without a message', () => {
    const w = repoWithCommit();
    expect(ok(w, 'git commit -m "again"')).toBe(false);
    sh(w, 'echo "two" >> a.txt', 'git add .');
    expect(sh(w, 'git commit')).toContain('no commit message given');
  });

  it('shows modified files and diffs', () => {
    const w = repoWithCommit();
    sh(w, 'echo "two" >> a.txt');
    expect(sh(w, 'git status')).toMatch(/Changes not staged for commit:[\s\S]*modified:\s+a.txt/);
    expect(sh(w, 'git diff')).toContain('+two');
    expect(sh(w, 'git diff --staged')).toBe('');
    sh(w, 'git add .');
    expect(sh(w, 'git diff --staged')).toContain('+two');
  });

  it('commit -am stages tracked files only', () => {
    const w = repoWithCommit();
    sh(w, 'echo "two" >> a.txt', 'touch new.txt', 'git commit -am "second"');
    const st = getStatus(w.local);
    expect(st.unstaged).toEqual([]);
    expect(st.untracked).toEqual(['new.txt']);
  });

  it('logs history with decorations', () => {
    const w = repoWithCommit();
    sh(w, 'echo "two" >> a.txt', 'git commit -am "second"');
    const lines = sh(w, 'git log --oneline').split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) second$/);
    expect(sh(w, 'git log -1 --oneline').split('\n')).toHaveLength(1);
  });

  it('honors .gitignore', () => {
    const w = repoWithCommit();
    sh(w, 'echo "*.log" > .gitignore', 'touch debug.log', 'git add .');
    expect(Object.keys(w.local.index).sort()).toEqual(['.gitignore', 'a.txt']);
    expect(sh(w, 'git add debug.log')).toContain('ignored by one of your .gitignore files');
  });

  it('chains commands with &&', () => {
    const w = createWorld();
    sh(w, 'git init && echo "x" > f.txt && git add . && git commit -m "one line"');
    expect(headHash(w.local)).toBeTruthy();
  });
});

describe('undo', () => {
  it('restore discards and unstages', () => {
    const w = repoWithCommit();
    sh(w, 'echo "oops" > a.txt', 'git restore a.txt');
    expect(w.local.workdir['a.txt']).toBe('one\n');
    sh(w, 'echo "staged" > a.txt', 'git add .', 'git restore --staged a.txt');
    expect(w.local.index['a.txt']).toBe('one\n');
    expect(w.local.workdir['a.txt']).toBe('staged\n');
  });

  it('reset soft / mixed / hard', () => {
    const w = repoWithCommit();
    const first = headHash(w.local);
    sh(w, 'echo "two" > a.txt', 'git commit -am "second"');
    const second = headHash(w.local)!;
    sh(w, 'git reset --soft HEAD~1');
    expect(headHash(w.local)).toBe(first);
    expect(w.local.index['a.txt']).toBe('two\n');
    sh(w, `git reset --hard ${second.slice(0, 7)}`, 'git reset HEAD~1');
    expect(w.local.index['a.txt']).toBe('one\n');
    expect(w.local.workdir['a.txt']).toBe('two\n');
    expect(sh(w, 'git reset --hard')).toContain('HEAD is now at');
    expect(w.local.workdir['a.txt']).toBe('one\n');
  });

  it('amend replaces the last commit', () => {
    const w = repoWithCommit();
    sh(w, 'git commit --amend -m "better"');
    expect(sh(w, 'git log --oneline').split('\n')).toHaveLength(1);
    expect(sh(w, 'git log --oneline')).toContain('better');
  });

  it('revert creates an inverse commit', () => {
    const w = repoWithCommit();
    sh(w, 'echo "bad" > a.txt', 'git commit -am "bad change"', 'git revert HEAD');
    expect(w.local.workdir['a.txt']).toBe('one\n');
    expect(sh(w, 'git log --oneline').split('\n')[0]).toContain('Revert "bad change"');
  });

  it('reflog lets you recover from a hard reset', () => {
    const w = repoWithCommit();
    sh(w, 'echo "two" > a.txt', 'git commit -am "second"', 'git reset --hard HEAD~1');
    expect(sh(w, 'git reflog')).toContain('HEAD@{1}: commit: second');
    const lost = sh(w, 'git reflog').split('\n')[1].slice(0, 7);
    sh(w, `git reset --hard ${lost}`);
    expect(w.local.workdir['a.txt']).toBe('two\n');
  });
});

describe('branches and merge', () => {
  it('creates, switches and fast-forwards', () => {
    const w = repoWithCommit();
    expect(sh(w, 'git switch -c feature')).toBe("Switched to a new branch 'feature'");
    sh(w, 'echo "f" > f.txt', 'git add .', 'git commit -m "feature work"', 'git checkout main');
    expect('f.txt' in w.local.workdir).toBe(false);
    expect(sh(w, 'git merge feature')).toContain('Fast-forward');
    expect('f.txt' in w.local.workdir).toBe(true);
    expect(sh(w, 'git branch -d feature')).toContain('Deleted branch feature');
  });

  it('makes a merge commit when histories diverge', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "feature"');
    sh(w, 'git switch main', 'echo "m" > m.txt', 'git add .', 'git commit -m "main work"');
    expect(sh(w, 'git merge feature')).toContain("Merge made by the 'ort' strategy.");
    expect(w.local.commits[headHash(w.local)!].parents).toHaveLength(2);
  });

  it('stops on conflicts and concludes with commit', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "feature" > a.txt', 'git commit -am "feature"');
    sh(w, 'git switch main', 'echo "main" > a.txt', 'git commit -am "main"');
    expect(sh(w, 'git merge feature')).toContain('CONFLICT (content): Merge conflict in a.txt');
    expect(w.local.workdir['a.txt']).toBe('<<<<<<< HEAD\nmain\n=======\nfeature\n>>>>>>> feature\n');
    expect(sh(w, 'git status')).toMatch(/You have unmerged paths[\s\S]*both modified:\s+a.txt/);
    expect(sh(w, 'git commit -m "x"')).toContain('unmerged files');
    sh(w, 'echo "both" > a.txt', 'git add a.txt');
    expect(sh(w, 'git status')).toContain('All conflicts fixed but you are still merging.');
    sh(w, 'git commit -m "merge feature"');
    expect(w.local.op).toBeNull();
    expect(w.local.commits[headHash(w.local)!].parents).toHaveLength(2);
  });

  it('merge --abort goes back', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "feature" > a.txt', 'git commit -am "feature"');
    sh(w, 'git switch main', 'echo "main" > a.txt', 'git commit -am "main"', 'git merge feature', 'git merge --abort');
    expect(w.local.workdir['a.txt']).toBe('main\n');
    expect(w.local.op).toBeNull();
  });

  it('refuses to switch when local changes would be lost', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "feature" > a.txt', 'git commit -am "feature"', 'git switch main', 'echo "dirty" > a.txt');
    expect(sh(w, 'git switch feature')).toContain('would be overwritten by checkout');
  });

  it('refuses to delete unmerged branches without -D', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "feature"', 'git switch main');
    expect(sh(w, 'git branch -d feature')).toContain('not fully merged');
    expect(ok(w, 'git branch -D feature')).toBe(true);
  });

  it('detaches HEAD on a commit', () => {
    const w = repoWithCommit();
    sh(w, 'echo "two" > a.txt', 'git commit -am "second"');
    expect(sh(w, 'git checkout HEAD~1')).toContain('detached HEAD');
    expect(sh(w, 'git status')).toContain('HEAD detached at');
  });
});

describe('stash', () => {
  it('saves and restores work in progress', () => {
    const w = repoWithCommit();
    sh(w, 'echo "wip" > a.txt');
    expect(sh(w, 'git stash')).toContain('Saved working directory and index state WIP on main');
    expect(w.local.workdir['a.txt']).toBe('one\n');
    expect(sh(w, 'git stash list')).toContain('stash@{0}: WIP on main');
    sh(w, 'git stash pop');
    expect(w.local.workdir['a.txt']).toBe('wip\n');
    expect(w.local.stash).toHaveLength(0);
  });

  it('keeps the stash when pop conflicts', () => {
    const w = repoWithCommit();
    sh(w, 'echo "wip" > a.txt', 'git stash', 'echo "other" > a.txt', 'git commit -am "other"');
    expect(sh(w, 'git stash pop')).toContain('CONFLICT');
    expect(w.local.stash).toHaveLength(1);
    expect(w.local.workdir['a.txt']).toContain('<<<<<<< Updated upstream');
  });

  it('says so when there is nothing to stash', () => {
    expect(sh(repoWithCommit(), 'git stash')).toBe('No local changes to save');
  });
});

describe('remotes', () => {
  it('clones with tracking', () => {
    const w = cloned();
    expect(w.local.workdir['app.js']).toBe('a\nb\nc\n');
    expect(sh(w, 'git status')).toContain("Your branch is up to date with 'origin/main'.");
    expect(sh(w, 'git remote -v')).toContain(`origin\t${REMOTE_URL} (fetch)`);
  });

  it('pushes and reports ahead counts', () => {
    const w = cloned();
    sh(w, 'echo "x" > x.txt', 'git add .', 'git commit -m "mine"');
    expect(sh(w, 'git status')).toContain("ahead of 'origin/main' by 1 commit");
    const r = exec(w, 'git push');
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.type === 'push')).toBe(true);
    expect(w.remotes[REMOTE_URL].branches.main).toBe(headHash(w.local));
  });

  it('new branches need an upstream', () => {
    const w = cloned();
    sh(w, 'git switch -c feat', 'echo "x" > x.txt', 'git add .', 'git commit -m "feat"');
    expect(sh(w, 'git push')).toContain('has no upstream branch');
    expect(sh(w, 'git push -u origin feat')).toContain("branch 'feat' set up to track 'origin/feat'.");
    expect(ok(w, 'git push')).toBe(true);
  });

  it('rejects a push when a teammate pushed first, then pull merges', () => {
    const w = cloned();
    sh(w, 'echo "x" > x.txt', 'git add .', 'git commit -m "mine"');
    teammateCommit(w, REMOTE_URL, { branch: 'main', author: 'Ana', message: 'theirs', files: { 'y.txt': 'y\n' } });
    expect(sh(w, 'git push')).toMatch(/! \[rejected\]\s+main -> main \(fetch first\)/);
    expect(sh(w, 'git pull')).toContain("Merge made by the 'ort' strategy.");
    expect(ok(w, 'git push')).toBe(true);
  });

  it('pull stops on conflicts with a teammate', () => {
    const w = cloned();
    sh(w, 'echo "a\\nMINE\\nc" > app.js', 'git commit -am "mine"');
    teammateCommit(w, REMOTE_URL, { branch: 'main', author: 'Ana', message: 'theirs', files: { 'app.js': 'a\nTHEIRS\nc\n' } });
    expect(sh(w, 'git pull')).toContain('Automatic merge failed');
    expect(w.local.workdir['app.js']).toBe('a\n<<<<<<< HEAD\nMINE\n=======\nTHEIRS\n>>>>>>> origin/main\nc\n');
  });

  it('fetch only updates remote-tracking refs', () => {
    const w = cloned();
    const before = headHash(w.local);
    teammateCommit(w, REMOTE_URL, { branch: 'main', author: 'Ana', message: 'theirs', files: { 'y.txt': 'y\n' } });
    expect(sh(w, 'git fetch')).toContain('main       -> origin/main');
    expect(headHash(w.local)).toBe(before);
    expect(sh(w, 'git status')).toContain("behind 'origin/main' by 1 commit");
  });

  it('checks out a teammate branch with tracking', () => {
    const w = cloned();
    teammateCommit(w, REMOTE_URL, { branch: 'fix', author: 'Ana', message: 'fix', files: { 'fix.txt': 'f\n' } });
    sh(w, 'git fetch');
    expect(sh(w, 'git switch fix')).toContain("set up to track 'origin/fix'");
    expect('fix.txt' in w.local.workdir).toBe(true);
  });
});

describe('rebase and cherry-pick', () => {
  it('rebases a branch onto main', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "feature"');
    sh(w, 'git switch main', 'echo "m" > m.txt', 'git add .', 'git commit -m "main work"', 'git switch feature');
    expect(sh(w, 'git rebase main')).toContain('Successfully rebased and updated refs/heads/feature.');
    const head = w.local.commits[headHash(w.local)!];
    expect(head.message).toBe('feature');
    expect(head.parents).toEqual([w.local.branches.main]);
    expect(Object.keys(w.local.workdir).sort()).toEqual(['a.txt', 'f.txt', 'm.txt']);
  });

  it('rebase stops on conflict and continues', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "feature" > a.txt', 'git commit -am "feature"');
    sh(w, 'git switch main', 'echo "main" > a.txt', 'git commit -am "main"', 'git switch feature');
    expect(sh(w, 'git rebase main')).toContain('CONFLICT (content)');
    expect(sh(w, 'git status')).toContain('rebase in progress');
    expect(sh(w, 'git rebase --continue')).toContain('unmerged files');
    sh(w, 'echo "resolved" > a.txt', 'git add .');
    expect(sh(w, 'git rebase --continue')).toContain('Successfully rebased');
    expect(w.local.head).toEqual({ type: 'branch', name: 'feature' });
    expect(w.local.workdir['a.txt']).toBe('resolved\n');
  });

  it('rebase --abort restores the branch', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "feature" > a.txt', 'git commit -am "feature"');
    const tip = headHash(w.local);
    sh(w, 'git switch main', 'echo "main" > a.txt', 'git commit -am "main"', 'git switch feature', 'git rebase main', 'git rebase --abort');
    expect(w.local.head).toEqual({ type: 'branch', name: 'feature' });
    expect(headHash(w.local)).toBe(tip);
    expect(w.local.workdir['a.txt']).toBe('feature\n');
  });

  it('pull --rebase replays local commits on top of the remote', () => {
    const w = cloned();
    sh(w, 'echo "x" > x.txt', 'git add .', 'git commit -m "mine"');
    const theirs = teammateCommit(w, REMOTE_URL, { branch: 'main', author: 'Ana', message: 'theirs', files: { 'y.txt': 'y\n' } });
    sh(w, 'git pull --rebase');
    expect(w.local.commits[headHash(w.local)!].parents).toEqual([theirs]);
    expect(ok(w, 'git push')).toBe(true);
  });

  it('cherry-picks a commit from another branch', () => {
    const w = repoWithCommit();
    sh(w, 'git switch -c feature', 'echo "fix" > fix.txt', 'git add .', 'git commit -m "the fix"', 'echo "more" > more.txt', 'git add .', 'git commit -m "more"');
    sh(w, 'git switch main', 'git cherry-pick feature~1');
    expect(Object.keys(w.local.workdir).sort()).toEqual(['a.txt', 'fix.txt']);
    expect(w.local.commits[headHash(w.local)!].message).toBe('the fix');
  });

  it('tags commits', () => {
    const w = repoWithCommit();
    sh(w, 'git tag v1.0');
    expect(sh(w, 'git tag')).toBe('v1.0');
    expect(sh(w, 'git log --oneline')).toContain('tag: v1.0');
  });
});
