import React from 'react';

export interface RulerTick {
  time: number;
  label: string;
  isMajor: boolean;
}

export interface TimelineRulerProps {
  ticks: RulerTick[];
  duration: number;
}

/**
 * Visual time ruler rendered across the top of the multi-track timeline editor.
 * Displays major and minor tick marks with timecode labels synchronized to the project duration.
 */
export function TimelineRuler({ ticks, duration }: TimelineRulerProps) {
  return (
    <div className="timeline-ruler">
      {ticks.map((tick, i) => (
        <div
          key={i}
          className={`timeline-ruler-tick ${tick.isMajor ? 'major' : 'minor'}`}
          style={{ left: `${duration ? (tick.time / duration) * 100 : 0}%` }}
        >
          {tick.isMajor && <span className="tick-label">{tick.label}</span>}
          <span className="tick-line" />
        </div>
      ))}
    </div>
  );
}
