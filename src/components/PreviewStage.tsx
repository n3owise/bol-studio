import { canvasKeyboardChange, isBrowserZoomKey } from '../lib/frontend-reliability';
import { assetMediaPath } from '../lib/media-credentials';
import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Move, AudioLines, LoaderCircle, Minus, RotateCcw, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { mediaUrl, discardLocalMedia } from '../lib/api';
import { Player, type PlayerRef } from '@remotion/player';
import { CaptionTrack } from '../remotion/CaptionTrack';
import { CAPTION_FPS } from '../remotion/Root';
import { CAPTION_ANCHORS_X, CAPTION_ANCHORS_Y, snapToAnchor } from '../lib/caption-anchors';
import type { CanvasVisualElement, MediaAsset, Project, Settings, Word } from '../lib/types';
import type { SafeAreaSpec } from '../lib/safe-area';
import type { CaptionPage } from '../lib/pages';

/** The preview canvas: media element, Remotion caption player, keyed-media canvas, safe-area and snap guides, and the draggable canvas overlays. Pure view; every value and handler comes from Studio. */
export interface PreviewStageProps {
  preview: React.RefObject<HTMLDivElement | null>;
  hasVideoLayer: boolean;
  videoEnabled: boolean;
  size: { width: number; height: number; };
  media: React.RefObject<HTMLVideoElement | null>;
  togglePlay: () => void;
  setPreviewHover: (value: React.SetStateAction<boolean>) => void;
  draggingCaption: boolean;
  project: Project;
  activeMediaAsset: MediaAsset | null;
  busy: boolean;
  muted: boolean;
  mediaResumeRef: React.RefObject<{ projectId: string; assetId: string; time: number; playing: boolean; } | null>;
  playbackRate: number;
  notify: (message: string) => void;
  setPlaying: (value: React.SetStateAction<boolean>) => void;
  setTime: (value: React.SetStateAction<number>) => void;
  captionPlayer: React.RefObject<PlayerRef | null>;
  words: Word[];
  settings: Settings;
  duration: number;
  previewHover: boolean;
  activePage: CaptionPage;
  setDraggingCaption: (value: React.SetStateAction<boolean>) => void;
  setCaptionSnap: (value: React.SetStateAction<{ x: number | null; y: number | null; }>) => void;
  setCaptionPosition: (x: number, y: number) => void;
  captionSnap: { x: number | null; y: number | null; };
  updateSettings: (update: Partial<Settings>) => void;
  thisLineOnly: boolean;
  setThisLineOnly: (value: React.SetStateAction<boolean>) => void;
  projectRef: React.RefObject<Project | null>;
  markEdit: (next: Project, record?: boolean) => void;
  canvas: React.RefObject<HTMLCanvasElement | null>;
  safeArea: SafeAreaSpec | null;
  selectedCanvasElementId: string | null;
  handleDeleteCanvasElement: (id: string) => void;
  setSelectedCanvasElementId: (value: React.SetStateAction<string | null>) => void;
  snapGuideX: boolean;
  snapGuideY: boolean;
  canvasElements: CanvasVisualElement[];
  time: number;
  handleUpdateCanvasElement: (id: string, updates: Partial<CanvasVisualElement>) => void;
  handleStartDragCanvasElement: (e: React.MouseEvent, id: string) => void;
  handleStartResizeCanvasElement: (e: React.MouseEvent, id: string, handle: string) => void;
  setGreenScreenTargetEl: (value: React.SetStateAction<CanvasVisualElement | null>) => void;
  isDraggingOver: boolean;
}

export function PreviewStage({ preview, hasVideoLayer, videoEnabled, size, media, togglePlay, setPreviewHover, draggingCaption, project, activeMediaAsset, busy, muted, mediaResumeRef, playbackRate, notify, setPlaying, setTime, captionPlayer, words, settings, duration, previewHover, activePage, setDraggingCaption, setCaptionSnap, setCaptionPosition, captionSnap, updateSettings, thisLineOnly, setThisLineOnly, projectRef, markEdit, canvas, safeArea, selectedCanvasElementId, handleDeleteCanvasElement, setSelectedCanvasElementId, snapGuideX, snapGuideY, canvasElements, time, handleUpdateCanvasElement, handleStartDragCanvasElement, handleStartResizeCanvasElement, setGreenScreenTargetEl, isDraggingOver }: PreviewStageProps) {
  return (
    <>
              <div
                ref={preview}
                className={`video-frame ${hasVideoLayer && !videoEnabled ? 'video-removed' : ''}`}
                style={{ '--preview-ratio': size.width / size.height, aspectRatio: `${size.width}/${size.height}`, cursor: 'pointer' } as React.CSSProperties}
                onClick={e => {
                  if (e.target === preview.current || e.target === media.current) {
                    togglePlay();
                  }
                }}
                onMouseEnter={() => setPreviewHover(true)}
                onMouseLeave={() => { if (!draggingCaption) setPreviewHover(false); }}
              >
                <video
                  ref={media}
                  className={`${project.mediaType === 'audio' || (hasVideoLayer && !videoEnabled) ? 'audio-media' : ''} ${(activeMediaAsset ? activeMediaAsset.greenScreen : project.greenScreen)?.enabled ? 'video-keyed' : ''}`}
                  key={`${project.id}-${project.cloudAudioOnly ? 'uploading' : 'original'}-${busy ? 'processing' : 'ready'}-${videoEnabled ? 'video' : 'audio'}-${activeMediaAsset?.id || 'primary'}`}
                  src={busy ? undefined : (mediaUrl(assetMediaPath(project.id, activeMediaAsset?.id ?? 'primary')) || undefined)}
                  playsInline
                  preload="metadata"
                  muted={muted}
                  onLoadedMetadata={() => {
                    const resume = mediaResumeRef.current, element = media.current;
                    if (!resume || !element) return;
                    mediaResumeRef.current = null;
                    if (resume.projectId !== project.id || resume.assetId !== (project.activeMediaAssetId ?? 'primary')) return;
                    element.currentTime = Math.min(resume.time, element.duration || resume.time);
                    element.playbackRate = playbackRate;
                    if (resume.playing) void element.play().catch(() => notify('Media access refreshed. Press play to continue.'));
                  }}
                  onPlay={() => {
                    if (media.current) media.current.playbackRate = playbackRate;
                    setPlaying(true);
                  }}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onSeeked={() => setTime(media.current?.currentTime ?? 0)}
                  onError={() => {
                    if (!activeMediaAsset && discardLocalMedia(project.id)) {
                      if (project.cloudAudioOnly) { notify('This format needs a prepared preview. It will be available once the original finishes uploading.'); return; }
                      const fallback = mediaUrl(assetMediaPath(project.id, 'primary'));
                      if (media.current && fallback) { media.current.src = fallback; media.current.load(); return; }
                    }
                    notify('The preview could not load. The file may still be processing.');
                  }}
                />
                {project.mediaType === 'audio' && (
                  <div className="audio-backdrop">
                    <AudioLines size={48} />
                    <span>AUDIO PROJECT</span>
                  </div>
                )}
                <Player
                  ref={captionPlayer}
                  component={CaptionTrack}
                  inputProps={{ words, settings, background: 'transparent' }}
                  durationInFrames={Math.max(1, Math.round((duration || 1) * CAPTION_FPS))}
                  fps={CAPTION_FPS}
                  compositionWidth={size.width}
                  compositionHeight={size.height}
                  controls={false}
                  clickToPlay={false}
                  doubleClickToFullscreen={false}
                  spaceKeyToPlayOrPause={false}
                  acknowledgeRemotionLicense
                  className="caption-player"
                  // Remotion sets `position: relative` as an inline style on the
                  // player container, which beats any stylesheet rule — the layer
                  // ended up in normal flow below the video and was clipped away
                  // by the frame's overflow. Positioning has to be inline too.
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
                {/* Nothing until the pointer is here: the preview is for judging
                    the result, and controls parked over it permanently become
                    part of what you are judging. */}
                {previewHover && !busy && project.words.length > 0 && (
                  <div className="caption-move-overlay">
                    <div
                      className={`caption-move-grab ${draggingCaption ? 'is-dragging' : ''}`}
                      style={{
                        left: `${activePage?.words[0]?.posX ?? settings.positionX ?? 50}%`,
                        top: `${activePage?.words[0]?.posY ?? settings.position ?? 70}%`,
                      }}
                      title="Drag to move the captions"
                      onPointerDown={e => {
                        e.preventDefault();
                        const frame = preview.current;
                        if (!frame) return;
                        const rect = frame.getBoundingClientRect();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        // Where inside the handle the pointer came down. Without
                        // this the caption jumped so its anchor sat exactly under
                        // the cursor, which moved it by up to half a handle the
                        // moment it was touched — the caption appeared to reposition
                        // itself on what felt like a hover.
                        const grabX = ((e.clientX - rect.left) / rect.width) * 100
                          - (activePage?.words[0]?.posX ?? settings.positionX ?? 50);
                        const grabY = ((e.clientY - rect.top) / rect.height) * 100
                          - (activePage?.words[0]?.posY ?? settings.position ?? 70);
                        // Nothing moves until the pointer has travelled far enough
                        // to mean it: a click on the handle is a click, not a drag.
                        let dragging = false;
                        // Magnetic snapping to the nine anchors: the caption
                        // tracks the mouse freely and is taken by an anchor only
                        // near one. Alt turns even that off.
                        const move = (ev: MouseEvent) => {
                          if (!dragging) {
                            if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
                            dragging = true;
                            setDraggingCaption(true);
                          }
                          const clamp = (v: number) => Math.max(0, Math.min(100, v));
                          const rawX = clamp(((ev.clientX - rect.left) / rect.width) * 100 - grabX);
                          const rawY = clamp(((ev.clientY - rect.top) / rect.height) * 100 - grabY);
                          if (ev.altKey) {
                            setCaptionSnap({ x: null, y: null });
                            setCaptionPosition(rawX, rawY);
                            return;
                          }
                          const x = snapToAnchor(rawX, CAPTION_ANCHORS_X);
                          const y = snapToAnchor(rawY, CAPTION_ANCHORS_Y);
                          setCaptionSnap({ x: x.anchor, y: y.anchor });
                          setCaptionPosition(x.value, y.value);
                        };
                        const up = () => {
                          setDraggingCaption(false);
                          setCaptionSnap({ x: null, y: null });
                          window.removeEventListener('pointermove', move);
                          window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
                        };
                        window.addEventListener('pointermove', move);
                        window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
                      }}
                    >
                      <Move size={14}/>
                    </div>

                    {/* Why the caption stopped where it did. Only while dragging,
                        and only on the axis an anchor actually has it. */}
                    {draggingCaption && captionSnap.x !== null && (
                      <div className="caption-snap-guide vertical" style={{ left: `${captionSnap.x}%` }} />
                    )}
                    {draggingCaption && captionSnap.y !== null && (
                      <div className="caption-snap-guide horizontal" style={{ top: `${captionSnap.y}%` }} />
                    )}

                    <div className="caption-move-bar" onPointerDown={e => e.stopPropagation()}>
                      <div className="caption-move-row">
                        {/* Text alignment, which is how the lines sit against each
                            other — not where the block sits in the frame. These
                            used to set the horizontal position instead, so the
                            align icons did something the align icons do not mean.
                            Position is the arrows, and the drag. */}
                        {([
                          { align: 'left', icon: <AlignLeft size={14}/>, label: 'Align left' },
                          { align: 'center', icon: <AlignCenter size={14}/>, label: 'Align centre' },
                          { align: 'right', icon: <AlignRight size={14}/>, label: 'Align right' },
                        ] as const).map(option => (
                          <button
                            key={option.label}
                            type="button"
                            title={option.label}
                            aria-label={option.label}
                            aria-pressed={(settings.align ?? 'center') === option.align}
                            className={(settings.align ?? 'center') === option.align ? 'is-active' : ''}
                            onClick={() => updateSettings({ align: option.align })}
                          >
                            {option.icon}
                          </button>
                        ))}
                        <span className="caption-move-divider" />
                        {([
                          { y: CAPTION_ANCHORS_Y[0], icon: <ArrowUp size={14}/>, label: 'Top' },
                          { y: CAPTION_ANCHORS_Y[1], icon: <Minus size={14}/>, label: 'Middle' },
                          { y: CAPTION_ANCHORS_Y[2], icon: <ArrowDown size={14}/>, label: 'Bottom' },
                        ] as const).map(option => (
                          <button
                            key={option.label}
                            type="button"
                            title={option.label}
                            aria-label={`Move to ${option.label.toLowerCase()}`}
                            onClick={() => setCaptionPosition(activePage?.words[0]?.posX ?? settings.positionX ?? 50, option.y)}
                          >
                            {option.icon}
                          </button>
                        ))}
                      </div>

                      <label className="caption-move-scope">
                        <input
                          type="checkbox"
                          checked={thisLineOnly}
                          onChange={e => setThisLineOnly(e.target.checked)}
                        />
                        <span>This line only</span>
                      </label>

                      {project.words.some(w => w.posX !== undefined || w.posY !== undefined) && (
                        <button
                          type="button"
                          className="caption-move-reset"
                          onClick={() => {
                            const p = projectRef.current;
                            if (!p) return;
                            markEdit({ ...p, words: p.words.map(w => ({ ...w, posX: undefined, posY: undefined })) });
                            notify('Every line is back to the project position.');
                          }}
                        >
                          <X size={12}/> Clear line positions
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <canvas
                  ref={canvas}
                  width={size.width}
                  height={size.height}
                  aria-label="Animated caption preview"
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer' }}
                  onClick={togglePlay}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      togglePlay();
                    }
                  }}
                />
                {/* The app's own interface, drawn over the preview so a caption
                    cannot quietly end up behind it. Shaded strips, not one
                    dashed box: the covered regions are different sizes and the
                    bottom one is what actually catches people out. */}
                {safeArea && (
                  <div className="safe-area-overlay" aria-hidden="true">
                    {safeArea.zones.map(zone => (
                      <div
                        key={`${zone.edge}-${zone.label}`}
                        className={`safe-area-zone edge-${zone.edge}`}
                        style={zone.edge === 'right'
                          ? { width: `${zone.size * 100}%` }
                          : { height: `${zone.size * 100}%` }}
                      >
                        <span className="safe-area-zone-label">{zone.label}</span>
                      </div>
                    ))}
                    <div className="safe-area-name">{safeArea.name}</div>
                  </div>
                )}
                {selectedCanvasElementId && (
                  <div className="canvas-element-action-overlay">
                    <button
                      type="button"
                      className="canvas-delete-element-btn"
                      onClick={() => {
                        handleDeleteCanvasElement(selectedCanvasElementId);
                        setSelectedCanvasElementId(null);
                        notify('Removed visual element from canvas');
                      }}
                      title="Remove visual element from canvas"
                      aria-label="Remove visual element from canvas"
                    >
                      <Trash2 size={13} />
                      <span>Remove element</span>
                    </button>
                  </div>
                )}

                {/* Snapping alignment guide lines */}
                {snapGuideX && <div className="canvas-snap-guide vertical" />}
                {snapGuideY && <div className="canvas-snap-guide horizontal" />}


                {/* Interactive Canvas Media Overlays */}
                {canvasElements.map(el => {
                  const isVisible = el.visible !== false && ((el.start === undefined || time >= el.start) && (el.end === undefined || time <= el.end) || selectedCanvasElementId === el.id);
                  if (!isVisible) return null;
                  const isSelected = selectedCanvasElementId === el.id;

                  return (
                    <div
                      key={el.id}
                      className={`canvas-media-box-wrapper ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                      role="group"
                      tabIndex={0}
                      aria-label={`${el.name} canvas layer${el.locked ? ', locked' : '. Arrow keys move, plus or minus resizes, brackets rotate.'}`}
                      onFocus={e => { if (e.target === e.currentTarget) setSelectedCanvasElementId(el.id); }}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget || isBrowserZoomKey(e) || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
                        const changes = canvasKeyboardChange(el, e.key, e.shiftKey);
                        if (changes) { e.preventDefault(); e.stopPropagation(); handleUpdateCanvasElement(el.id, changes); }
                        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedCanvasElementId(el.id); }
                      }}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
                        width: `${32 * (el.scale || 1.0)}%`,
                        aspectRatio: '16 / 9',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCanvasElementId(el.id);
                      }}
                      onPointerDown={(e) => {
                        if (el.locked) return;
                        handleStartDragCanvasElement(e, el.id);
                      }}
                    >
                      <div className="canvas-media-hit-target" />

                      {isSelected && (
                        <>
                          <div className="canvas-selection-box media-selection-box" />
                          {!el.locked && (
                            <>
                              <div className="resize-handle handle-nw" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'nw')} />
                              <div className="resize-handle handle-ne" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'ne')} />
                              <div className="resize-handle handle-se" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'se')} />
                              <div className="resize-handle handle-sw" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'sw')} />
                              <div className="resize-handle handle-n" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'n')} />
                              <div className="resize-handle handle-e" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'e')} />
                              <div className="resize-handle handle-s" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 's')} />
                              <div className="resize-handle handle-w" onPointerDown={(e) => handleStartResizeCanvasElement(e, el.id, 'w')} />
                            </>
                          )}

                          {/* Floating Action Toolbar */}
                          <div className="canvas-floating-toolbar media-floating-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="floating-tool-btn with-text"
                              onClick={() => setGreenScreenTargetEl(el)}
                              title="Green Screen / Chroma Key"
                            >
                              <Wand2 size={13} />
                              <span>Green Screen</span>
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className="floating-tool-btn"
                              onClick={() => handleUpdateCanvasElement(el.id, { scale: 1.0 })}
                              title="Reset Size"
                              aria-label="Reset layer size"
                              disabled={el.locked}
                            >
                              <RotateCcw size={13} />
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className="floating-tool-btn danger"
                              onClick={() => handleDeleteCanvasElement(el.id)}
                              title="Remove from Canvas"
                              aria-label="Remove layer from canvas"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {busy && (
                  <div className="preview-processing">
                    <LoaderCircle size={18} className="spin" />
                    Captions are on their way
                  </div>
                )}
                {isDraggingOver && (
                  <div className="stage-drag-overlay stage-drop-target-active">
                    <UploadCloud size={36} color="#2EE368" />
                    <span>Drop media onto canvas</span>
                  </div>
                )}
              </div>
    </>
  );
}
