import type { AnchorInput, EventInput, ExistingPlacement, Pin, ScheduleInput } from '@sword/engine';
import type { LocalEvent, PlaygroundDoc, RepeatingAnchor } from './document.ts';
import { prayerAnchors } from './prayer.ts';
import { addDays, browserTimeZone, datesAround, localInstant, weekdayOf } from './time.ts';

/** What the playground keeps between runs, outside the document. */
export interface PlaygroundState {
  now: string;
  pins: Pin[];
  /** The placements of the last applied plan, fed back in for stability. */
  committed: ExistingPlacement[];
}

export function buildInput(doc: PlaygroundDoc, state: PlaygroundState): ScheduleInput {
  const { config } = doc;
  const timeZone = config.timeZone ?? browserTimeZone();
  const horizonDays = config.horizonDays ?? 7;
  // Anchors for a margin around the horizon: day starts can refer to them.
  const dates = datesAround(state.now, timeZone, 1, horizonDays + 1);
  return {
    timeZone,
    now: state.now,
    horizonDays,
    ...(config.dayStart !== undefined && { dayStart: config.dayStart }),
    ...(config.dayParts !== undefined && { dayParts: config.dayParts }),
    ...(config.avoid !== undefined && { avoid: config.avoid }),
    anchors: [...(doc.prayer ? prayerAnchors(doc.prayer, dates) : []), ...repeatingAnchors(doc.anchors, dates, timeZone)],
    events: localEvents(doc.events, timeZone),
    intentions: doc.tasks,
    pins: state.pins,
    existing: state.committed,
  };
}

function repeatingAnchors(list: readonly RepeatingAnchor[], dates: readonly string[], timeZone: string): AnchorInput[] {
  return list.flatMap((anchor) =>
    dates
      .filter((date) => anchor.on === null || anchor.on.includes(weekdayOf(date)))
      .map((date) => {
        const range = localRange(date, anchor.start, anchor.end, timeZone);
        return {
          id: anchor.id,
          date,
          ...range,
          ...(anchor.busy && { busy: [range] }),
          tags: anchor.tags,
        };
      }),
  );
}

function localEvents(list: readonly LocalEvent[], timeZone: string): EventInput[] {
  return list.map((event) => ({
    id: event.id,
    ...(event.title !== undefined && { title: event.title }),
    ...localRange(event.date, event.start, event.end, timeZone),
    busy: event.busy,
    tags: event.tags,
  }));
}

/** An end at or before the start is on the next day. */
function localRange(date: string, start: string, end: string, timeZone: string): { start: string; end: string } {
  const from = localInstant(date, pad(start), timeZone);
  let to = localInstant(date, pad(end), timeZone);
  if (to <= from) to = localInstant(addDays(date, 1), pad(end), timeZone);
  return { start: from, end: to };
}

function pad(time: string): string {
  return time.length === 4 ? `0${time}` : time;
}
