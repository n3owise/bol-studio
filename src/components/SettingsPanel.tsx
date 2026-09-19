import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, HardDrive, LoaderCircle, LogOut, RotateCcw, Scan, Trash2, Zap } from 'lucide-react';
import { dimensions } from '../lib/captions';
import { copyText, formatBytes, formatMinutes } from '../lib/utils';
import { Modal } from './Modal';
import type { Limits } from '../lib/api';
import type { Health } from '../lib/shell';
import type { Project, Settings } from '../lib/types';

const timecode = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, '0')}:${(Math.max(0, s) % 60).toFixed(1).padStart(4, '0')}`;

/**
 * The things a person opens Settings to find, and could not find anywhere.
 *
 * This was a placeholder reading "This panel is ready for customization" with a
 * button back to Caption, so what went in it had to be chosen rather than
 * moved. The test applied to each candidate was whether it was reachable
 * already: typography, templates, media and the recogniser's options each have
 * a panel of their own, and a second copy here would be two controls to keep in
 * step and one of them eventually rotting.
 *
 * What is here had no home at all. Deleting a project was impossible — the API
 * had no endpoint for it — so uploads accumulated until the disk filled. The
 * storage figure behind /api/limits was fetched and thrown away, and was wrong
 * anyway. The upload and clip-length ceilings were discoverable only by hitting
 * them. Which recogniser is running, and whether ffmpeg is installed, are the
 * first two questions when a transcript comes out empty. The account was a
 * modal hanging off an avatar.
 *
 * Aspect ratio is the one thing here that exists elsewhere too, as the
 * unlabelled select above the preview. That select stays: reframing is
 * something you do while looking at the frame. This is the explained version,
 * which says what pixel size each choice produces. Both write `settings.aspect`
 * through the same `updateSettings`, so neither can quietly stop working while
 * the other keeps going.
 *
 * Nothing here is drawn unless it is wired. There is no theme switch (the
 * navbar has one), no autosave toggle and no remembered export defaults —
 * there is no per-user preference store to put them in, and a localStorage
 * preference would not follow the account this panel promises your work
 * follows. No delete-account button either: it needs a service-role key the
 * browser must never hold, so it could only be a no-op.
 */
export function SettingsPanel({
  project, settings, updateSettings, busy, limits, health, onRefreshLimits,
  accountEmail, accountName, authEnabled, onSignOut, onDeleteProject, onOpenExports, notify,
}: {
  project: Project | null;
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  /** Null until /api/limits answers, and after it fails. */
  limits: Limits | null;
  /** Null when the worker is not responding. */
  health: Health | null;
  /** Re-read the storage and limit figures. Bound to the Try again buttons. */
  onRefreshLimits: () => Promise<void>;
  accountEmail: string;
  accountName: string;
  authEnabled: boolean;
  onSignOut: () => void;
  /** Deletes on the server and clears the editor. Throws so this can say why. */
  onDeleteProject: () => Promise<void>;
  /** Opens the export dialog, so a render can be saved before its project goes. */
  onOpenExports: () => void;
  notify: (message: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // An armed confirmation must not survive the project it was armed for.
  // Opening another one while the dialog was up would otherwise leave a typed
  // name — and a Delete permanently button — pointed at whatever is now open.
  useEffect(() => {
    setConfirmingDelete(false);
    setConfirmText('');
    setDeleting(false);
    setCopiedId(false);
  }, [project?.id]);

  const aspectOptions: { id: Settings['aspect']; label: string; note: string }[] = [
    { id: 'original', label: 'Original', note: 'As shot' },
    { id: '9:16', label: '9:16', note: 'Reels, Shorts' },
    { id: '1:1', label: '1:1', note: 'Feed' },
    { id: '16:9', label: '16:9', note: 'YouTube' },
  ];

  // 1080 rather than the export dialog's current pick: this is the shape of the
  // frame, and quoting one resolution keeps the four options comparable.
  const framed = project
    ? settings.aspect === 'original'
      ? { width: project.width, height: project.height }
      : dimensions(settings, project.width, project.height, 1080)
    : null;

  const overExportLimit = !!project && !!limits?.maxExportSeconds && project.duration > limits.maxExportSeconds;
  /**
   * Whether the worker is inside this project right now, which is the only
   * state the server refuses to delete from.
   *
   * Not `busy`, which also covers queued. A clip is queued the moment it is
   * uploaded, so disabling on `busy` would withhold the button at exactly the
   * moment it is most wanted — the wrong file has just gone up — and would be
   * withholding it for something the server would in fact allow.
   */
  const workerHasIt = !!project && ['processing', 'transcribing', 'extracting'].includes(project.status);
  // A path for the sherpa models, a plain name for the Whisper ones. Only the
  // last segment identifies it, and the rest is this machine's directory layout.
  const modelName = (health?.model ?? '').split('/').filter(Boolean).at(-1) ?? '';

  const projectLabel = project ? (project.name || project.filename) : '';
  /**
   * What has to be typed to arm the delete.
   *
   * A project that has never been renamed can have a blank name, and asking
   * someone to type an empty string is asking for nothing — the brake would be
   * a button that is already enabled. "delete" instead, and the label says so.
   */
  const expectedWord = (project?.name || '').trim() || 'delete';
  const confirmMatches = confirmText.trim().toLowerCase() === expectedWord.toLowerCase();
  const readyExports = project?.exports?.filter(job => job.status === 'ready').length ?? 0;

  const runDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteProject();
      // Only on success. The dialog staying up on a refusal is the point: see
      // the catch.
      setConfirmingDelete(false);
      setConfirmText('');
    } catch (error) {
      // The server refuses while a transcript or an export is still running,
      // and that refusal is the whole answer — it says which job to wait for.
      // The dialog stays open with the name still typed, because making someone
      // type it again is charging them for the server's timing.
      notify((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const retryLimits = () => {
    setRetrying(true);
    void onRefreshLimits().finally(() => setRetrying(false));
  };

  const copyProjectId = () => {
    if (!project) return;
    void copyText(project.id).then(copied => {
      setCopiedId(copied);
      // The id is on screen either way, so the failure message points at it
      // rather than being an apology with nothing behind it.
      notify(copied ? 'Project ID copied.' : 'Copying was blocked — select the ID above instead.');
    });
  };

  /**
   * Shown when /api/limits could not be read, in place of the figures.
   *
   * Never zeroes. A real 0 B account and a failed request have to look
   * different, or the storage section quietly tells someone their uploads are
   * gone every time the worker hiccups.
   */
  const unreadable = (what: string) => (
    <div className="settings-unreadable">
      <p className="setting-note">{what} could not be read from the worker.</p>
      <button type="button" className="button secondary" disabled={retrying} onClick={retryLimits}>
        {retrying ? <LoaderCircle size={14} className="spin" /> : <RotateCcw size={14} />}
        Try again
      </button>
    </div>
  );

  return (
    <section className="style-panel panel">
      <div className="panel-tabs">
        <button className="active">Settings</button>
      </div>

      <div className="style-content">
        <div className="style-intro">
          <div>
            <h2>Settings</h2>
            <p>Your account, framing and limits.</p>
          </div>
          <Scan size={23} />
        </div>

        {/* Absent rather than greyed out when accounts are off, which is the
            local-development default. A disabled Sign out button over a blank
            email is a control that can never do anything. */}
        {authEnabled && accountEmail && (
          <div className="settings-block">
            <div className="section-label"><LogOut size={13} /> Account</div>
            {accountName && <p className="settings-figure">{accountName}</p>}
            <p className="settings-figure small">{accountEmail}</p>
            <p className="setting-note">
              Signed in. Your projects follow this account, on any browser. Changed your mind
              about your password? Sign out and use “Forgot your password?”.
            </p>
            <button type="button" className="button secondary full" onClick={onSignOut}>
              <LogOut size={15} />Sign out
            </button>
          </div>
        )}

        <div className="setting-field">
          <label htmlFor="settings-aspect">
            Frame shape
            <span>{framed ? `${framed.width} × ${framed.height}` : 'No project open'}</span>
          </label>
          <div className="segmented-control" id="settings-aspect">
            {aspectOptions.map(option => (
              <button
                type="button"
                key={option.id}
                disabled={busy || !project}
                title={option.note}
                className={settings.aspect === option.id ? 'active' : ''}
                onClick={() => updateSettings({ aspect: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="setting-note">
            {project
              ? 'Crops the exported frame. Captions keep their position as a percentage, so they stay where you put them.'
              : 'Open a project to change how its frame is cropped.'}
          </p>
        </div>

        <div className="settings-block">
          <div className="section-label"><Download size={13} /> Limits</div>
          {limits ? (
            <dl className="settings-facts">
              <div>
                <dt>Longest export</dt>
                <dd>{limits.maxExportSeconds ? formatMinutes(limits.maxExportSeconds) : 'No limit'}</dd>
              </div>
              <div>
                <dt>Largest upload</dt>
                <dd>{formatBytes(limits.maxUploadBytes)}</dd>
              </div>
              <div>
                <dt>Longest clip</dt>
                <dd>{formatMinutes(limits.maxDurationSeconds)}</dd>
              </div>
            </dl>
          ) : unreadable('Limits')}
          {/* Shown here as well as in the export dialog. This is where someone
              comes to find out why the Export button is refusing them, and
              arriving to a limits list that does not mention their clip is the
              same dead end as having no panel at all. */}
          {overExportLimit && project && (
            <p className="setting-warning">
              This clip runs {formatMinutes(project.duration)}, past the export limit. Download
              the SRT from the export dialog and burn it in your own editor, or run Bol locally
              for the full length.
            </p>
          )}
        </div>

        <div className="settings-block">
          <div className="section-label"><Zap size={13} /> Worker</div>
          <dl className="settings-facts">
            <div>
              <dt>Connection</dt>
              <dd className={health ? '' : 'settings-bad'}>{health ? 'Connected' : 'Not responding'}</dd>
            </div>
            {/* Omitted rather than blanked while the worker is silent. A
                Recogniser row reading "Unknown" beside a Connection row reading
                "Not responding" invites the reading that the model is the
                problem, when nothing has been asked yet. */}
            {health && (
              <>
                <div>
                  <dt>Recogniser</dt>
                  <dd className={health.available === false ? 'settings-bad' : ''}>
                    {modelName || health.backend || 'Unknown'}
                    {health.available === false ? ' · not installed' : ''}
                  </dd>
                </div>
                <div>
                  <dt>ffmpeg</dt>
                  <dd className={health.ffmpeg ? '' : 'settings-bad'}>
                    {health.ffmpeg ? 'Available' : 'Missing'}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {/* Shown in full and selectable rather than abbreviated behind a copy
              button. A truncated id is no use to anyone reporting a problem,
              and a button is the part of this that can fail — the clipboard
              refuses whenever the document is not focused — so the text has to
              stand on its own. */}
          {project && (
            <div className="settings-id-row">
              <span>Project ID</span>
              <code title="Select to copy">{project.id}</code>
              <button
                type="button"
                className="settings-copy-btn"
                aria-label="Copy the project ID"
                onClick={copyProjectId}
              >
                {copiedId ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          )}
          {/* scripts/prepare-hinglish-model.py is named because it exists —
              checked, not remembered. Copy that quotes a command which was
              renamed or never written sends someone off to run nothing. */}
          {health && health.available === false && (
            <p className="setting-warning">
              Transcription will fail until the speech model is downloaded. Run
              <code> scripts/prepare-hinglish-model.py</code> on the worker, or check its logs.
            </p>
          )}
          {health && !health.ffmpeg && (
            <p className="setting-warning">
              Uploads and exports both need ffmpeg and ffprobe on the worker's PATH.
            </p>
          )}
        </div>

        <div className="settings-block danger">
          <div className="section-label"><Trash2 size={13} /> Delete project</div>
          {project ? (
            <>
              <p className="setting-note">
                Removes <strong>{projectLabel}</strong> and everything uploaded to it — the media,
                the transcript and any exports still on the worker. Exports you have already
                downloaded are yours and are not touched. This cannot be undone.
              </p>
              <button
                type="button"
                className="button secondary full settings-danger-arm"
                disabled={workerHasIt}
                onClick={() => { setConfirmText(''); setConfirmingDelete(true); }}
              >
                <Trash2 size={15} />Delete this project
              </button>
              {workerHasIt && (
                <p className="setting-note">
                  Not while this clip is being transcribed — the worker is still writing to it.
                  It can be deleted as soon as that finishes.
                </p>
              )}
            </>
          ) : (
            <p className="setting-note">Open a project to delete it.</p>
          )}
        </div>
      </div>

      {/*
        A typed name, not a red button.
        Red styling is not a brake — it is a colour, and a second button placed
        where the first one was is pressed by the same reflex that pressed the
        first. MediaPanel's remove dialog is two plain buttons, which is right
        for one asset inside a project you are keeping; this destroys the
        uploaded source with no server-side trash and no undo, which is a
        different weight. So the dialog lists what actually dies, built from
        what is already loaded, and will not enable its button until the project
        has been named by hand.

        No per-project size in that list: /api/limits reports the account total
        only, and a number invented here to fill the gap would be a fabricated
        fact in the one dialog that has to be trusted.
      */}
      {confirmingDelete && project && (
        <Modal title="Delete this project?" onClose={() => { if (!deleting) setConfirmingDelete(false); }}>
          <p className="modal-description">
            <strong>{projectLabel}</strong> and everything uploaded to it will be removed from the
            worker permanently. There is no undo and no trash to recover it from.
          </p>
          <ul className="settings-doomed">
            <li>{project.filename} · {timecode(project.duration)}</li>
            {project.status === 'ready' && <li>{project.words?.length ?? 0} words</li>}
            {readyExports > 0 && (
              <li>{readyExports} finished export{readyExports === 1 ? '' : 's'}</li>
            )}
          </ul>
          {/* The render is the thing people actually mourn, and both the list
              and its download endpoint already exist — so offer the way out
              rather than only warning about it. */}
          {readyExports > 0 && (
            <p className="setting-note">
              Downloaded exports are yours and are not touched — anything still only on the worker
              goes with it.{' '}
              <button type="button" className="link-button" onClick={onOpenExports}>
                Open exports
              </button>
            </p>
          )}
          <label className="settings-confirm-field" htmlFor="settings-delete-confirm">
            Type <strong>{expectedWord}</strong> to confirm
            <input
              id="settings-delete-confirm"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={confirmText}
              disabled={deleting}
              placeholder={expectedWord}
              onChange={event => setConfirmText(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
            <button
              type="button"
              className="button settings-danger-btn"
              disabled={deleting || !confirmMatches}
              onClick={() => void runDelete()}
            >
              {deleting
                ? <><LoaderCircle size={15} className="spin" />Deleting…</>
                : <><Trash2 size={15} />Delete permanently</>}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
