import { ManualColor } from './ManualColor';
import { CaptionFontPicker } from './CaptionFontPicker';
import { PanelHeading } from './PanelHeading';
import { linkedCaptionSize, captionBounds } from '../lib/caption-settings';
import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, ChevronDown, Italic, Link2, Plus, RotateCcw, SlidersHorizontal, Star, Strikethrough, Type, Underline, Unlink, WandSparkles } from 'lucide-react';
import { captionFonts } from '../lib/caption-fonts';
import { templates } from '../lib/captions';
import { MAX_WORDS_PER_PAGE } from '../lib/pages';
import type { SafeAreaSpec, SafeAreaZone } from '../lib/safe-area';
import { treatmentFor } from '../remotion/treatments';
import { defaults, type Settings } from '../lib/types';

/**
 * Everything about how the caption text looks: font, size, weight, casing,
 * spacing, colour, outline and position.
 *
 * It lived as a second tab inside the template picker, which put two unrelated
 * jobs behind one icon — choosing a look, and then adjusting the type of the
 * one you chose. They are separate decisions made at separate moments, so they
 * are now separate panels.
 *
 * The name is reused: a "Text" panel previously placed arbitrary text boxes on
 * the video, a second way of putting words on screen that had nothing to do
 * with captions. That was removed, and the name now means what someone editing
 * captions would expect it to.
 */
export function TextPanel({ settings, updateSettings, busy, notify, isStackedTemplate, safeArea, safeAreaClash }: {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  notify: (message: string) => void;
  isStackedTemplate: boolean;
  safeArea: SafeAreaSpec | null;
  safeAreaClash: SafeAreaZone | null;
}) {
  // What the chosen template would make the highlighted word, so the control
  // starts where the design puts it rather than at some arbitrary default.
  const heroScale = treatmentFor(settings.template).heroScale;
  const linked = settings.linkFontSizes !== false;
  const heroSize = Math.round(settings.heroFontSize ?? settings.fontSize * heroScale);

  /**
   * Change the caption size, carrying the highlighted word if they are linked.
   *
   * With no override the template's proportion already moves the two together,
   * so there is nothing to carry. Once the highlighted word has its own size,
   * the ratio between them is what the creator actually chose — not either
   * number on its own — so that is what is held.
   */
  const setCaptionSize = (next: number) => {
    updateSettings(linkedCaptionSize(settings, next, linked));
  };

  return (
    <section className="style-panel panel text-settings-panel">
      <div className="editor-panel-header"><PanelHeading icon={Type} title="Text" description="Typography, layout, animation and colors." /></div>
      <div className="style-content">
  <>
  <div className="text-typography-section">
    {(['supportingFontFamily', 'heroFontFamily'] as const).map(key => {
      const value = settings[key] ?? settings.fontFamily ?? '';
      const otherKey = key === 'heroFontFamily' ? 'supportingFontFamily' : 'heroFontFamily';
      const emphasized = key === 'heroFontFamily';
      const label = emphasized ? 'Emphasized words' : 'Supporting words';
      return <div className="setting-field text-font-field" key={key}>
        <label>{label}</label>
        <CaptionFontPicker label={`${label} font`} value={value} disabled={busy}
          onChange={family => updateSettings({ [key]: family || undefined,
            [otherKey]: settings[otherKey] ?? settings.fontFamily, fontFamily: undefined })} />
        {value && !captionFonts.find(font => font.family === value)?.devanagari &&
          <p className="field-hint">Hindi characters use Noto Devanagari for this font.</p>}
        {!linked && <>
          <label htmlFor={emphasized ? 'hero-size' : 'caption-size'}>Font size <span>{emphasized ? heroSize : settings.fontSize}px</span></label>
          <input disabled={busy} id={emphasized ? 'hero-size' : 'caption-size'} type="range"
            min={emphasized ? captionBounds.heroFontSize.min : captionBounds.fontSize.min}
            max={emphasized ? captionBounds.heroFontSize.max : captionBounds.fontSize.max}
            value={emphasized ? heroSize : settings.fontSize}
            onChange={event => emphasized
              ? updateSettings({ heroFontSize: Number(event.target.value) })
              : setCaptionSize(Number(event.target.value))} />
        </>}
      </div>;
    })}
    <button type="button" className={`size-link ${linked ? 'is-linked' : ''}`}
      aria-pressed={linked} disabled={busy} onClick={() => updateSettings({ linkFontSizes: !linked })}>
      {linked ? <Link2 size={15} /> : <Unlink size={15} />}
      <span>{linked ? 'Sizes linked · unlink to adjust separately' : 'Link font sizes'}</span>
    </button>
    {linked && <div className="setting-field linked-size-field">
      <label htmlFor="caption-size">Linked font size <span>{settings.fontSize}px / {heroSize}px</span></label>
      <input disabled={busy} id="caption-size" type="range" min={captionBounds.fontSize.min}
        max={captionBounds.fontSize.max} value={settings.fontSize}
        onChange={event => setCaptionSize(Number(event.target.value))} />
      <p className="field-hint">Supporting and emphasized words scale together, keeping their proportions.</p>
    </div>}
  </div>

  <div className="setting-field">
    <label htmlFor="caption-position">Vertical Position <span>{settings.position}%</span></label>
    <input
      disabled={busy}
      id="caption-position"
      type="range"
      min={captionBounds.position.min}
      max={captionBounds.position.max}
      value={settings.position}
      onChange={e => updateSettings({ position: Number(e.target.value) })}
    />
  </div>
  <div className="setting-field">
    <label htmlFor="caption-position-x">Horizontal Position <span>{settings.positionX ?? 50}%</span></label>
    <input
      disabled={busy}
      id="caption-position-x"
      type="range"
      min="15"
      max="85"
      value={settings.positionX ?? 50}
      onChange={e => updateSettings({ positionX: Number(e.target.value) })}
    />
    {/* Five shortcuts, not an axis control. Read as a row they looked like one
        group mixing vertical and horizontal; the label says what they are. */}
    <span className="setting-sublabel">Jump to</span>
    <div className="position-presets">
      {[
        { name: 'Top', x: 50, y: 22 },
        { name: 'Center', x: 50, y: 50 },
        { name: 'Left', x: 25, y: 50 },
        { name: 'Right', x: 75, y: 50 },
        { name: 'Bottom', x: 50, y: 72 },
      ].map(p => (
        <button
          disabled={busy}
          key={p.name}
          type="button"
          onClick={() => updateSettings({ position: p.y, positionX: p.x })}
          className={(settings.position === p.y && (settings.positionX ?? 50) === p.x) ? 'active' : ''}
        >
          {p.name}
        </button>
      ))}
    </div>
  </div>
  {/* Sat between Vertical and Horizontal Position, splitting one idea in two.
      It belongs after them: you place the captions, then check what covers them. */}
  <div className="setting-field">
    {/* This overlay existed and drew itself, but nothing anywhere
        could switch it on — so the one thing that catches a
        caption hidden behind the app's interface was unreachable. */}
    <label htmlFor="safe-area">Platform safe zones</label>
    <div className="segmented-control">
      {([
        { id: 'none', label: 'Off' },
        { id: 'reels', label: 'Reels' },
        { id: 'shorts', label: 'Shorts' },
      ] as const).map(option => (
        <button
          key={option.id}
          type="button"
          disabled={busy}
          className={(settings.safeArea ?? 'none') === option.id ? 'active' : ''}
          aria-pressed={(settings.safeArea ?? 'none') === option.id}
          onClick={() => updateSettings({ safeArea: option.id })}
        >
          {option.label}
        </button>
      ))}
    </div>
    {safeArea && <p className="setting-note">{safeArea.note}</p>}
    {safeAreaClash && (
      <p className="setting-warning">
        At {settings.position}% your captions sit behind &ldquo;{safeAreaClash.label}&rdquo;
        on {safeArea?.name}. Move them out of that strip.
      </p>
    )}
  </div>
  {/* Alignment, outline and backdrop were all read by the
      renderer and settable nowhere — the same gap the safe-area
      overlay had. Nothing here is new behaviour; it is the
      behaviour finally becoming reachable. */}
  <div className="setting-field">
    <label>Style</label>
    <div className="segmented-control">
      {([
        { key: 'bold', icon: <Bold size={14}/>, label: 'Bold', on: !!settings.bold },
        { key: 'italic', icon: <Italic size={14}/>, label: 'Italic', on: !!settings.italic },
        { key: 'underline', icon: <Underline size={14}/>, label: 'Underline', on: !!settings.underline },
        { key: 'strikethrough', icon: <Strikethrough size={14}/>, label: 'Strikethrough', on: !!settings.strikethrough },
      ] as const).map(option => (
        <button
          key={option.key}
          type="button"
          disabled={busy}
          aria-label={option.label}
          aria-pressed={option.on}
          title={option.label}
          className={option.on ? 'active' : ''}
          onClick={() => updateSettings({ [option.key]: !option.on })}
        >
          {option.icon}
        </button>
      ))}
    </div>
  </div>

  <div className="setting-field">
    <label>Capitalisation</label>
    <div className="segmented-control">
      {([
        { id: 'none', label: 'As spoken' },
        { id: 'upper', label: 'AA' },
        { id: 'lower', label: 'aa' },
        { id: 'title', label: 'Aa' },
      ] as const).map(option => (
        <button
          key={option.id}
          type="button"
          disabled={busy}
          title={option.id === 'title' ? 'Capitalise each word' : option.label}
          className={(settings.textCase ?? (settings.uppercase ? 'upper' : 'none')) === option.id ? 'active' : ''}
          onClick={() => updateSettings({ textCase: option.id, uppercase: option.id === 'upper' })}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>

  <div className="setting-field">
    <label htmlFor="line-height">
      Line height <span>{((settings.lineHeight ?? 1) * 100).toFixed(0)}%</span>
    </label>
    <div className="slider-row">
      <input
        disabled={busy}
        id="line-height"
        type="range"
        min="0.7"
        max="1.6"
        step="0.05"
        value={settings.lineHeight ?? 1}
        onChange={e => updateSettings({ lineHeight: Number(e.target.value) })}
      />
      <span className="slider-number-badge">{(settings.lineHeight ?? 1).toFixed(2)}x</span>
    </div>
    <p className="setting-note">
      Relative to the template, so Devanagari keeps the extra room its matras need.
    </p>
  </div>

  <div className="setting-field">
    <label htmlFor="letter-spacing">
      Letter spacing <span>{(settings.letterSpacing ?? 0) > 0 ? '+' : ''}{(settings.letterSpacing ?? 0).toFixed(3)}em</span>
    </label>
    <div className="slider-row">
      <input
        disabled={busy}
        id="letter-spacing"
        type="range"
        min="-0.05"
        max="0.3"
        step="0.005"
        value={settings.letterSpacing ?? 0}
        onChange={e => updateSettings({ letterSpacing: Number(e.target.value) })}
      />
      <span className="slider-number-badge">{(settings.letterSpacing ?? 0).toFixed(3)}</span>
    </div>
  </div>

  <div className="setting-field">
    <label htmlFor="caption-align">Alignment</label>
    <div className="segmented-control">
      {([
        { id: 'left', icon: <AlignLeft size={15}/>, label: 'Left' },
        { id: 'center', icon: <AlignCenter size={15}/>, label: 'Centre' },
        { id: 'right', icon: <AlignRight size={15}/>, label: 'Right' },
      ] as const).map(option => (
        <button
          key={option.id}
          type="button"
          disabled={busy}
          aria-label={option.label}
          title={option.label}
          className={(settings.align ?? 'center') === option.id ? 'active' : ''}
          onClick={() => updateSettings({ align: option.id })}
        >
          {option.icon}
        </button>
      ))}
    </div>
  </div>

  <div className="setting-field">
    <label htmlFor="stroke-width">
      Outline <span>{settings.strokeWidth ? `${settings.strokeWidth}px` : 'none'}</span>
    </label>
    <div className="slider-row">
      <input
        disabled={busy}
        id="stroke-width"
        type="range"
        min="0"
        max="12"
        step="1"
        value={settings.strokeWidth ?? 0}
        onChange={e => updateSettings({ strokeWidth: Number(e.target.value) })}
      />
      <ManualColor label="Outline" value={settings.strokeColor || '#000000'} disabled={busy} notify={notify} onChange={color => updateSettings({ strokeColor: color })} />
    </div>
    <p className="setting-note">
      An outline is what keeps captions readable over a bright or busy shot.
    </p>
  </div>

  <div className="setting-field">
    <label htmlFor="bg-opacity">
      Background <span>{settings.backgroundOpacity ? `${Math.round(settings.backgroundOpacity * 100)}%` : 'off'}</span>
    </label>
    <div className="slider-row">
      <input
        disabled={busy}
        id="bg-opacity"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.backgroundOpacity ?? 0}
        onChange={e => updateSettings({ backgroundOpacity: Number(e.target.value) })}
      />
      <ManualColor label="Caption background" value={settings.backgroundColor || '#000000'} disabled={busy} notify={notify} onChange={color => updateSettings({ backgroundColor: color })} />
    </div>
  </div>

  <div className="setting-field">
    <label htmlFor="words-per-line">Words per line <span>{settings.wordsPerLine}</span></label>
    <div className="slider-row">
      <input
        disabled={busy}
        id="words-per-line"
        type="range"
        min="1"
        max={MAX_WORDS_PER_PAGE}
        value={settings.wordsPerLine}
        onChange={e => updateSettings({ wordsPerLine: Number(e.target.value) })}
      />
      <span className="slider-number-badge">{settings.wordsPerLine} w</span>
    </div>
  </div>
  <div className="setting-field">
    <label htmlFor="motion-strength">Motion</label>
    <div className="segmented-control">
      {[
        { label: 'Off', val: 0 },
        { label: 'Subtle', val: 0.5 },
        { label: 'Natural', val: 1.0 },
        { label: 'Extra', val: 1.5 },
      ].map(m => (
        <button
          type="button"
          key={m.label}
          disabled={busy}
          className={settings.motion === m.val ? 'active' : ''}
          onClick={() => updateSettings({ motion: m.val })}
        >
          {m.label}
        </button>
      ))}
    </div>
  </div>
  {/*
    There was an ALL CAPS toggle here. It wrote only `uppercase`, while the
    Capitalisation control above writes both `uppercase` and `textCase` — and
    the renderer gives `textCase` precedence. So once anyone had touched
    Capitalisation even once, the toggle did nothing while still reporting
    itself as checked. Its label was wrong too: "ALL CAPS" and "Capitalize
    Every Word" are different transforms, and Capitalisation offers both.
  */}
  {/*
    Three colours, three roles. These used to be two pickers that
    both wrote `accent`, while `textColor` had no control at all —
    which is why captions came out all one shade.
  */}
  <div className="accent-section">
    <div className="section-label">Text colour <span>{(settings.textColor || '#ffffff').toUpperCase()}</span></div>
    <div className="swatches">
      {['#ffffff', '#f4f4f5', '#bfa4ff', '#72e6ff', '#d4fa41', '#ff8bb5', '#ffd166', '#111318'].map(color => {
        const isSelected = (settings.textColor || '#ffffff').toLowerCase() === color.toLowerCase();
        return (
          <button
            disabled={busy}
            key={color}
            type="button"
            className={isSelected ? 'selected' : ''}
            style={{ background: color }}
            aria-label={`Text color ${color}`}
            aria-pressed={isSelected}
            onClick={() => updateSettings({ textColor: color })}
          >
            {isSelected && <Check size={16} />}
          </button>
        );
      })}
      <ManualColor label="Supporting text" value={settings.textColor || '#ffffff'} disabled={busy} notify={notify} onChange={color => updateSettings({ textColor: color })} />
    </div>
  </div>
  {isStackedTemplate && (
    <div className="accent-section">
      <div className="section-label">
        Third line <span>{settings.accentSecondary ? settings.accentSecondary.toUpperCase() : 'Same as text'}</span>
      </div>
      <div className="swatches">
        {['#ffd166', '#ff8bb5', '#7ee7c7', '#c9a6ff', '#57c7ff', '#ff825c'].map(color => {
          const isSelected = (settings.accentSecondary || '').toLowerCase() === color.toLowerCase();
          return (
            <button
              disabled={busy}
              key={color}
              type="button"
              className={isSelected ? 'selected' : ''}
              style={{ background: color }}
              aria-label={`Third line color ${color}`}
              aria-pressed={isSelected}
              onClick={() => updateSettings({ accentSecondary: color })}
            >
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
        <ManualColor label="Third line" value={settings.accentSecondary || '#ffd166'} disabled={busy} notify={notify} onChange={color => updateSettings({ accentSecondary: color })} />
        <button
          disabled={busy || !settings.accentSecondary}
          type="button"
          className="swatch-reset"
          title="Match the text colour"
          aria-label="Reset third line to the text colour"
          onClick={() => updateSettings({ accentSecondary: undefined })}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )}
  <div className="accent-section">
    <div className="section-label">Highlight colour <span>{settings.accent.toUpperCase()}</span></div>
    <div className="swatches">
      {['#d4fa41', '#c2a1ff', '#ff8bb5', '#ff825c', '#72e6ff', '#ffffff', '#10b981', '#f59e0b'].map(color => (
        <button
          disabled={busy}
          key={color}
          type="button"
          className={settings.accent === color ? 'selected' : ''}
          style={{ background: color }}
          aria-label={`Highlight ${color}`}
          aria-pressed={settings.accent === color}
          onClick={() => updateSettings({ accent: color })}
        >
          {settings.accent === color && <Check size={16} />}
        </button>
      ))}
      <ManualColor label="Emphasized text" value={settings.accent} disabled={busy} notify={notify} onChange={color => updateSettings({ accent: color })} />
    </div>
  </div>
  <div className="setting-field">
    <label htmlFor="caption-glow-radius">Emphasized glow radius
      <span>{settings.glowRadius === undefined ? 'Preset default' : settings.glowRadius === 0 ? 'Off' : `${settings.glowRadius}px`}</span>
    </label>
    <input id="caption-glow-radius" type="range" disabled={busy} min={0} max={80} step={1}
      value={settings.glowRadius ?? Math.min(80, Math.round(heroSize * (treatmentFor(settings.template).glow ?? 0) * 0.5))}
      onChange={event => updateSettings({ glowRadius: Number(event.target.value) })} />
    <p className="field-hint">Controls the glow spread around the emphasized word. Set to zero to turn it off.</p>
    {settings.glowRadius !== undefined && <button type="button" disabled={busy} className="button tiny secondary"
      onClick={() => updateSettings({ glowRadius: undefined })}>Use preset glow radius</button>}
  </div>
  <button
    disabled={busy}
    type="button"
    className="button secondary full"
    style={{ marginTop: '16px' }}
    onClick={() => {
      const tmpl = templates.find(t => t.id === settings.template);
      updateSettings({
        ...defaults,
        template: settings.template,
        accent: tmpl?.accent ?? defaults.accent,
        textColor: undefined,
        accentSecondary: undefined,
        fontFamily: undefined,
        heroFontFamily: undefined,
        supportingFontFamily: undefined,
        glowRadius: undefined,
        heroFontSize: undefined,
        linkFontSizes: true,
      });
      notify('Reset to template defaults.');
    }}
  >
    <RotateCcw size={15} /> Reset to Defaults
  </button>
</>
      </div>
    </section>
  );
}
