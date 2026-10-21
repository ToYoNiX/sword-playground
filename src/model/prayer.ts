/**
 * Prayer times from the adhan library, as anchors. A stand-in for the
 * sword-prayer plugin, for testing only.
 */
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import type { CalculationParameters } from 'adhan';
import type { AnchorInput } from '@sword/engine';
import { addDays, isoFromMs, weekdayOf } from './time.ts';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

export const METHODS = {
  MuslimWorldLeague: () => CalculationMethod.MuslimWorldLeague(),
  Egyptian: () => CalculationMethod.Egyptian(),
  Karachi: () => CalculationMethod.Karachi(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Dubai: () => CalculationMethod.Dubai(),
  Kuwait: () => CalculationMethod.Kuwait(),
  Qatar: () => CalculationMethod.Qatar(),
  Singapore: () => CalculationMethod.Singapore(),
  Tehran: () => CalculationMethod.Tehran(),
  Turkey: () => CalculationMethod.Turkey(),
  NorthAmerica: () => CalculationMethod.NorthAmerica(),
  MoonsightingCommittee: () => CalculationMethod.MoonsightingCommittee(),
} satisfies Record<string, () => CalculationParameters>;

export type MethodName = keyof typeof METHODS;

export interface PrayerSettings {
  latitude: number;
  longitude: number;
  method: MethodName;
  madhab: 'shafi' | 'hanafi';
  /** How long each prayer occupies you. */
  busyMinutes: Record<PrayerName, number>;
  /** Minutes from the adhan to when you pray (e.g. the iqama). */
  iqamaMinutes: Record<PrayerName, number>;
  /** How long Friday's Dhuhr (Jumu'ah) takes, or null to treat Friday like any day. */
  jumuahMinutes: number | null;
}

/**
 * Anchors for each civil date: prayer.fajr … prayer.isha, each with a window
 * that runs until the next one (Fajr until sunrise, Isha until the next Fajr)
 * and a busy portion; plus sun.rise as a point.
 */
export function prayerAnchors(settings: PrayerSettings, dates: readonly string[]): AnchorInput[] {
  const coordinates = new Coordinates(settings.latitude, settings.longitude);
  const params = METHODS[settings.method]();
  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const timesOn = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    // adhan reads the year, month and day of this Date in the runtime's zone.
    return new PrayerTimes(coordinates, new Date(y, m - 1, d), params);
  };

  const anchors: AnchorInput[] = [];
  for (const date of dates) {
    const today = timesOn(date);
    const tomorrow = timesOn(addDays(date, 1));
    const windows: Record<PrayerName, [Date, Date]> = {
      fajr: [today.fajr, today.sunrise],
      dhuhr: [today.dhuhr, today.asr],
      asr: [today.asr, today.maghrib],
      maghrib: [today.maghrib, today.isha],
      isha: [today.isha, tomorrow.fajr],
    };
    for (const name of PRAYERS) {
      const [start, end] = windows[name];
      if (!isValid(start) || !isValid(end)) continue; // e.g. no Isha in high-latitude summers
      const jumuah = name === 'dhuhr' && settings.jumuahMinutes !== null && weekdayOf(date) === 'fri';
      const prayStart = start.getTime() + settings.iqamaMinutes[name] * 60_000;
      const prayEnd = prayStart + (jumuah ? (settings.jumuahMinutes as number) : settings.busyMinutes[name]) * 60_000;
      anchors.push({
        id: `prayer.${name}`,
        date,
        start: isoFromMs(start.getTime()),
        end: isoFromMs(end.getTime()),
        busy: [{ start: isoFromMs(prayStart), end: isoFromMs(prayEnd) }],
        tags: jumuah ? ['prayer', 'jumuah'] : ['prayer'],
      });
    }
    if (isValid(today.sunrise)) {
      anchors.push({ id: 'sun.rise', date, start: isoFromMs(today.sunrise.getTime()), tags: ['sun'] });
    }
  }
  return anchors;
}

function isValid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}
