# sword-playground

A local testing UI for the [Sword](../sword) scheduling engine. The engine runs
directly in the browser; there is no server.

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

It expects the `sword` repo next to this one (`../sword`), and links
`@sword/engine` and `@sword/schema` from there, so engine changes show up on
reload.

## What it does

- **Left:** one YAML document. `config` is `sword.yaml`, `tasks` use the
  task-file frontmatter format, and `prayer`, `anchors` and `events` stand in
  for plugins and calendars that don't exist yet. The schedule updates as you
  type; on errors the last good plan stays on screen.
- **Calendar:** day or week view. Prayer and other busy time is hatched; day
  parts and anchor windows are the thin rails on the left; tasks are colored
  by kind (fitted blue, formula purple, pinned orange, done green, missed
  dashed red). Changed tasks flash.
- **Click** a task for its details and the engine's reason. **Drag** it to pin
  it to a new time. Mark it done, unpin it, or forget its placement.
- **Now:** move time forward or back to see tasks get missed, and to check that
  anything already started stays put.
- **Panels:** unplaced (with reasons), conflicts, missed, inbox, the last
  change, and problems.

Every plan is applied right away and fed back in as the existing placements,
the way the real app will store them, so stability is visible. State is kept in
`localStorage`; **Reset state** clears pins, done marks and stored placements.

`?preset=N` loads a preset and `?view=day` opens the day view.

## Prayer times

The `prayer` section uses the [adhan](https://github.com/batoulapps/adhan-js)
library as a stand-in for the `sword-prayer` plugin. It is for testing only.

## Tests

```sh
pnpm test         # model: document parsing, prayer anchors, presets
pnpm e2e          # browser smoke test; start `pnpm dev` first
```

`pnpm e2e` uses a Chromium from the Playwright cache, or `CHROMIUM_PATH`.
