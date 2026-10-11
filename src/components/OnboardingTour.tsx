import { useDialogFocus } from './useDialogFocus';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Sparkles, Film, SlidersHorizontal, Layers } from 'lucide-react';

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  tip: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: 'Step 1 of 3 · The Stage',
    title: 'Visual Stage & 9 Caption Anchors',
    icon: <Film size={24} color="#10b981" />,
    description:
      'Drag and drop captions directly on the video to snap to 9 clean positions. Add pictures or green-screen media clips from the Media panel and layer them on your stage.',
    tip: '💡 Use Safe Area guides in Settings to check caption placement against approximate platform overlays. Review the exported video on your target platform.',
  },
  {
    badge: 'Step 2 of 3 · Styling',
    title: 'Templates, Fonts & Hinglish Highlight',
    icon: <Sparkles size={24} color="#10b981" />,
    description:
      'Choose from 18+ cinematic and social templates. Filter by Single-line or Multi-row Stack, tweak fonts, accent colors, and acoustic spotlight words.',
    tip: '💡 Click any word in the transcript to toggle emphasis, recase words, or nudge timing.',
  },
  {
    badge: 'Step 3 of 3 · Timeline',
    title: 'Precision Timeline & NLE Controls',
    icon: <SlidersHorizontal size={24} color="#10b981" />,
    description:
      'Hover over the waveform to see exact timecode guides. Adjust playback speed from 0.5x to 2x, split sentences at playhead, and use J/K/L shuttle controls.',
    tip: '💡 Press "?" anytime to open the full keyboard shortcut cheat sheet.',
  },
];

export function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const dialogRef = useDialogFocus(isOpen, onClose);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && step < TOUR_STEPS.length - 1) {
        setStep(s => s + 1);
      } else if (e.key === 'ArrowLeft' && step > 0) {
        setStep(s => s - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="tour-overlay" onClick={onClose}>
      <div
        className="tour-card"
        onClick={e => e.stopPropagation()}
        ref={dialogRef} role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        <button
          type="button"
          className="tour-close-btn"
          onClick={onClose}
          aria-label="Close tour"
        >
          <X size={16} />
        </button>

        <div className="tour-badge">{current.badge}</div>

        <div className="tour-header">
          <div className="tour-icon-box">{current.icon}</div>
          <h2 id="tour-step-title" className="tour-title">{current.title}</h2>
        </div>

        <p className="tour-desc">{current.description}</p>

        <div className="tour-tip">{current.tip}</div>

        <div className="tour-footer">
          <div className="tour-dots">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`tour-dot ${i === step ? 'active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === step ? 'step' : undefined}
              />
            ))}
          </div>

          <div className="tour-actions">
            {step > 0 && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setStep(s => s - 1)}
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <button
              type="button"
              className="button primary"
              onClick={() => {
                if (isLast) onClose();
                else setStep(s => s + 1);
              }}
            >
              {isLast ? (
                <>
                  <Check size={15} /> Get Started
                </>
              ) : (
                <>
                  Next <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
