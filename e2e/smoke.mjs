// Smoke test in a real browser. Start the dev server first (pnpm dev), then: pnpm e2e
// Uses a cached Playwright Chromium, or set CHROMIUM_PATH. Set URL if the server is elsewhere.
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.CHROMIUM_PATH ? null : `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1243`;
const executablePath = process.env.CHROMIUM_PATH ?? `${base}/${readdirSync(base).find((d) => d.startsWith('chrome-headless-shell'))}/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) process.exitCode = 1; };
const count = async (tab) => Number(await page.locator('.tabs button', { hasText: tab }).locator('.count').innerText());

await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?preset=0`);
await page.waitForSelector('.block.task');

// Click: details with the engine's reason.
await page.locator('.column').first().locator('.block.task', { hasText: 'quran' }).click();
const selected = await page.locator('.panel-body .selected').innerText();
check(selected.includes('formula') && selected.includes('Why: at prayer.fajr.busy.end + 5m'), 'clicking a task shows its kind and why');

// Drag: pin Sunday's study one hour later.
const study = page.locator('.column').first().locator('.block.task', { hasText: 'study' });
const before = (await study.locator('.task-time').innerText()).slice(0, 5);
const [h, m] = before.split(':').map(Number);
const expected = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const box = await study.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y + 8 + 66, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const pinned = page.locator('.column').first().locator('.block.task.pinned');
check((await pinned.count()) === 1 && (await pinned.innerText()).includes(expected), `dragging a task down 1h pins it at the new time (${before} → ${expected})`);
await page.locator('.tabs button', { hasText: 'Last change' }).click();
check((await page.locator('.panel-body').innerText()).includes('pinned to a new time'), 'the change list explains the move');

// Done: mark Sunday's quran done.
await page.locator('.column').first().locator('.block.task', { hasText: 'quran' }).click();
await page.getByRole('button', { name: 'Mark done' }).click();
await page.waitForTimeout(200);
check((await page.locator('.column').first().locator('.block.task.done').count()) === 1, 'marking done turns the block green');

// Time travel: a day later, Sunday's unfinished tasks become missed.
await page.getByRole('button', { name: '+1d' }).click();
await page.waitForTimeout(400);
const missed = await count('Missed');
check(missed >= 2, `moving now forward a day marks unfinished tasks missed (${missed})`);
await page.locator('.tabs button', { hasText: 'Missed' }).click();
const missedList = await page.locator('.panel-body').innerText();
check(missedList.includes('study@2026-10-25') && !missedList.includes('quran@2026-10-25'), 'the done task is not listed as missed');

// A document error keeps the last good plan on screen.
await page.locator('.cm-content').click();
await page.keyboard.press('Control+End');
await page.keyboard.type('\n  - { id: broken, duration: 45 }');
await page.waitForTimeout(500);
check(await page.locator('.badge.error').isVisible(), 'a document error shows a badge');
check((await page.locator('.block.task').count()) > 0, 'the last good plan stays visible');

// Layout: the divider resizes the editor, and the editor can be hidden.
const editorPane = page.locator('.editor-pane');
const widthBefore = (await editorPane.boundingBox()).width;
const divider = await page.locator('.splitter').boundingBox();
await page.mouse.move(divider.x + 2, divider.y + 300);
await page.mouse.down();
await page.mouse.move(divider.x + 152, divider.y + 300, { steps: 6 });
await page.mouse.up();
const widthAfter = (await editorPane.boundingBox()).width;
check(Math.abs(widthAfter - widthBefore - 150) <= 2, `dragging the divider resizes the editor (${widthBefore}px → ${widthAfter}px)`);
await page.getByRole('button', { name: 'Hide editor' }).click();
check(!(await editorPane.isVisible()), 'the editor can be hidden');
await page.getByRole('button', { name: 'Show editor' }).click();

// Smaller windows: nothing sticks out of the window; narrow ones stack the editor on top.
for (const [width, height] of [[1050, 760], [620, 900]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(300);
  const sticking = await page.evaluate(() =>
    [...document.querySelectorAll('.topbar button, .topbar select, .topbar input, .panels, .grid-scroll')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length,
  );
  check(sticking === 0, `at ${width}px wide, every control fits in the window`);
}
const pane = await editorPane.boundingBox();
const calendar = await page.locator('.grid-scroll').boundingBox();
check(pane.y + pane.height <= calendar.y, 'a narrow window stacks the editor above the calendar');

await page.screenshot({ path: 'e2e/last-run.png' });
check(problems.length === 0, `no console errors${problems.length ? `: ${problems.join(' | ')}` : ''}`);
await browser.close();
