/**
 * The playground document: one YAML file holding what will later be spread
 * over sword.yaml, task files, calendars and plugins.
 *
 *   config:  same as sword.yaml
 *   prayer:  prayer times from adhan (stand-in for sword-prayer)
 *   anchors: repeating anchors with local times, e.g. work
 *   events:  one-off events with local times
 *   tasks:   same fields as task-file frontmatter
 */
import { parse } from 'yaml';
import { z } from 'zod';
import { readConfig, readIntention } from '@sword/schema';
import type { Config } from '@sword/schema';
import type { IntentionInput } from '@sword/engine';
import { METHODS, PRAYERS } from './prayer.ts';
import type { MethodName, PrayerName, PrayerSettings } from './prayer.ts';

export interface RepeatingAnchor {
  id: string;
  /** Weekdays, or null for every day. */
  on: string[] | null;
  start: string;
  end: string;
  busy: boolean;
  tags: string[];
}

export interface LocalEvent {
  id: string;
  title?: string;
  date: string;
  start: string;
  end: string;
  busy: boolean;
  tags: string[];
}

export interface PlaygroundDoc {
  config: Config;
  prayer: PrayerSettings | null;
  anchors: RepeatingAnchor[];
  events: LocalEvent[];
  tasks: IntentionInput[];
}

export type DocResult =
  | { ok: true; doc: PlaygroundDoc; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const time = z.string().regex(/^\d{1,2}:\d{2}$/, 'expected a time like "09:00"');
const minutes = z.number().int().min(0);
const perPrayer = z.union([minutes, z.strictObject(Object.fromEntries(PRAYERS.map((p) => [p, minutes.optional()])))]);

const prayerSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  method: z.enum(Object.keys(METHODS) as [MethodName, ...MethodName[]]).default('MuslimWorldLeague'),
  madhab: z.enum(['shafi', 'hanafi']).default('shafi'),
  busy_minutes: perPrayer.default(20),
  iqama_minutes: perPrayer.default(0),
  jumuah_minutes: minutes.optional(),
});

const anchorSchema = z.strictObject({
  id: z.string(),
  on: z.array(z.string()).optional(),
  start: time,
  end: time,
  busy: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const eventSchema = z.strictObject({
  id: z.string(),
  title: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a date like 2026-10-26'),
  start: time,
  end: time,
  busy: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

const SECTIONS = new Set(['config', 'prayer', 'anchors', 'events', 'tasks']);

export function readDocument(source: string): DocResult {
  let data: unknown;
  try {
    data = parse(source);
  } catch (error) {
    return { ok: false, errors: [(error as Error).message], warnings: [] };
  }
  data ??= {};
  if (typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['the document must be a mapping'], warnings: [] };
  const sections = data as Record<string, unknown>;
  const errors: string[] = [];
  const warnings = Object.keys(sections)
    .filter((key) => !SECTIONS.has(key))
    .map((key) => `unknown section "${key}"`);

  const config = readConfig(sections['config'] ?? {});
  warnings.push(...config.warnings.map((w) => `config: ${w}`));
  if (!config.ok) errors.push(...config.errors.map((e) => `config: ${e}`));

  let prayer: PrayerSettings | null = null;
  if (sections['prayer'] !== undefined && sections['prayer'] !== null) {
    const parsed = prayerSchema.safeParse(sections['prayer']);
    if (parsed.success) {
      const { latitude, longitude, method, madhab } = parsed.data;
      prayer = {
        latitude,
        longitude,
        method,
        madhab,
        busyMinutes: perPrayerValues(parsed.data.busy_minutes, 20),
        iqamaMinutes: perPrayerValues(parsed.data.iqama_minutes, 0),
        jumuahMinutes: parsed.data.jumuah_minutes ?? null,
      };
    } else {
      errors.push(...formatIssues('prayer', parsed.error));
    }
  }

  const anchors = readList('anchors', sections['anchors'], anchorSchema, errors).map((a) => ({ ...a, on: a.on ?? null }));
  const events = readList('events', sections['events'], eventSchema, errors);

  const tasks: IntentionInput[] = [];
  const rawTasks = sections['tasks'] ?? [];
  if (!Array.isArray(rawTasks)) {
    errors.push('tasks: expected a list');
  } else {
    rawTasks.forEach((raw, i) => {
      const result = readIntention(raw);
      const label = `tasks[${i}]${typeof raw === 'object' && raw && 'id' in raw ? ` (${String(raw.id)})` : ''}`;
      warnings.push(...result.warnings.map((w) => `${label}: ${w}`));
      if (result.ok) tasks.push(result.value);
      else errors.push(...result.errors.map((e) => `${label}: ${e}`));
    });
  }

  if (errors.length > 0 || !config.ok) return { ok: false, errors, warnings };
  return { ok: true, doc: { config: config.value, prayer, anchors, events, tasks }, warnings };
}

function readList<T>(name: string, value: unknown, schema: z.ZodType<T>, errors: string[]): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${name}: expected a list`);
    return [];
  }
  const items: T[] = [];
  value.forEach((item, i) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) items.push(parsed.data);
    else errors.push(...formatIssues(`${name}[${i}]`, parsed.error));
  });
  return items;
}

function formatIssues(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => `${[prefix, ...issue.path.map(String)].join('.')}: ${issue.message}`);
}

function perPrayerValues(value: number | Partial<Record<string, number | undefined>>, fallback: number): Record<PrayerName, number> {
  return Object.fromEntries(
    PRAYERS.map((p) => [p, typeof value === 'number' ? value : (value[p] ?? fallback)]),
  ) as Record<PrayerName, number>;
}
