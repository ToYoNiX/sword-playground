import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { Panels } from './components/Panels.tsx';
import { TimeGrid } from './components/TimeGrid.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { View } from './components/TopBar.tsx';
import { browserTimeZone, formatDate } from './model/time.ts';
import { usePlayground } from './usePlayground.ts';

const extensions = [yaml()];

export function App() {
  const playground = usePlayground();
  const { shown, run, lastDiff } = playground;
  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('view') === 'day' ? 'day' : 'week'));
  const [dayIndex, setDayIndex] = useState(0);
  // A counter alongside the id, so clicking the selected task again still opens its details.
  const [selection, setSelection] = useState<{ id: string | null; clicks: number }>({ id: null, clicks: 0 });
  const selected = selection.id;
  const setSelected = (id: string | null) => setSelection((s) => ({ id, clicks: s.clicks + 1 }));

  const plan = shown?.plan ?? null;
  const timeZone = shown?.input.timeZone ?? browserTimeZone();
  const allDays = plan?.days ?? [];
  const index = Math.min(dayIndex, Math.max(allDays.length - 1, 0));
  const days = view === 'week' ? allDays : allDays.slice(index, index + 1);
  const highlighted = useMemo(
    () => new Set([...(lastDiff?.added ?? []), ...(lastDiff?.moved.map((m) => m.occurrenceId) ?? [])]),
    [lastDiff],
  );

  return (
    <div className="app">
      <section className="editor-pane">
        <div className="pane-title">
          playground.yaml
          {run.kind === 'error' && <span className="badge error">{run.errors.length} error(s), showing the last good plan</span>}
        </div>
        <CodeMirror
          className="editor"
          value={playground.source}
          extensions={extensions}
          onChange={playground.setSource}
          height="100%"
          basicSetup={{ foldGutter: false }}
        />
      </section>
      <main className="main">
        <TopBar
          playground={playground}
          timeZone={timeZone}
          view={view}
          onView={setView}
          dayLabel={view === 'day' && allDays[index] ? formatDate(allDays[index].date) : null}
          onDayStep={view === 'day' ? (step) => setDayIndex(Math.min(Math.max(index + step, 0), allDays.length - 1)) : null}
        />
        <div className="grid-scroll">
          {shown && plan ? (
            <TimeGrid
              days={days}
              plan={plan}
              input={shown.input}
              now={playground.state.now}
              selected={selected}
              highlighted={highlighted}
              onSelect={setSelected}
              onPin={playground.pin}
            />
          ) : (
            <div className="empty">Fix the document to see a plan.</div>
          )}
        </div>
        <Panels
          playground={playground}
          plan={plan}
          timeZone={timeZone}
          selected={selected}
          selectionClicks={selection.clicks}
          onSelect={setSelected}
        />
      </main>
    </div>
  );
}
