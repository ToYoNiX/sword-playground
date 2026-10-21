import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { schedule } from '@sword/engine';
import type { Diff, ExistingPlacement, Plan, ScheduleInput } from '@sword/engine';
import { readDocument } from './model/document.ts';
import { buildInput } from './model/input.ts';
import type { PlaygroundState } from './model/input.ts';
import { PRESETS } from './model/presets.ts';
import type { Preset } from './model/presets.ts';

export type Run =
  | { kind: 'ok'; input: ScheduleInput; plan: Plan; warnings: string[] }
  | { kind: 'error'; errors: string[]; warnings: string[] };

const STORAGE_KEY = 'sword-playground';

interface Saved {
  source: string;
  state: PlaygroundState;
}

function load(): Saved {
  // ?preset=2 loads a preset (handy for links and screenshots).
  const requested = new URLSearchParams(location.search).get('preset');
  const fromUrl = requested === null ? undefined : PRESETS[Number(requested)];
  if (fromUrl) return { source: fromUrl.source, state: { now: fromUrl.now, pins: [], committed: [] } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
    if (saved?.source && saved.state) return saved;
  } catch {
    // Start fresh.
  }
  const preset = PRESETS[0] as Preset;
  return { source: preset.source, state: { now: preset.now, pins: [], committed: [] } };
}

function hasChanges(diff: Diff): boolean {
  return diff.added.length + diff.moved.length + diff.removed.length + diff.missed.length > 0;
}

/**
 * The document and state in, a plan out. Every plan with changes is applied
 * at once: its placements become the "existing" input of the next run, the
 * way the real app will keep them, so stability can be seen at work.
 */
export function usePlayground() {
  const [initial] = useState(load);
  const [source, setSource] = useState(initial.source);
  const [state, setState] = useState<PlaygroundState>(initial.state);
  const [lastDiff, setLastDiff] = useState<Diff | null>(null);
  const [lastGood, setLastGood] = useState<Extract<Run, { kind: 'ok' }> | null>(null);
  const deferredSource = useDeferredValue(source);

  const doc = useMemo(() => readDocument(deferredSource), [deferredSource]);
  const run: Run = useMemo(() => {
    if (!doc.ok) return { kind: 'error', errors: doc.errors, warnings: doc.warnings };
    try {
      const input = buildInput(doc.doc, state);
      return { kind: 'ok', input, plan: schedule(input), warnings: doc.warnings };
    } catch (error) {
      return { kind: 'error', errors: [(error as Error).message], warnings: doc.warnings };
    }
  }, [doc, state]);

  useEffect(() => {
    if (run.kind !== 'ok') return;
    setLastGood(run);
    if (!hasChanges(run.plan.diff)) return;
    setLastDiff(run.plan.diff);
    const committed: ExistingPlacement[] = run.plan.placements.map(({ occurrenceId, start, end, state: s }) => ({
      occurrenceId,
      start,
      end,
      state: s,
    }));
    setState((current) =>
      JSON.stringify(current.committed) === JSON.stringify(committed) ? current : { ...current, committed },
    );
  }, [run]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ source, state } satisfies Saved));
  }, [source, state]);

  const updateCommitted = (occurrenceId: string, change: (p: ExistingPlacement) => ExistingPlacement | null) =>
    setState((s) => ({
      ...s,
      committed: s.committed.flatMap((p) => {
        if (p.occurrenceId !== occurrenceId) return [p];
        const next = change(p);
        return next ? [next] : [];
      }),
    }));

  return {
    source,
    setSource,
    state,
    run,
    /** The last plan that worked, shown while the document has errors. */
    shown: run.kind === 'ok' ? run : lastGood,
    lastDiff,
    setNow: (now: string) => setState((s) => ({ ...s, now })),
    loadPreset: (preset: Preset) => {
      setSource(preset.source);
      setState({ now: preset.now, pins: [], committed: [] });
      setLastDiff(null);
    },
    pin: (occurrenceId: string, start: string) =>
      setState((s) => ({ ...s, pins: [...s.pins.filter((p) => p.occurrenceId !== occurrenceId), { occurrenceId, start }] })),
    unpin: (occurrenceId: string) =>
      setState((s) => ({ ...s, pins: s.pins.filter((p) => p.occurrenceId !== occurrenceId) })),
    setDone: (occurrenceId: string, done: boolean) =>
      updateCommitted(occurrenceId, (p) => ({ ...p, state: done ? 'done' : 'scheduled' })),
    /** Forget the stored placement and pin, so the engine places it from scratch. */
    forget: (occurrenceId: string) => {
      updateCommitted(occurrenceId, () => null);
      setState((s) => ({ ...s, pins: s.pins.filter((p) => p.occurrenceId !== occurrenceId) }));
    },
    reset: () => {
      setState((s) => ({ ...s, pins: [], committed: [] }));
      setLastDiff(null);
    },
  };
}

export type Playground = ReturnType<typeof usePlayground>;
