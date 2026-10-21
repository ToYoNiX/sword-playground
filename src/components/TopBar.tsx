import { PRESETS } from '../model/presets.ts';
import { addMinutes, formatDateTime, fromLocalInput, realNow, toLocalInput } from '../model/time.ts';
import type { Playground } from '../usePlayground.ts';

export type View = 'day' | 'week';

interface Props {
  playground: Playground;
  timeZone: string;
  view: View;
  onView: (view: View) => void;
  dayLabel: string | null;
  onDayStep: ((step: number) => void) | null;
}

const STEPS: [string, number][] = [
  ['−1d', -1440],
  ['−1h', -60],
  ['+15m', 15],
  ['+1h', 60],
  ['+1d', 1440],
];

export function TopBar({ playground, timeZone, view, onView, dayLabel, onDayStep }: Props) {
  const { state, setNow } = playground;
  return (
    <header className="topbar">
      <strong className="brand">⚔ Sword playground</strong>
      <select
        value=""
        onChange={(e) => {
          const preset = PRESETS.find((p) => p.name === e.target.value);
          if (preset && confirm(`Load "${preset.name}"? This replaces the document.`)) playground.loadPreset(preset);
        }}
      >
        <option value="">Load preset…</option>
        {PRESETS.map((p) => (
          <option key={p.name}>{p.name}</option>
        ))}
      </select>

      <div className="now-control" title={`Now, in ${timeZone}`}>
        <span>now</span>
        <input
          type="datetime-local"
          value={toLocalInput(state.now, timeZone)}
          onChange={(e) => e.target.value && setNow(fromLocalInput(e.target.value, timeZone))}
        />
        {STEPS.map(([label, minutes]) => (
          <button key={label} onClick={() => setNow(addMinutes(state.now, minutes))}>
            {label}
          </button>
        ))}
        <button onClick={() => setNow(realNow())}>real now</button>
        <span className="muted">{formatDateTime(state.now, timeZone)} · {timeZone}</span>
      </div>

      <div className="view-control">
        <button className={view === 'week' ? 'active' : ''} onClick={() => onView('week')}>
          Week
        </button>
        <button className={view === 'day' ? 'active' : ''} onClick={() => onView('day')}>
          Day
        </button>
        {onDayStep && (
          <>
            <button onClick={() => onDayStep(-1)}>◂</button>
            <span>{dayLabel}</span>
            <button onClick={() => onDayStep(1)}>▸</button>
          </>
        )}
      </div>

      <button className="reset" onClick={playground.reset} title="Drop stored placements, pins and done marks">
        Reset state
      </button>
    </header>
  );
}
