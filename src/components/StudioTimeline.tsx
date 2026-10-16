import { EditorResizeHandle } from './EditorResizeHandle';
import React from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Minus, Pause, Play, Plus, Scissors, Search } from 'lucide-react';
import { TimelineRuler } from './TimelineRuler';
import { timecode } from '../lib/timecode';
import type { CanvasVisualElement, Project, Word } from '../lib/types';

/** The editor timeline: transport bar, waveform, caption cards and word cells. Pure view; every value and handler comes from Studio. */
export interface StudioTimelineProps {
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  editorTimelineHeight: number | null;
  mobileTimelineExpanded: boolean;
  setEditorTimelineHeight: (value: React.SetStateAction<number | null>) => void;
  setMobileTimelineExpanded: (value: React.SetStateAction<boolean>) => void;
  time: number;
  duration: number;
  seek: (value: number) => void;
  project: Project | null;
  playing: boolean;
  togglePlay: () => void;
  playbackRate: number;
  setPlaybackRate: (value: React.SetStateAction<number>) => void;
  handleSplitAtCurrent: () => void;
  timelineZoom: number;
  setTimelineZoom: (value: React.SetStateAction<number>) => void;
  modal: "export" | "projects" | "help" | "search-replace" | "shortcuts" | null;
  setModal: (value: React.SetStateAction<"export" | "projects" | "help" | "search-replace" | "shortcuts" | null>) => void;
  preview: React.RefObject<HTMLDivElement | null>;
  notify: (message: string) => void;
  timelineViewportRef: React.RefObject<HTMLDivElement | null>;
  readTimelineWindow: () => void;
  timelineTrackRef: React.RefObject<HTMLDivElement | null>;
  setIsScrubbing: (value: React.SetStateAction<boolean>) => void;
  handleTimelineTrackClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  setTimelineHover: (value: React.SetStateAction<{ xPct: number; time: number; } | null>) => void;
  rulerTicks: { time: number; label: string; isMajor: boolean; }[];
  timelineHover: { xPct: number; time: number; } | null;
  isScrubbing: boolean;
  canvasElements: CanvasVisualElement[];
  selectedCanvasElementId: string | null;
  setSelectedCanvasElementId: (value: React.SetStateAction<string | null>) => void;
  handleStartDragTimelineMedia: (e: React.MouseEvent, id: string, mode: "move" | "start" | "end") => void;
  visibleTimelineIndices: number[];
  groups: Word[][];
  startGroupTrim: (e: React.MouseEvent, group: Word[], edge: "left" | "right") => void;
  selectedWordIds: Set<string>;
  heroWordIds: Set<string>;
  startWordDrag: (e: React.MouseEvent, word: Word) => void;
  handleWordContextMenu: (e: React.MouseEvent<HTMLElement>, word: Word) => void;
  setSelectedWord: (value: React.SetStateAction<string | null>) => void;
  setTimelinePopover: (value: React.SetStateAction<{ word: Word; rect: DOMRect; draftText: string; emphasis: boolean; spotlight: boolean; behind: boolean; } | null>) => void;
  startWordHandleDrag: (e: React.MouseEvent, word: Word, edge: "left" | "right") => void;
  startWordDividerDrag: (e: React.MouseEvent, wordA: Word, wordB: Word) => void;
  startGroupDrag: (e: React.MouseEvent, group: Word[]) => void;
  handleAddWord: () => void;
}

export function StudioTimeline({ timelineContainerRef, editorTimelineHeight, mobileTimelineExpanded, setEditorTimelineHeight, setMobileTimelineExpanded, time, duration, seek, project, playing, togglePlay, playbackRate, setPlaybackRate, handleSplitAtCurrent, timelineZoom, setTimelineZoom, modal, setModal, preview, notify, timelineViewportRef, readTimelineWindow, timelineTrackRef, setIsScrubbing, handleTimelineTrackClick, setTimelineHover, rulerTicks, timelineHover, isScrubbing, canvasElements, selectedCanvasElementId, setSelectedCanvasElementId, handleStartDragTimelineMedia, visibleTimelineIndices, groups, startGroupTrim, selectedWordIds, heroWordIds, startWordDrag, handleWordContextMenu, setSelectedWord, setTimelinePopover, startWordHandleDrag, startWordDividerDrag, startGroupDrag, handleAddWord }: StudioTimelineProps) {
  return (
    <>
          <div ref={timelineContainerRef} style={editorTimelineHeight === null ? undefined : { '--editor-timeline-height': `${editorTimelineHeight}px` } as React.CSSProperties} className={`timeline-container clean-white ${mobileTimelineExpanded ? "mobile-timeline-expanded" : ""}`}>
            <EditorResizeHandle axis="timeline" value={editorTimelineHeight} onChange={setEditorTimelineHeight} onReset={() => setEditorTimelineHeight(null)} />
            <button className="mobile-timeline-toggle" aria-expanded={mobileTimelineExpanded} onClick={()=>setMobileTimelineExpanded(!mobileTimelineExpanded)}>{mobileTimelineExpanded ? "Hide timeline" : "Edit timeline"}</button>
            {/* Top Control Bar */}
            <div className="timeline-top-bar">
              {/* Left: Timecode Display */}
              <div className="timeline-time-display">
                <span className="time-current">{timecode(time)}</span>
                <span className="time-sep">/</span>
                <span className="time-total">{timecode(duration)}</span>
              </div>

              {/* Center: Transport Controls (< ▶ >) */}
              <div className="timeline-transport">
                <button
                  type="button"
                  className="icon-button tiny transport-nav"
                  aria-label="Back three seconds"
                  onClick={() => seek(time - 3)}
                  disabled={!project}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="timeline-play-btn"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={togglePlay}
                  disabled={!project}
                >
                  {playing ? (
                    <Pause size={17} fill="#ffffff" color="#ffffff" />
                  ) : (
                    <Play size={17} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button tiny transport-nav"
                  aria-label="Forward three seconds"
                  onClick={() => seek(time + 3)}
                  disabled={!project}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="timeline-speed-pill"
                  aria-label={`Playback speed ${playbackRate}x`}
                  title="Playback speed (click to cycle, or Shift + < / >)"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
                    setPlaybackRate(next);
                  }}
                  disabled={!project}
                >
                  {playbackRate}x
                </button>
              </div>

              {/* Right: Tools (Split, Zoom Slider, Search, Fullscreen) */}
              <div className="timeline-actions">
                <button
                  type="button"
                  className="timeline-action-btn"
                  aria-label="Split caption line"
                  title="Split caption line (Cmd+B)"
                  onClick={handleSplitAtCurrent}
                  disabled={!project}
                >
                  <Scissors size={14} />
                  <span>Split</span>
                </button>

                <div className="timeline-zoom-slider-wrap">
                  <button
                    type="button"
                    className="icon-button tiny"
                    aria-label="Zoom out"
                    disabled={!project || timelineZoom <= 1}
                    onClick={() => setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2))))}
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={32}
                    step={0.5}
                    aria-label="Timeline zoom"
                    value={timelineZoom}
                    disabled={!project}
                    onChange={e => setTimelineZoom(Number(e.target.value))}
                    className="timeline-zoom-slider"
                  />
                  <button
                    type="button"
                    className="icon-button tiny"
                    aria-label="Zoom in"
                    disabled={!project || timelineZoom >= 32}
                    onClick={() => setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2))))}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`icon-button tiny ${modal === 'search-replace' ? 'active' : ''}`}
                  aria-label="Search and replace"
                  title="Find & Replace"
                  onClick={() => setModal('search-replace')}
                  disabled={!project}
                >
                  <Search size={15} />
                </button>

                <button
                  type="button"
                  className="icon-button tiny"
                  aria-label="Fullscreen preview"
                  title="Fullscreen preview"
                  onClick={() => void preview.current?.requestFullscreen().catch(() => notify('Fullscreen is unavailable.'))}
                  disabled={!project}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>

            {/* Viewport with Waveform & Clean White Caption Cards */}
            <div ref={timelineViewportRef} className="timeline-viewport" onScroll={readTimelineWindow}>
              <div
                ref={timelineTrackRef}
                className="timeline-track-content"
                style={{
                  width: `${timelineZoom * 100}%`,
                  minWidth: '100%',
                }}
                onPointerDown={(e) => {
                  setIsScrubbing(true);
                  handleTimelineTrackClick(e);
                }}
                onMouseMove={(e) => {
                  if (!timelineTrackRef.current || !duration) return;
                  const rect = timelineTrackRef.current.getBoundingClientRect();
                  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                  const xPct = (relX / rect.width) * 100;
                  const t = (relX / rect.width) * duration;
                  setTimelineHover({ xPct, time: t });
                }}
                onMouseLeave={() => setTimelineHover(null)}
              >
                {/* 1. Light Dynamic Ruler */}
                <TimelineRuler ticks={rulerTicks} duration={duration} />

                {/* Timeline Hover Scrub Guide */}
                {timelineHover && !isScrubbing && (
                  <div
                    className="timeline-hover-indicator"
                    style={{ left: `${timelineHover.xPct}%` }}
                    aria-hidden="true"
                  >
                    <div className="timeline-hover-tooltip">{timecode(timelineHover.time)}</div>
                  </div>
                )}

                {/* 2. Waveform track with green progress bars & dynamic normalization */}
                {project?.waveform?.length ? (() => {
                  const wf = project.waveform;
                  const maxAmp = Math.max(0.08, ...wf);
                  return (
                    <div className="timeline-waveform" aria-hidden="true">
                      {wf.map((v, i) => {
                        const isPlayed = i / wf.length <= (duration ? time / duration : 0);
                        const normalized = Math.min(1, Math.max(0.12, v / maxAmp));
                        const heightPct = Math.pow(normalized, 0.72) * 100;
                        return (
                          <i
                            key={i}
                            className={isPlayed ? 'is-played' : ''}
                            style={{
                              height: `${Math.max(14, heightPct)}%`,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })() : null}

                {/* 2.5. Text Elements Lane */}

                {/* 2.6. Media Elements Lane */}
                {project && duration > 0 && canvasElements.length > 0 && (
                  <div className="timeline-media-lane">
                    {canvasElements.map(el => {
                      const isSelected = selectedCanvasElementId === el.id;
                      const elStart = el.start ?? 0;
                      const elEnd = el.end ?? duration;
                      const leftPct = Math.max(0, Math.min(100, (elStart / duration) * 100));
                      const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((elEnd - elStart) / duration) * 100));

                      return (
                        <div
                          key={el.id}
                          className={`timeline-media-block ${isSelected ? 'selected' : ''} ${el.visible === false ? 'hidden' : ''}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCanvasElementId(el.id);
                            seek(elStart);
                          }}
                          onPointerDown={(e) => handleStartDragTimelineMedia(e, el.id, 'move')}
                          title={`Media: "${el.name}" (${elStart.toFixed(1)}s - ${elEnd.toFixed(1)}s)`}
                        >
                          <div
                            className="timeline-block-handle left"
                            title="Drag to trim start"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineMedia(e, el.id, 'start');
                            }}
                          />
                          <div className="timeline-media-block-content">
                            <ImageIcon size={12} className="timeline-media-icon" />
                            <span className="timeline-media-title">{el.name || 'Media'}</span>
                            <span className="timeline-media-dur">{(elEnd - elStart).toFixed(1)}s</span>
                          </div>
                          <div
                            className="timeline-block-handle right"
                            title="Drag to trim end"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineMedia(e, el.id, 'end');
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Clean White Caption Cards Lane */}
                <div className="timeline-groups-lane">
                  {project && duration > 0 && visibleTimelineIndices.map(gIdx => {
                    const g = groups[gIdx];
                    const gStart = g[0].start;
                    const gEnd = g.at(-1)!.end;
                    const isCurrentGroup = time >= gStart && time <= gEnd;
                    const gDur = Math.max(0.04, gEnd - gStart);
                    const leftPct = (gStart / duration) * 100;
                    const widthPct = (gDur / duration) * 100;

                    return (
                      <div
                        key={g[0].id || gIdx}
                        className={`timeline-group-container white-card ${isCurrentGroup ? 'is-active' : ''}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                        title={`Caption line: "${g.map(w => w.text).join(' ')}"`}
                        onClick={() => seek(gStart)}
                      >
                        {/* Group Left Trim Bracket */}
                        <div
                          className="timeline-group-bracket left"
                          title="Drag to adjust sentence start"
                          onPointerDown={(e) => startGroupTrim(e, g, 'left')}
                        />

                        {/* Words inside this sentence card */}
                        <div className="timeline-group-words">
                          {(widthPct * (timelineViewportRef.current?.scrollWidth ?? 1000) / 100 >= 24 ? g : []).map((w, wIdx) => {
                            const isCurrentWord = time >= w.start && time < w.end;
                            const wDur = Math.max(0.01, w.end - w.start);
                            const wLeftPct = ((w.start - gStart) / gDur) * 100;
                            const wWidthPct = (wDur / gDur) * 100;
                            const isWordSelected = selectedWordIds.has(w.id);

                            return (
                              <React.Fragment key={w.id}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`timeline-word-cell white-cell ${isWordSelected ? 'is-selected' : ''} ${isCurrentWord ? 'is-active' : ''} ${w.spotlight ? 'is-spotlight' : (heroWordIds.has(w.id) ? 'is-emphasized' : '')}`}
                                  style={{
                                    left: `${wLeftPct}%`,
                                    width: `calc(${wWidthPct}% - 1px)`,
                                  }}
                                  title={`${w.text} (${timecode(w.start)} - ${timecode(w.end)})`}
                                  onPointerDown={(e) => startWordDrag(e, w)}
                                  onContextMenu={(e) => handleWordContextMenu(e, w)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedWord(w.id);
                                      seek(w.start);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTimelinePopover({
                                        word: w,
                                        rect,
                                        draftText: w.text,
                                        emphasis: !!w.emphasis,
                                        spotlight: !!w.spotlight,
                                        behind: !!w.behind,
                                      });
                                    }
                                  }}
                                >
                                  {/* Left trim handle */}
                                  <div
                                    className="timeline-word-edge-handle left"
                                    title="Trim word start"
                                    onPointerDown={(e) => startWordHandleDrag(e, w, 'left')}
                                  />

                                  <span className="timeline-word-cell-text">{w.text}</span>
                                  {w.spotlight ? (
                                    <span className="timeline-word-spotlight-badge" title="Highlighted — you chose this word">⚡</span>
                                  ) : heroWordIds.has(w.id) ? (
                                    <span className="timeline-word-star" title="Picked automatically for this line. Click any word to choose a different one.">⚡</span>
                                  ) : null}

                                  {/* Right trim handle */}
                                  <div
                                    className="timeline-word-edge-handle right"
                                    title="Trim word end"
                                    onPointerDown={(e) => startWordHandleDrag(e, w, 'right')}
                                  />
                                </div>

                                {/* Divider handle */}
                                {wIdx < g.length - 1 && (
                                  <div
                                    className="timeline-word-divider"
                                    style={{
                                      left: `${((g[wIdx].end - gStart) / gDur) * 100}%`,
                                    }}
                                    title={`Drag boundary`}
                                    onPointerDown={(e) => startWordDividerDrag(e, w, g[wIdx + 1])}
                                  >
                                    <span className="divider-line" />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* Dedicated Group Bar beneath words */}
                        <div
                          className="timeline-group-bar"
                          title="Drag caption group to shift timing"
                          onPointerDown={(e) => startGroupDrag(e, g)}
                        >
                          <div className="group-bar-track">
                            <span className="group-bar-grip" />
                          </div>
                        </div>

                        {/* Group Right Trim Bracket */}
                        <div
                          className="timeline-group-bracket right"
                          title="Drag to adjust sentence end"
                          onPointerDown={(e) => startGroupTrim(e, g, 'right')}
                        />
                      </div>
                    );
                  })}

                  {/* "+ Add" button at end of line track */}
                  {project && duration > 0 && (() => {
                    const lastW = project.words.length > 0 ? project.words[project.words.length - 1] : null;
                    const addLeftPct = lastW ? (lastW.end / duration) * 100 : 0;
                    return (
                      <button
                        type="button"
                        className="timeline-add-line-btn"
                        style={{ left: `calc(${addLeftPct}% + 10px)` }}
                        title="Add caption"
                        onClick={handleAddWord}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    );
                  })()}
                </div>

                {/* 4. Playhead with Green Line & Triangle Marker */}
                {project && duration > 0 ? (
                  <div
                    className="timeline-playhead green-playhead"
                    style={{ left: `${(time / duration) * 100}%` }}
                  >
                    <div className="playhead-marker" />
                    <div className="playhead-line" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Bottom Shortcut Footer */}
            <div className="timeline-footer-strip">
              <div className="timeline-shortcut-item">
                <kbd>space</kbd>
                <span>play / pause</span>
              </div>
              <div className="timeline-shortcut-right">
                <div className="timeline-shortcut-item">
                  <kbd>↑ ↓</kbd>
                  <span>Zoom timeline</span>
                </div>
                <div className="timeline-shortcut-item">
                  <kbd>cmd + B</kbd>
                  <span>Split</span>
                </div>
              </div>
            </div>
          </div>
    </>
  );
}
