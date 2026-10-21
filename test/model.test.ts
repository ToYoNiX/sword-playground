import { describe, expect, it } from 'vitest';
import { schedule } from '@sword/engine';
import { readDocument } from '../src/model/document.ts';
import type { PlaygroundDoc } from '../src/model/document.ts';
import { buildInput } from '../src/model/input.ts';
import { PRESETS } from '../src/model/presets.ts';
import { prayerAnchors } from '../src/model/prayer.ts';
import type { PrayerSettings } from '../src/model/prayer.ts';
import { addMinutes, clock } from '../src/model/time.ts';

const cairo: PrayerSettings = {
  latitude: 30.0444,
  longitude: 31.2357,
  method: 'Egyptian',
  madhab: 'shafi',
  busyMinutes: { fajr: 20, dhuhr: 20, asr: 20, maghrib: 20, isha: 20 },
  iqamaMinutes: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  jumuahMinutes: null,
};

function docOf(source: string): PlaygroundDoc {
  const result = readDocument(source);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.doc;
}

describe('prayer anchors (adhan)', () => {
  const anchors = prayerAnchors(cairo, ['2026-10-25', '2026-10-26']);
  const find = (id: string, date: string) => anchors.find((a) => a.id === id && a.date === date);

  it('provides the five prayers and sunrise for each date, in order', () => {
    expect(anchors.filter((a) => a.date === '2026-10-25').map((a) => a.id)).toEqual([
      'prayer.fajr',
      'prayer.dhuhr',
      'prayer.asr',
      'prayer.maghrib',
      'prayer.isha',
      'sun.rise',
    ]);
  });

  it('chains the windows: Fajr until sunrise, each prayer until the next, Isha until the next Fajr', () => {
    expect(find('prayer.fajr', '2026-10-25')?.end).toBe(find('sun.rise', '2026-10-25')?.start);
    expect(find('prayer.dhuhr', '2026-10-25')?.end).toBe(find('prayer.asr', '2026-10-25')?.start);
    expect(find('prayer.isha', '2026-10-25')?.end).toBe(find('prayer.fajr', '2026-10-26')?.start);
  });

  it('gives each prayer a busy portion, shifted by the iqama time', () => {
    const fajr = find('prayer.fajr', '2026-10-25');
    expect(fajr?.busy).toEqual([{ start: fajr?.start, end: addMinutes(fajr?.start as string, 20) }]);
    const late = prayerAnchors({ ...cairo, iqamaMinutes: { ...cairo.iqamaMinutes, fajr: 15 } }, ['2026-10-25'])[0];
    expect(late?.busy).toEqual([{ start: addMinutes(late?.start as string, 15), end: addMinutes(late?.start as string, 35) }]);
  });

  // Reference times from the Aladhan API (method 5, Egyptian General Authority
  // of Survey), which is an independent implementation. Implementations round
  // differently, so they may differ by a minute.
  it.each([
    ['2026-10-25', { fajr: '05:36', sunrise: '07:04', dhuhr: '12:39', asr: '15:50', maghrib: '18:14', isha: '19:32' }],
    // Egypt's summer time has ended by Oct 30: every time is an hour earlier.
    ['2026-10-30', { fajr: '04:40', sunrise: '06:07', dhuhr: '11:39', asr: '14:47', maghrib: '17:10', isha: '18:28' }],
  ])('match published times for Cairo on %s, within a minute', (date, expected) => {
    const ours = prayerAnchors(cairo, [date]);
    const at = (id: string) => clock(ours.find((a) => a.id === id)?.start as string, 'Africa/Cairo');
    const actual = {
      fajr: at('prayer.fajr'),
      sunrise: at('sun.rise'),
      dhuhr: at('prayer.dhuhr'),
      asr: at('prayer.asr'),
      maghrib: at('prayer.maghrib'),
      isha: at('prayer.isha'),
    };
    const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
    for (const [name, time] of Object.entries(expected)) {
      const diff = Math.abs(minutes(actual[name as keyof typeof actual]) - minutes(time));
      expect(diff, `${name}: ours ${actual[name as keyof typeof actual]}, published ${time}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("Jumu'ah", () => {
  const busyOf = (settings: PrayerSettings, date: string) => {
    const dhuhr = prayerAnchors(settings, [date]).find((a) => a.id === 'prayer.dhuhr');
    return (Date.parse(dhuhr?.busy?.[0]?.end as string) - Date.parse(dhuhr?.busy?.[0]?.start as string)) / 60_000;
  };

  it("makes Friday's Dhuhr take longer", () => {
    expect(busyOf({ ...cairo, jumuahMinutes: 45 }, '2026-10-30')).toBe(45);
  });

  it('leaves other days, and Fridays without the setting, alone', () => {
    expect(busyOf({ ...cairo, jumuahMinutes: 45 }, '2026-10-29')).toBe(20);
    expect(busyOf(cairo, '2026-10-30')).toBe(20);
  });
});

describe('the playground document', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('preset "%s" reads and schedules cleanly', (_, preset) => {
    const doc = docOf(preset.source);
    const plan = schedule(buildInput(doc, { now: preset.now, pins: [], committed: [] }));
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.placements.length).toBeGreaterThan(0);
  });

  it('reports errors with their location', () => {
    const result = readDocument(`
prayer: { latitude: 200, longitude: 0 }
anchors:
  - { id: work, start: "9am", end: "17:00" }
tasks:
  - { id: study, duration: 45 }
  - { id: walk, duration: 30m, window: { afer: prayer.asr } }
`);
    expect(result.ok).toBe(false);
    const errors = result.ok ? '' : result.errors.join('\n');
    expect(errors).toContain('prayer.latitude');
    expect(errors).toContain('anchors[0].start');
    expect(errors).toContain('tasks[0] (study): duration');
    expect(errors).toContain('tasks[1] (walk)');
  });

  it('warns about unknown sections', () => {
    expect(readDocument('tasks: []\nsprints: []\n')).toMatchObject({ ok: true, warnings: ['unknown section "sprints"'] });
  });
});

describe('presets behave as described', () => {
  it('prayer routine: Morning Quran follows Fajr every day', () => {
    const preset = PRESETS[0]!;
    const input = buildInput(docOf(preset.source), { now: preset.now, pins: [], committed: [] });
    const plan = schedule(input);
    const quran = plan.placements.filter((p) => p.intentionId === 'quran');
    expect(quran).toHaveLength(7);
    for (const p of quran) {
      const fajr = input.anchors?.find((a) => a.id === 'prayer.fajr' && a.date === p.date);
      expect(p.start).toBe(addMinutes(fajr?.busy?.[0]?.end as string, 5));
    }
  });

  it('packing: earliest leaves the long task out, packed fits all three', () => {
    const preset = PRESETS[2]!;
    const run = (source: string) => schedule(buildInput(docOf(source), { now: preset.now, pins: [], committed: [] }));

    const earliest = run(preset.source);
    expect(earliest.unplaced.map((u) => u.occurrenceId)).toEqual(['long']);

    const packed = run(preset.source.replaceAll('prefer: earliest', 'prefer: packed'));
    expect(packed.unplaced).toEqual([]);
    expect(Object.fromEntries(packed.placements.map((p) => [p.occurrenceId, p.date]))).toEqual({
      long: '2026-10-26',
      medium: '2026-10-27',
      short: '2026-10-28',
    });
  });
});

describe('grid positions', () => {
  it('follow the wall clock on the day the clocks go back', async () => {
    const { minutesInto, localInstant } = await import('../src/model/time.ts');
    const tz = 'Europe/Berlin';
    // 2026-10-25 has 25 hours in Berlin; 07:00 must still be drawn at 07:00.
    expect(minutesInto('2026-10-25', localInstant('2026-10-25', '07:00', tz), tz)).toBe(7 * 60);
    expect(minutesInto('2026-10-25', localInstant('2026-10-26', '01:30', tz), tz)).toBe(25 * 60 + 30);
  });
});
