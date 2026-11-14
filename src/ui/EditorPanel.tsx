import { findConflicts, getStatus, headTree } from '../engine';
import { pick, ui } from '../i18n';
import { isManual, useGame } from '../store';
import { CodeEditor } from './CodeEditor';

export function EditorPanel() {
  const lang = useGame((s) => s.lang);
  const level = useGame((s) => s.level!);
  const repo = useGame((s) => s.session!.world.local);
  const openFile = useGame((s) => s.openFile);
  const manual = useGame((s) => isManual(s.level!, s.manualPref));
  const open = useGame((s) => s.open);
  const edit = useGame((s) => s.edit);
  const applyEdit = useGame((s) => s.applyEdit);
  const applyResolution = useGame((s) => s.applyResolution);
  const resolve = useGame((s) => s.resolve);
  const setManual = useGame((s) => s.setManual);

  const files = Object.keys(repo.workdir).sort();
  const st = getStatus(repo);
  const badge = (path: string): [string, string] | null => {
    if (st.unmerged.includes(path)) return ['!', 'conflict'];
    if (st.untracked.includes(path)) return ['U', 'untracked'];
    const staged = st.staged.find((c) => c.path === path);
    const unstaged = st.unstaged.find((c) => c.path === path);
    if (unstaged) return ['M', 'modified'];
    if (staged) return [staged.kind === 'new file' ? 'A' : 'M', 'staged'];
    return null;
  };

  const content = openFile ? repo.workdir[openFile] : undefined;
  const base = openFile && repo.initialized ? headTree(repo)[openFile] : undefined;
  const conflicts = content !== undefined ? findConflicts(content) : [];
  const edits = (level.edits ?? []).map((e, index) => ({ ...e, index })).filter((e) => e.file === openFile);
  const resolution = openFile ? level.resolutions?.[openFile] : undefined;

  return (
    <div className="editor-panel">
      <div className="file-tabs" role="tablist">
        {files.length === 0 && <span className="empty-note">{ui('noFiles', lang)}</span>}
        {files.map((f) => {
          const b = badge(f);
          return (
            <button key={f} type="button" role="tab" aria-selected={f === openFile} className={`file-tab ${f === openFile ? 'active' : ''}`} onClick={() => open(f)}>
              {f}
              {b && <span className={`file-badge badge-${b[1]}`}>{b[0]}</span>}
            </button>
          );
        })}
      </div>

      <label className={`manual-toggle ${manual ? 'on' : ''}`}>
        <input type="checkbox" role="switch" checked={manual} onChange={(e) => setManual(e.target.checked)} />
        <span className="switch" aria-hidden />
        <span className="manual-label">
          <strong>✍ {ui('manualOn', lang)}</strong>
          <span>{ui(manual ? 'manualOnHelp' : 'manualOffHelp', lang)}</span>
        </span>
      </label>

      {edits.map((e) => {
        const applicable = content?.includes(e.find);
        const applied = !applicable && content?.includes(e.replace);
        return (
          <div key={e.index} className={`edit-card ${applied ? 'edit-done' : ''}`}>
            <div>
              <div className="edit-title">
                {applied && '✔ '}
                {ui(manual ? 'toDo' : 'suggestedEdit', lang)}: {pick(e.note, lang)}
              </div>
              <div className="edit-diff">
                <span className="ansi-31">- {e.find.trim()}</span>
                <span className="ansi-32">+ {e.replace.trim()}</span>
              </div>
            </div>
            {!manual && (
              <button type="button" className="btn" disabled={!applicable} onClick={() => applyEdit(e.index)}>
                {applied ? ui('applied', lang) : ui('apply', lang)}
              </button>
            )}
          </div>
        );
      })}

      {openFile &&
        conflicts.length > 0 &&
        (manual ? (
          <div className="edit-card conflict-card">
            <div className="edit-title">⚠ {ui('manualConflict', lang)}</div>
          </div>
        ) : resolution !== undefined ? (
          <div className="edit-card conflict-card">
            <div className="edit-title">⚠ {ui('conflict', lang)}</div>
            <button type="button" className="btn" onClick={() => applyResolution(openFile)}>
              {ui('resolveForMe', lang)}
            </button>
          </div>
        ) : (
          conflicts.map((b, i) => (
            <div key={i} className="edit-card conflict-card">
              <div className="edit-title">
                ⚠ {ui('conflict', lang)} {conflicts.length > 1 ? i + 1 : ''} · L{b.start}–{b.end}
              </div>
              <div className="conflict-actions">
                <button type="button" className="btn btn-ours" onClick={() => resolve(openFile, 'ours', i)}>
                  {ui('acceptOurs', lang)}
                </button>
                <button type="button" className="btn btn-theirs" onClick={() => resolve(openFile, 'theirs', i)}>
                  {ui('acceptTheirs', lang)}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => resolve(openFile, 'both', i)}>
                  {ui('acceptBoth', lang)}
                </button>
              </div>
            </div>
          ))
        ))}

      <div className="editor-body">
        {openFile && content !== undefined ? (
          <CodeEditor path={openFile} value={content} base={base} onChange={(v) => edit(openFile, v)} />
        ) : (
          <div className="empty-note center">{files.length ? ui('noFileOpen', lang) : ''}</div>
        )}
      </div>

      <div className="editor-legend">
        <span><i className="dot dot-added" /> {ui('legendAdded', lang)}</span>
        <span><i className="dot dot-modified" /> {ui('legendModified', lang)}</span>
        <span><i className="dot dot-deleted" /> {ui('legendDeleted', lang)}</span>
      </div>
    </div>
  );
}
