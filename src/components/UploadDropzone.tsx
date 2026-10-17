import FolderFloat from './FolderFloat';
import { LoaderCircle, Cloud, FolderOpen } from 'lucide-react';

/** The empty-project drop zone: the folder that opens the file picker, and upload progress once a file is on its way. Drag-and-drop itself is handled by the preview stage around it. */
export interface UploadDropzoneProps {
  isDraggingOver: boolean;
  uploadProgress: number | null;
  input: React.RefObject<HTMLInputElement | null>;
  storageChecking?: boolean;
  driveConnected?: boolean;
  onOpenProjects?: () => void;
}

export function UploadDropzone({ isDraggingOver, uploadProgress, input, storageChecking, driveConnected, onOpenProjects }: UploadDropzoneProps) {
  return (
    <>
              <div
                className={`media-upload-dropzone folder-upload-dropzone ${isDraggingOver ? 'is-dragging' : ''}`}
                // Click anywhere on the zone, as before the folder arrived. Keyboard
                // users get the folder's own button, so this stays a plain div
                // rather than a role=button wrapped around another button.
                onClick={e => { if (uploadProgress === null && !(e.target as HTMLElement).closest('button')) input.current?.click(); }}
              >
                <div className="upload-dropzone-inner">
                  {storageChecking && <p className="drive-connected-note" role="status"><LoaderCircle size={16} className="spin"/> Checking your workspace…</p>}
                  {!storageChecking && driveConnected && <div className="drive-connected-note"><span><Cloud size={16}/> Google Drive connected</span>
                    <button type="button" className="button" onClick={onOpenProjects}><FolderOpen size={16}/> Saved projects</button>
                  </div>}
                  {uploadProgress !== null && <div className="upload-icon-circle">
                      <LoaderCircle size={30} className="spin text-accent" />
                  </div>}
                  <div className="upload-dropzone-text">
                    <h3 className="upload-dropzone-title">
                      {uploadProgress !== null
                        ? `Uploading media… ${uploadProgress}%`
                        : 'Drop a video. Make it yours.'}
                    </h3>
                    {uploadProgress !== null && <p className="upload-dropzone-desc">Bringing your file into the studio…</p>}
                  </div>
                  {uploadProgress !== null ? (
                    <div className="upload-progress-container">
                      <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  ) : (
                    <FolderFloat
                      className="studio-upload-folder"
                      items={['MP4', 'MOV', 'Audio']}
                      label="Upload media"
                      sublabel="Video or audio · Up to 1 GB"
                      folderColor="color-mix(in srgb, var(--color-accent) 78%, var(--color-accent-text))"
                      frontColor="var(--color-accent)"
                      paperColor="color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-panel))"
                      itemColor="var(--color-bg-panel)"
                      itemTextColor="var(--color-text-primary)"
                      labelColor="var(--color-accent-text)"
                      width={190} height={130} spread={110} lift={48}
                      physics={false}
                      onActivate={() => input.current?.click()}
                      onSelect={() => input.current?.click()}
                    />
                  )}
                </div>
              </div>
    </>
  );
}
