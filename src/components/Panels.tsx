import { useEffect, useState } from 'react';
import type { Diff, Plan } from '@sword/engine';
import { formatDateTime } from '../model/time.ts';
import type { Playground } from '../usePlayground.ts';

type Tab = 'selected' | 'unplaced' | 'conflicts' | 'missed' | 'inbox' | 'changes' | 'problems';

interface Props {
  playground: Playground;
  plan: Plan | null;
  timeZone: string;
  selected: string | null;
  selectionClicks: number;
  onSelect: (occurrenceId: string | null) => void;
}

export function Panels({ playground, plan, timeZone, selected, selectionClicks, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>('unplaced');
  useEffect(() => {
    if (selected) setTab('selected');
  }, [selected, selectionClicks]);

  const { run, lastDiff } = playground;
  const missed = plan?.placements.filter((p) => p.state === 'missed') ?? [];
  const problems = [
    ...(run.kind === 'error' ? run.errors.map((e) => ({ level: 'error', text: e })) : []),
    ...run.warnings.map((w) => ({ level: 'warning', text: w })),
    ...(plan?.errors ?? []).map((e) => ({ level: 'error', text: `${e.intentionId ?? ''} ${e.code}: ${e.message}` })),
    ...(plan?.warnings ?? []).map((w) => ({ level: 'warning', text: `${w.occurrenceId ?? ''} ${w.code}: ${w.message}` })),
  ];
  const changeCount = lastDiff ? lastDiff.added.length + lastDiff.moved.length + lastDiff.removed.length + lastDiff.missed.length : 0;

  const tabs: [Tab, string, number | null][] = [
    ['selected', 'Selected', null],
    ['unplaced', 'Unplaced', plan?.unplaced.length ?? 0],
    ['conflicts', 'Conflicts', plan?.conflicts.length ?? 0],
    ['missed', 'Missed', missed.length],
    ['inbox', 'Inbox', plan?.inbox.length ?? 0],
    ['changes', 'Last change', changeCount],
    ['problems', 'Problems', problems.length],
  ];

  return (
    <div className="panels">
      <div className="tabs">
        {tabs.map(([id, label, count]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
            {count !== null && <span className={`count ${count > 0 && id !== 'changes' ? 'nonzero' : ''}`}>{count}</span>}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'selected' && (
          <SelectedPanel
            playground={playground}
            plan={plan}
            timeZone={timeZone}
            selected={selected}
            selectionClicks={selectionClicks}
            onSelect={onSelect}
          />
        )}
        {tab === 'unplaced' && (
          <List empty="Everything fits.">
            {plan?.unplaced.map((u) => (
              <li key={u.occurrenceId}>
                <code>{u.occurrenceId}</code> <span className="tag">{u.code}</span> {u.message}
              </li>
            ))}
          </List>
        )}
        {tab === 'conflicts' && (
          <List empty="No conflicts.">
            {plan?.conflicts.map((c) => (
              <li key={c.occurrenceId}>
                <a onClick={() => onSelect(c.occurrenceId)}>
                  <code>{c.occurrenceId}</code>
                </a>{' '}
                {c.message}
              </li>
            ))}
          </List>
        )}
        {tab === 'missed' && (
          <List empty="Nothing missed. Move “now” forward to see tasks get missed.">
            {missed.map((p) => (
              <li key={p.occurrenceId}>
                <code>{p.occurrenceId}</code> {formatDateTime(p.start, timeZone)}{' '}
                <button onClick={() => playground.setDone(p.occurrenceId, true)}>Mark done</button>{' '}
                <button onClick={() => playground.forget(p.occurrenceId)}>Reschedule</button>
              </li>
            ))}
          </List>
        )}
        {tab === 'inbox' && (
          <List empty="The inbox is empty.">
            {plan?.inbox.map((id) => (
              <li key={id}>
                <code>{id}</code> has no rules yet; give it a window, a date or a deadline to schedule it.
              </li>
            ))}
          </List>
        )}
        {tab === 'changes' && <Changes diff={lastDiff} />}
        {tab === 'problems' && (
          <List empty="No problems.">
            {problems.map((p, i) => (
              <li key={i} className={p.level}>
                {p.text}
              </li>
            ))}
          </List>
        )}
      </div>
    </div>
  );
}

function SelectedPanel({ playground, plan, timeZone, selected, onSelect }: Props) {
  const placement = plan?.placements.find((p) => p.occurrenceId === selected);
  if (!placement) return <p className="muted">Click a task in the calendar.</p>;
  const conflict = plan?.conflicts.find((c) => c.occurrenceId === placement.occurrenceId);
  const pinned = playground.state.pins.some((p) => p.occurrenceId === placement.occurrenceId);
  return (
    <div className="selected">
      <h3>
        <code>{placement.occurrenceId}</code> <span className={`tag ${placement.kind}`}>{placement.kind}</span>{' '}
        <span className={`tag ${placement.state}`}>{placement.state}</span>
      </h3>
      <p>
        {formatDateTime(placement.start, timeZone)} → {formatDateTime(placement.end, timeZone)}
      </p>
      <p>
        <strong>Why:</strong> {placement.why}
      </p>
      {conflict && (
        <p className="error">
          <strong>Conflict:</strong> {conflict.message}
        </p>
      )}
      <div className="actions">
        {placement.state === 'done' ? (
          <button onClick={() => playground.setDone(placement.occurrenceId, false)}>Undo done</button>
        ) : (
          <button onClick={() => playground.setDone(placement.occurrenceId, true)}>Mark done</button>
        )}
        {pinned && <button onClick={() => playground.unpin(placement.occurrenceId)}>Unpin</button>}
        <button onClick={() => playground.forget(placement.occurrenceId)}>Forget placement</button>
        <button onClick={() => onSelect(null)}>Close</button>
      </div>
      <p className="muted">Drag a task up or down to pin it. “Forget” drops the stored placement so it is planned from scratch.</p>
    </div>
  );
}

function Changes({ diff }: { diff: Diff | null }) {
  if (!diff) return <p className="muted">No changes yet.</p>;
  return (
    <List empty="The last run changed nothing.">
      {diff.added.length > 0 && (
        <li>
          <strong>Added:</strong> {diff.added.join(', ')}
        </li>
      )}
      {diff.moved.map((m) => (
        <li key={`moved:${m.occurrenceId}`}>
          <strong>Moved</strong> <code>{m.occurrenceId}</code>: {m.reason}
        </li>
      ))}
      {diff.removed.map((r) => (
        <li key={`removed:${r.occurrenceId}`}>
          <strong>Removed</strong> <code>{r.occurrenceId}</code>: {r.reason}
        </li>
      ))}
      {diff.missed.length > 0 && (
        <li>
          <strong>Missed:</strong> {diff.missed.join(', ')}
        </li>
      )}
    </List>
  );
}

function List({ empty, children }: { empty: string; children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return <ul className="list">{items}</ul>;
}
