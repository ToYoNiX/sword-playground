import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { DayInfo, Placement, Plan, ScheduleInput } from '@sword/engine';
import { addMinutes, clock, formatDate, minutesInto } from '../model/time.ts';

/** Pixels per minute. */
const PPM = 1.1;
const SNAP_MINUTES = 5;

interface Props {
  days: DayInfo[];
  plan: Plan;
  input: ScheduleInput;
  now: string;
  selected: string | null;
  highlighted: ReadonlySet<string>;
  onSelect: (occurrenceId: string) => void;
  onPin: (occurrenceId: string, start: string) => void;
}

interface Block {
  key: string;
  label: string;
  start: string;
  end: string;
  className: string;
  title: string;
}

export function TimeGrid({ days, plan, input, now, selected, highlighted, onSelect, onPin }: Props) {
  const tz = input.timeZone;
  const root = useRef<HTMLDivElement>(null);
  const firstDay = days[0]?.date;

  // When the days shown change, scroll to "now", or to the first task.
  useEffect(() => {
    const scroller = root.current?.parentElement;
    const target = root.current?.querySelector<HTMLElement>('.now') ?? root.current?.querySelector<HTMLElement>('.block.task');
    if (scroller && target) scroller.scrollTop = Math.max(target.offsetTop - 80, 0);
  }, [firstDay, tz]);

  if (days.length === 0) return <div className="empty">No days to show.</div>;

  // Columns line up by local clock time; each shades what lies outside its logical day.
  // Half an hour of room above the first hour, so its label isn't cut off.
  const axisStart = Math.floor(Math.min(...days.map((d) => minutesInto(d.date, d.start, tz))) / 60) * 60 - 30;
  const axisEnd = Math.ceil(Math.max(...days.map((d) => minutesInto(d.date, d.end, tz))) / 60) * 60;
  const y = (date: string, iso: string) => (minutesInto(date, iso, tz) - axisStart) * PPM;
  const height = (axisEnd - axisStart) * PPM;
  const conflicted = new Set(plan.conflicts.map((c) => c.occurrenceId));
  const hours = Array.from({ length: (axisEnd - axisStart - 30) / 60 + 1 }, (_, i) => axisStart + 30 + i * 60);

  return (
    <div className="grid" ref={root}>
      <div className="grid-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d.date} className="day-head">
            <strong>{formatDate(d.date)}</strong>
            <span>
              {clock(d.start, tz)} → {clock(d.end, tz)}
            </span>
          </div>
        ))}
      </div>
      <div className="grid-body" style={{ height }}>
        <div className="gutter">
          {hours.map((m) => (
            <div key={m} className="hour-label" style={{ top: (m - axisStart) * PPM }}>
              {String(Math.floor(m / 60) % 24).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const top = (iso: string) => y(d.date, iso);
          const span = (start: string, end: string) => ({ top: top(start), height: Math.max((Date.parse(end) - Date.parse(start)) / 60_000 * PPM, 2) });
          const inDay = (start: string, end: string) => start < d.end && end > d.start;

          const rails = [
            ...d.parts.map((p) => ({ key: `part:${p.name}`, label: p.name, start: p.start, end: p.end, className: 'rail part' })),
            ...(input.anchors ?? [])
              .filter((a) => a.date === d.date && !a.busy?.length && a.end !== undefined && a.end !== a.start)
              .map((a) => ({ key: `win:${a.id}`, label: a.id, start: a.start, end: a.end as string, className: 'rail window' })),
          ];
          const points = (input.anchors ?? []).filter((a) => a.date === d.date && (a.end === undefined || a.end === a.start));
          const blocks: Block[] = [
            ...(input.anchors ?? []).flatMap((a) =>
              (a.busy ?? [])
                .filter((b) => inDay(b.start, b.end))
                .map((b, i) => ({
                  key: `busy:${a.id}@${a.date}:${i}`,
                  label: a.id.replace(/^prayer\./, ''),
                  start: b.start,
                  end: b.end,
                  className: a.tags?.includes('prayer') ? 'busy prayer' : 'busy',
                  title: `${a.id} (busy) ${clock(b.start, tz)}–${clock(b.end, tz)}`,
                })),
            ),
            ...(input.events ?? [])
              .filter((e) => inDay(e.start, e.end))
              .map((e) => ({
                key: `event:${e.id}`,
                label: e.title ?? e.id,
                start: e.start,
                end: e.end,
                className: e.busy === false ? 'event free' : 'event',
                title: `${e.title ?? e.id} ${clock(e.start, tz)}–${clock(e.end, tz)}${e.busy === false ? ' (not busy)' : ''}`,
              })),
          ];
          const placements = plan.placements.filter((p) => p.date === d.date);
          const nowInDay = now >= d.start && now < d.end;

          return (
            <div key={d.date} className="column">
              <div className="outside" style={{ top: 0, height: Math.max(top(d.start), 0) }} />
              <div className="outside" style={{ top: top(d.end), height: Math.max(height - top(d.end), 0) }} />
              {hours.map((m) => (
                <div key={m} className="hour-line" style={{ top: (m - axisStart) * PPM }} />
              ))}
              {rails.map((r) => (
                <div key={r.key} className={r.className} style={span(r.start, r.end)} title={`${r.label} ${clock(r.start, tz)}–${clock(r.end, tz)}`}>
                  <span>{r.label}</span>
                </div>
              ))}
              {points.map((a) => (
                <div key={`point:${a.id}`} className="point" style={{ top: top(a.start) }} title={`${a.id} ${clock(a.start, tz)}`}>
                  <span>
                    {a.id} {clock(a.start, tz)}
                  </span>
                </div>
              ))}
              {blocks.map((b) => (
                <div key={b.key} className={`block ${b.className}`} style={span(b.start, b.end)} title={b.title}>
                  <span>{b.label}</span>
                </div>
              ))}
              {placements.map((p) => (
                <TaskBlock
                  key={p.occurrenceId}
                  placement={p}
                  timeZone={tz}
                  style={span(p.start, p.end)}
                  selected={p.occurrenceId === selected}
                  conflict={conflicted.has(p.occurrenceId)}
                  highlighted={highlighted.has(p.occurrenceId)}
                  onSelect={onSelect}
                  onPin={onPin}
                />
              ))}
              {nowInDay && (
                <div className="now" style={{ top: top(now) }}>
                  <span>now</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TaskProps {
  placement: Placement;
  timeZone: string;
  style: { top: number; height: number };
  selected: boolean;
  conflict: boolean;
  highlighted: boolean;
  onSelect: (occurrenceId: string) => void;
  onPin: (occurrenceId: string, start: string) => void;
}

/** A placement. Click for details; drag up or down to pin it to a new time. */
function TaskBlock({ placement: p, timeZone, style, selected, conflict, highlighted, onSelect, onPin }: TaskProps) {
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const movable = p.state === 'scheduled' || p.state === 'pinned';
  const minutes = Math.round(offset / PPM / SNAP_MINUTES) * SNAP_MINUTES;

  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, moved: false };
  };
  const move = (e: PointerEvent) => {
    if (!drag.current || !movable) return;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dy) > 3) drag.current.moved = true;
    if (drag.current.moved) setOffset(dy);
  };
  const up = () => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    setOffset(0);
    if (wasDrag && minutes !== 0) onPin(p.occurrenceId, addMinutes(p.start, minutes));
    else if (!wasDrag) onSelect(p.occurrenceId);
  };

  const short = style.height < 30;
  const classes = ['block', 'task', p.kind, p.state, short && 'short', selected && 'selected', conflict && 'conflict', highlighted && 'highlighted', offset !== 0 && 'dragging']
    .filter(Boolean)
    .join(' ');
  const start = minutes !== 0 ? addMinutes(p.start, minutes) : p.start;
  const end = minutes !== 0 ? addMinutes(p.end, minutes) : p.end;
  return (
    <div
      className={classes}
      style={{ ...style, transform: offset ? `translateY(${offset}px)` : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      title={`${p.intentionId}: ${p.why}`}
    >
      <span className="task-title">{p.intentionId}</span>
      <span className="task-time">
        {clock(start, timeZone)}–{clock(end, timeZone)}
      </span>
    </div>
  );
}
