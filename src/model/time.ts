import { Temporal } from 'temporal-polyfill';

/** Local wall-clock time on a civil date → ISO instant. */
export function localInstant(date: string, time: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(timeZone).toInstant().toString();
}

export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function civilDate(iso: string, timeZone: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

/** Civil dates from `before` days before `iso` to `after` days after it. */
export function datesAround(iso: string, timeZone: string, before: number, after: number): string[] {
  const today = civilDate(iso, timeZone);
  return Array.from({ length: before + after + 1 }, (_, i) => addDays(today, i - before));
}

export function weekdayOf(date: string): string {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][Temporal.PlainDate.from(date).dayOfWeek - 1] as string;
}

/**
 * Wall-clock minutes of `iso` counted from `date` (above 1440 on later days).
 * Wall clock, not elapsed time: on a 25-hour day, 07:00 is still 420.
 */
export function minutesInto(date: string, iso: string, timeZone: string): number {
  const zoned = Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
  const days = Temporal.PlainDate.from(date).until(zoned.toPlainDate(), { largestUnit: 'days' }).days;
  return days * 1440 + zoned.hour * 60 + zoned.minute + zoned.second / 60;
}

export function isoFromMs(ms: number): string {
  return Temporal.Instant.fromEpochMilliseconds(ms).toString();
}

export function addMinutes(iso: string, minutes: number): string {
  return Temporal.Instant.from(iso).add({ minutes }).toString();
}

export function clock(iso: string, timeZone: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone).toPlainTime().toString({ smallestUnit: 'minute' });
}

export function formatDate(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string, timeZone: string): string {
  const zoned = Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
  return `${formatDate(zoned.toPlainDate().toString())} ${zoned.toPlainTime().toString({ smallestUnit: 'minute' })}`;
}

/** "YYYY-MM-DDTHH:MM" in the zone, for <input type="datetime-local">. */
export function toLocalInput(iso: string, timeZone: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}

export function fromLocalInput(value: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone).toInstant().toString();
}

export function realNow(): string {
  return Temporal.Now.instant().round({ smallestUnit: 'minute', roundingMode: 'floor' }).toString();
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
