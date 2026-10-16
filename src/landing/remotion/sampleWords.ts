import type { Word } from '../../lib/types';

/**
 * Timed words for a line of sample Hinglish, spread evenly from `start` over
 * `span` seconds. The word at `hero` is marked as the creator's highlight, so
 * templates built around a hero word have one to promote.
 */
export function sampleLine(id: string, text: string, start: number, span: number, hero = -1): Word[] {
  const parts = text.split(' ');
  const step = span / parts.length;
  return parts.map((part, i) => ({
    id: `${id}-${i}`,
    text: part,
    original: part,
    start: +(start + i * step).toFixed(3),
    end: +(start + (i + 1) * step - 0.04).toFixed(3),
    confidence: 1,
    emphasis: i === hero,
    emphasisScore: i === hero ? 0.95 : 0.3,
    spotlight: i === hero ? true : undefined,
    lineBreak: i === parts.length - 1 ? true : undefined,
  }));
}

/** The lines the hero reel cycles through, one template each. */
export const HERO_SCENES = [
  { template: 'mogrt-rise', name: 'Udaan', text: 'yaar ye captions toh kamaal hai', hero: 4 },
  { template: 'mogrt-pop', name: 'Dhamaka', text: 'ab har reel dikhegi ekdum pro', hero: 5 },
  { template: 'kinetic', name: 'Bawaal', text: 'Hindi English ya Hinglish sab chalega', hero: 3 },
  { template: 'karaoke', name: 'Sur Taal', text: 'bas upload karo aur chill karo', hero: 4 },
] as const;

/** A short line per template for the gallery cards, so each one is seen doing its own thing. */
export const GALLERY_LINES = [
  'aaj ka vlog shuru karte hain',
  'ye trick koi nahi batayega',
  'comment mein batao kaisa laga',
  'subscribe karna mat bhoolna',
  'chalo seedha point pe aate hain',
  'isko last tak zaroor dekhna',
];
