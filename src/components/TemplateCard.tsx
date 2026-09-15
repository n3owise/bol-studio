import React from 'react';
import { Check } from 'lucide-react';
import { getContrastColor, templates } from '../lib/captions';

/**
 * The miniature shown on a template's card in the picker.
 *
 * Every template gets its own wording and shape rather than one sample string
 * in different colours. The cards were interchangeable when they all read the
 * same, which defeats the point of a picker — you could not tell a three-line
 * lockup from a single-word punch without selecting it and watching.
 */
export function TemplatePreview({ id, thirdLine }: { id: string; thirdLine?: string }) {
  if (id === 'kinetic') return <strong>BAWAAL.</strong>;
  if (id === 'editorial') return <span>dil se <b>bolo.</b></span>;
  if (id === 'bounce') return <span>thoda <b>extra</b></span>;
  if (id === 'karaoke') return <span>apni <b>vibe</b> hai.</span>;
  if (id === 'neon') return <span>CHAMKEE-<b>LA</b></span>;
  if (id === 'glow-script') return <span>Jadoo <i>wali</i> <b>baat</b></span>;
  if (id === 'scribble') return <span><b>GOLMAAL</b><small>~ ~ ~</small></span>;
  if (id === 'welcome-stack') return <span>ab <b>HERO</b><small>ki entry</small></span>;
  if (id === 'soft-focus') return <span>Dil ka <i>sukoon</i></span>;
  if (id === 'double-trouble') return <span><b>JODI</b><i>NO. 1</i></span>;
  if (id === 'bubble-highlight') return <span>Apna <b>Tashan</b> dikhao</span>;
  if (id === 'mumbai') return <span><b>BAMBAIYA</b><i>meri jaan</i></span>;
  if (id === 'editing-school') return <span><b>USTAAD</b></span>;
  if (id === 'kalakar-shadow') return <span>Hello <b>KALAKAR</b></span>;
  if (id === 'pop-up') return <span>PATAKHA <b>DHAMAKA</b></span>;
  // Composition 2 is the three-line preset, so its card shows three lines.
  if (id === 'mogrt-triple') {
    return (
      <span className="mogrt-triple-art">
        <i>creative</i>
        <b>caption</b>
        <u style={{ color: thirdLine }}>presets</u>
      </span>
    );
  }
  if (id.startsWith('mogrt-')) return <span>ye <b>SAB</b> kuch</span>;
  return <span>THINK <b>BIGGER.</b></span>;
}

export function TemplateCard({ template, selected, onClick, disabled = false, thirdLine }: {
  template: typeof templates[number];
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  thirdLine?: string;
}) {
  const pillColor = getContrastColor(template.accent);
  return <button className={`template-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected} disabled={disabled}>
    <div className={`template-art art-${template.id}`} style={{ '--card-accent': template.accent, '--pill-text': pillColor } as React.CSSProperties}>
      <TemplatePreview id={template.id} thirdLine={thirdLine}/>
      {selected && <span className="template-tick"><Check size={12}/></span>}
    </div>
    <div className="template-label"><span>{template.name}</span><small>{template.tag.split(' · ')[1]}</small></div>
  </button>;
}
