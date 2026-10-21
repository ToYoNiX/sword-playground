export interface Preset {
  name: string;
  /** Where "now" starts when the preset is loaded. */
  now: string;
  source: string;
}

const prayerRoutine = `# Edit anything; the schedule updates as you type.
# Drag a task to pin it, click it for details, and move "now" to see time pass.

config:                      # same as sword.yaml
  time_zone: Africa/Cairo    # summer time ends on the night of Oct 29
  day_start: prayer.fajr.start
  horizon_days: 7
  avoid: [tag:prayer]

prayer:                      # stand-in for the sword-prayer plugin (adhan)
  latitude: 30.0444          # Cairo; set your own location
  longitude: 31.2357
  method: Egyptian           # UmmAlQura, MuslimWorldLeague, Karachi, Dubai, ...
  madhab: shafi
  busy_minutes: 20           # or per prayer: { fajr: 25, dhuhr: 15 }
  iqama_minutes: 0           # minutes from the adhan to when you pray
  jumuah_minutes: 45         # Friday's Dhuhr takes longer; remove to treat Friday like any day

anchors:                     # repeating anchors, local times
  - id: work
    on: [sun, mon, tue, wed, thu]
    start: "09:00"
    end: "17:00"
    busy: true

events:                      # one-off events, local times
  - id: standup
    title: Team meeting
    date: 2026-10-26
    start: "07:00"
    end: "07:30"

tasks:                       # same fields as task-file frontmatter
  - id: quran
    title: Morning Quran
    duration: 20m
    repeat: daily
    at: prayer.fajr.busy.end + 5m

  - id: study
    title: Study Go
    duration: 45m
    repeat: daily
    window:
      after: prayer.fajr
      before: work.start or 08:00

  - id: walk
    title: Walk
    duration: 30m
    repeat: daily
    window:
      after: prayer.asr
      before: prayer.maghrib

  - id: report
    title: Write report
    duration: 1h
    window:
      before: prayer.dhuhr
    deadline: 2026-10-27
    prefer: packed

  - id: plants
    title: Water the plants
    duration: 10m
    repeat: { every: 3 days, since: 2026-10-24 }
    window:
      within: evening

  - id: idea
    title: Look into CalDAV libraries
    duration: 30m
`;

const dayParts = `# No plugins: routines built on day parts, with fallbacks.

config:
  time_zone: Europe/Berlin   # clocks went back on Oct 25
  horizon_days: 7
  day_parts:                 # change, add, or remove (null) day parts
    morning: { start: "07:00", end: "12:00" }

anchors:
  - id: work
    on: [mon, tue, wed, thu, fri]
    start: "09:00"
    end: "17:00"
    busy: true
  - id: gym_hours
    on: [mon, wed, fri]
    start: "18:00"
    end: "21:00"

tasks:
  - id: plan-day
    title: Plan the day
    duration: 15m
    repeat: daily
    at: morning

  - id: run
    title: Run
    duration: 30m
    repeat: { on: [tue, thu, sat] }
    window:
      within: morning

  - id: gym
    title: Gym
    duration: 1h
    repeat: daily
    window:
      within: gym_hours or evening

  - id: read
    title: Read
    duration: 30m
    repeat: daily
    window:
      within: night
    prefer: latest

  - id: deep-work
    title: Deep work
    duration: 2h
    repeat: { on: [sat, sun] }
    window:
      within: morning or afternoon

  - id: rent
    title: Pay rent
    duration: 15m
    repeat: { every: month, on_day: 31 }
    window:
      within: evening
`;

const packing = `# Fragmentation: free gaps of 2h (Mon), 1h (Tue) and 45m (Wed).
# Three tasks: 30m (higher priority, so it goes first), 1h and 1h45m.
#
# With "earliest", the 30m task takes the start of Monday's 2h gap and the
# 1h45m task no longer fits anywhere. Change all three to "packed" (smallest
# gap that fits) and everything fits.

config:
  time_zone: UTC
  horizon_days: 3

events:
  - { id: busy-mon, date: 2026-10-26, start: "10:00", end: "12:00" }
  - { id: busy-tue, date: 2026-10-27, start: "09:00", end: "12:00" }
  - { id: busy-wed, date: 2026-10-28, start: "08:45", end: "12:00" }

tasks:
  - id: short
    duration: 30m
    priority: 1
    window: { after: "08:00", before: "12:00" }
    deadline: 2026-10-28
    prefer: earliest

  - id: medium
    duration: 1h
    window: { after: "08:00", before: "12:00" }
    deadline: 2026-10-28
    prefer: earliest

  - id: long
    duration: 1h45m
    window: { after: "08:00", before: "12:00" }
    deadline: 2026-10-28
    prefer: earliest
`;

export const PRESETS: readonly Preset[] = [
  // 05:45 in Cairo, just after Fajr.
  { name: 'Prayer routine', now: '2026-10-25T02:45:00Z', source: prayerRoutine },
  { name: 'No plugins: day parts', now: '2026-10-25T06:00:00Z', source: dayParts },
  { name: 'Packing (fragmentation)', now: '2026-10-26T06:00:00Z', source: packing },
];
