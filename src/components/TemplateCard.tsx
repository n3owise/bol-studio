import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { Check } from 'lucide-react';
import { templates } from '../lib/captions';
import { defaults, type Settings, type Word } from '../lib/types';
import { CaptionTrack } from '../remotion/CaptionTrack';
import { treatmentFor } from '../remotion/treatments';

// A picker can have one hovered card and another focused card. Share the active
// id so only one tiny video runs, rather than animating every visible preset.
let activePreview: string | null = null;
const previewListeners = new Set<() => void>();
const subscribePreview = (listener: () => void) => {
  previewListeners.add(listener);
  return () => { previewListeners.delete(listener); };
};
function activatePreview(id: string | null) {
  if (activePreview === id) return;
  activePreview = id;
  previewListeners.forEach(listener => listener());
}
function stopPreview(id: string) {
  if (activePreview === id) activatePreview(null);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** The picker renders the same composition as the video preview and export.
 * A settled frame avoids capturing a wipe, flip or entrance halfway through.
 * The neutral video background keeps white caption text legible in both themes.
 */
export function TemplatePreview({ id, thirdLine, settings, playing = false }: {
  id: string;
  playing?: boolean;
  thirdLine?: string;
  settings?: Settings;
}) {
  const inputProps = useMemo(() => {
    const template = templates.find(candidate => candidate.id === id);
    const resolved: Settings = {
      ...defaults,
      ...settings,
      template: id,
      // Picker cards demonstrate the style independently of canvas placement.
      position: 50,
      positionX: 50,
      safeArea: 'none',
      accent: settings?.template === id ? settings.accent : template?.accent ?? defaults.accent,
      accentSecondary: thirdLine ?? settings?.accentSecondary,
    };
    const treatment = treatmentFor(id);
    const sample = treatment.layout === 'single' && !treatment.groupText
      ? ['HERO']
      : id === 'mogrt-triple' ? ['creative', 'caption', 'presets']
      : id.startsWith('mogrt-') ? ['ab', template?.name ?? 'Hero', 'aaya'] : ['ab', 'HERO', 'aaya'];
    const words: Word[] = sample.map((text, index) => ({
      id: `preview-${index}`,
      text,
      original: text,
      start: index * 0.1,
      end: index === sample.length - 1 ? 2.5 : (index + 1) * 0.1,
      confidence: 1,
      emphasis: false,
      emphasisScore: index === 1 || sample.length === 1 ? 0.95 : 0.1,
    }));
    return { words, settings: resolved, background: '#181b22' };
  }, [id, settings, thirdLine]);

  if (playing) return <Player
    component={CaptionTrack}
    inputProps={inputProps}
    durationInFrames={180}
    compositionWidth={720}
    compositionHeight={465}
    fps={60}
    autoPlay
    loop
    controls={false}
    initiallyMuted
    clickToPlay={false}
    doubleClickToFullscreen={false}
    spaceKeyToPlayOrPause={false}
    allowFullscreen={false}
    browserMediaControlsBehavior={{ mode: 'do-nothing' }}
    numberOfSharedAudioTags={0}
    style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    aria-hidden
  />;

  return <Thumbnail
    component={CaptionTrack}
    inputProps={inputProps}
    frameToDisplay={60}
    durationInFrames={180}
    compositionWidth={720}
    compositionHeight={465}
    fps={60}
    style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    aria-hidden
  />;
}

export function TemplateCard({ template, selected, onClick, disabled = false, thirdLine, settings }: {
  template: typeof templates[number];
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  thirdLine?: string;
  settings?: Settings;
}) {
  const activeId = useSyncExternalStore(subscribePreview, () => activePreview, () => null);
  const reducedMotion = useReducedMotion();
  useEffect(() => () => stopPreview(template.id), [template.id]);
  const playing = activeId === template.id && !disabled && !reducedMotion && (settings?.motion ?? defaults.motion) > 0;

  return <button
    onMouseEnter={() => { if (!disabled) activatePreview(template.id); }}
    onMouseLeave={() => stopPreview(template.id)}
    onFocus={() => { if (!disabled) activatePreview(template.id); }}
    onBlur={() => stopPreview(template.id)}
    className={`template-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected} disabled={disabled}>
    <div className="template-art template-rendered-art" aria-hidden="true">
      <TemplatePreview id={template.id} thirdLine={thirdLine} settings={settings} playing={playing}/>
      {selected && <span className="template-tick"><Check size={18} strokeWidth={3}/></span>}
    </div>
    <div className="template-label"><span>{template.name}</span><small>{selected ? 'Selected' : template.tag.split(' · ')[1]}</small></div>
  </button>;
}
