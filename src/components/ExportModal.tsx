import { Check, Download, Layers, LoaderCircle, MonitorPlay } from 'lucide-react';
import { dimensions } from '../lib/captions';
import { Modal } from './Modal';
import type { ExportJob, Project, Settings } from '../lib/types';

/** The export dialog: export type, resolution and frame rate, the run/progress block, and the subtitle and audio downloads. Pure view; every value and handler comes from Studio. */
export interface ExportModalProps {
  setModal: (value: React.SetStateAction<"export" | "projects" | "help" | "search-replace" | "shortcuts" | null>) => void;
  exportMode: "burned" | "green";
  setExportMode: (value: React.SetStateAction<"burned" | "green">) => void;
  project: Project | null;
  settings: Settings;
  resolution: 720 | 1080 | 2160;
  setResolution: (value: React.SetStateAction<720 | 1080 | 2160>) => void;
  exportFps: 24 | 25 | 30 | 50 | 60;
  setExportFps: (value: React.SetStateAction<24 | 25 | 30 | 50 | 60>) => void;
  hasExportRunning: boolean | undefined;
  latestExport: ExportJob | undefined;
  overExportLimit: boolean;
  duration: number;
  maxExportSeconds: number | null;
  startExport: () => Promise<void>;
  driveAvailable: boolean;
  startDriveExport: () => Promise<void>;
  retryDriveExport: () => Promise<void>;
  exportDriveBusy: boolean;
  exporting: boolean;
  lastDownloadedExportId: string | null;
  downloadTranscript: (format: "srt" | "vtt" | "json" | "txt" | "csv") => void;
  downloadAudioTrack: () => Promise<void>;
  copyTranscript: () => void;
}

export function ExportModal({ driveAvailable, startDriveExport, retryDriveExport, exportDriveBusy, setModal, exportMode, setExportMode, project, settings, resolution, setResolution, exportFps, setExportFps, hasExportRunning, latestExport, overExportLimit, duration, maxExportSeconds, startExport, exporting, lastDownloadedExportId, downloadTranscript, downloadAudioTrack, copyTranscript }: ExportModalProps) {
  return (
    <>
      <Modal title="Export video" className="export-modal" onClose={() => setModal(null)} wide>
        <p className="modal-description">
          Choose your format and where to save the finished video.
        </p>

        {/* Step 1: Two Main Sections (Captioned Video vs Green Screen) */}
        <div className="export-section-group">
          <label className="export-section-title">
            <span className="export-step-num">1</span>
            <span>Choose Export Type</span>
          </label>
          <div className="export-type-grid">
            <button
              type="button"
              className={`export-type-card ${exportMode === 'burned' ? 'selected' : ''}`}
              onClick={() => setExportMode('burned')}
            >
              <div className="export-type-icon-box burned">
                <MonitorPlay size={24} />
              </div>
              <div className="export-type-details">
                <div className="export-type-heading">
                  <strong>{project?.mediaType === 'audio' ? 'Caption Video' : 'Captioned Video'}</strong>
                  {exportMode === 'burned' && (
                    <span className="export-badge-active">
                      <Check size={13} /> Selected
                    </span>
                  )}
                </div>
                <span className="export-type-desc">
                  Complete MP4 with original audio, visuals, and burned-in animated captions.
                </span>
              </div>
            </button>

            <button
              type="button"
              className={`export-type-card ${exportMode === 'green' ? 'selected' : ''}`}
              onClick={() => setExportMode('green')}
            >
              <div className="export-type-icon-box green">
                <Layers size={24} />
              </div>
              <div className="export-type-details">
                <div className="export-type-heading">
                  <strong>Green Screen</strong>
                  {exportMode === 'green' && (
                    <span className="export-badge-active">
                      <Check size={13} /> Selected
                    </span>
                  )}
                </div>
                <span className="export-type-desc">
                  Chroma-key backdrop (#00FF00) for Premiere, Final Cut Pro, DaVinci & CapCut.
                </span>
              </div>
            </button>
          </div>
        </div>

        {exportMode === 'green' && (
          <p className="export-note">
            💡 <strong>Pro-Tip:</strong> Key out pure green (#00FF00) in your video editor. Pick an accent color other than green in Settings for clean chroma keying.
          </p>
        )}

        {/* Step 2: Resolution Selection */}
        <div className="export-section-group">
          <div className="export-section-header-row">
            <label className="export-section-title">
              <span className="export-step-num">2</span>
              <span>Resolution</span>
            </label>
            <span className="export-detail-pill">
              {project ? `${dimensions(settings, project.width, project.height, resolution).width} × ${dimensions(settings, project.width, project.height, resolution).height} px` : ''}
            </span>
          </div>
          <div className="export-option-pills">
            <button
              type="button"
              className={`export-option-pill ${resolution === 720 ? 'selected' : ''}`}
              onClick={() => setResolution(720)}
            >
              <strong>720p</strong>
              <span>Fast Export</span>
            </button>
            <button
              type="button"
              className={`export-option-pill ${resolution === 1080 ? 'selected' : ''}`}
              onClick={() => setResolution(1080)}
            >
              <strong>1080p</strong>
              <span>Full HD</span>
            </button>
            <button
              type="button"
              className={`export-option-pill ${resolution === 2160 ? 'selected' : ''}`}
              onClick={() => setResolution(2160)}
            >
              <strong>4K</strong>
              <span>Ultra HD (2160p)</span>
            </button>
          </div>
        </div>

        {/* Step 3: Frame Rate Selection */}
        <div className="export-section-group">
          <div className="export-section-header-row">
            <label className="export-section-title">
              <span className="export-step-num">3</span>
              <span>Frame Rate</span>
            </label>
            <span className="export-detail-pill">
              {exportFps === 24 ? '24 fps · Cinematic' : exportFps === 25 ? '25 fps · PAL / Film' : exportFps === 30 ? '30 fps · Standard' : exportFps === 50 ? '50 fps · PAL High' : '60 fps · Smooth'}
            </span>
          </div>
          <div className="export-fps-pills">
            {([24, 25, 30, 50, 60] as const).map(fpsOption => (
              <button
                key={fpsOption}
                type="button"
                className={`export-fps-pill ${exportFps === fpsOption ? 'selected' : ''}`}
                onClick={() => setExportFps(fpsOption)}
              >
                <strong>{fpsOption}</strong>
                <span>fps</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live details summary */}
        <div className="export-summary-bar">
          <span>H.264 MP4</span>
          <span>{resolution === 2160 ? '4K Ultra HD' : `${resolution}p`}</span>
          <span>{exportFps} FPS</span>
          <span>{project ? `${dimensions(settings, project.width, project.height, resolution).width}×${dimensions(settings, project.width, project.height, resolution).height}` : ''}</span>
          <span>No watermark</span>
        </div>

        {/* Step 4: Export & Auto-Download Execution */}
        {hasExportRunning ? (
          <div className="export-progress-card">
            <div className="export-progress-top">
              <div className="export-progress-status">
                <LoaderCircle size={18} className="spin" />
                <span>{latestExport?.message || 'Rendering video frames…'}</span>
              </div>
              <strong className="export-progress-percent">{latestExport?.progress ?? 0}%</strong>
            </div>
            <div className="export-progress-track">
              <div
                className="export-progress-fill"
                style={{ width: `${Math.max(4, latestExport?.progress ?? 0)}%` }}
              />
            </div>
            <p className="export-auto-download-hint">
              Your video will be downloaded or saved to Drive after rendering, based on the option you selected.
            </p>
          </div>
        ) : (
          <div className="export-action-block">
            {overExportLimit && (
              <p className="export-limit-note">
                This clip is {Math.floor(duration / 60)}m {Math.round(duration % 60)}s, and rendering
                here is capped at {Math.round((maxExportSeconds ?? 0) / 60)} minutes so exports stay
                quick for everyone. Download the SRT and burn it in your editor, or run Bol locally
                for the full length.
              </p>
            )}
            {driveAvailable && <button className="button full" disabled={exporting || exportDriveBusy || !project?.words.length || overExportLimit} onClick={() => void startDriveExport()}>Render &amp; save to Google Drive</button>}
            {driveAvailable && latestExport && ['ready', 'complete'].includes(latestExport.status) && <button className="button full" disabled={exportDriveBusy} onClick={() => void retryDriveExport()}>{exportDriveBusy ? 'Saving to Drive…' : 'Save last export to Drive'}</button>}
            <button
              className="button primary full export-submit-btn"
              onClick={() => void startExport()}
              disabled={exporting || !project?.words.length || overExportLimit}
            >
              {exporting ? (
                <>
                  <LoaderCircle size={18} className="spin" />
                  <span>Preparing render…</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export & Download {exportMode === 'green' ? 'Green Screen' : 'Video'}</span>
                </>
              )}
            </button>

            {lastDownloadedExportId && (
              <div className="export-download-success">
                <Check size={16} />
                <span>Download started! Check your browser's download folder.</span>
              </div>
            )}
          </div>
        )}

        {latestExport?.status === 'error' && (
          <p className="error-message export-error-alert">{latestExport.message}</p>
        )}

        <div className="subtitle-downloads">
          <span>Need text subtitles or audio?</span>
          <div>
            <button type="button" onClick={() => downloadTranscript('srt')}>.SRT</button>
            <button type="button" onClick={() => downloadTranscript('vtt')}>.VTT</button>
            <button type="button" onClick={() => downloadTranscript('txt')}>.TXT</button>
            <button type="button" onClick={() => downloadTranscript('json')}>Timings .JSON</button>
            <button type="button" onClick={() => downloadTranscript('csv')}>Spreadsheet .CSV</button>
            <button type="button" onClick={downloadAudioTrack} title="Download dialogue audio (.m4a)">Audio .M4A</button>
            <button type="button" onClick={copyTranscript} title="Copy plain text to clipboard">Copy Text</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
