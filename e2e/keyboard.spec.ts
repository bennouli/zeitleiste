import { expect, test, type Page } from '@playwright/test'
import { entries } from '../src/data/entries'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const ORDER = new Map(entries.map((e, i) => [e.id, i]))
const MAX_TABS = 120

interface Focused {
  name: string
  role: string | null
  /** Entries the focused element stands for: its card, stack, marker or span bar. */
  ids: string[]
  t: number | null
  inPoints: boolean
  inSpans: boolean
  outline: string
}

function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const holder = el.closest<HTMLElement>('[data-entry-id], [data-span-id], [data-entry-ids]')
    const ids = holder
      ? (holder.dataset.entryId ?? holder.dataset.spanId ?? holder.dataset.entryIds ?? '').split(' ').filter(Boolean)
      : []
    const t = el.closest<HTMLElement>('[data-t]')?.dataset.t
    const style = getComputedStyle(el)
    return {
      name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
      role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
      ids,
      t: t === undefined ? null : Number(t),
      inPoints: el.closest('[data-layer="points"]') !== null,
      inSpans: el.closest('[data-layer="spans"]') !== null,
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
    }
  })
}

const view = async (page: Page) => {
  const region = page.getByRole('region', { name: 'Zeitleiste' })
  const start = Number(await region.getAttribute('data-view-start'))
  const end = Number(await region.getAttribute('data-view-end'))
  return { start, end, span: end - start }
}

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Zeitleiste' })).toHaveAttribute('data-view-start', /\d/)
}

test('Tab reaches the region first, then the entries in chronological order', async ({ page }) => {
  await ready(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('region', { name: 'Zeitleiste' })).toBeFocused()

  const firstThree: Focused[] = []
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab')
    firstThree.push(await focused(page))
  }
  for (const f of firstThree) {
    expect(f.inPoints).toBe(true)
    expect(f.ids.length).toBeGreaterThan(0)
  }
  // Chronological per the sample data (which is sorted by start) and by anchor time.
  const firstIndex = firstThree.map((f) => Math.min(...f.ids.map((id) => ORDER.get(id)!)))
  expect(firstIndex).toEqual([...firstIndex].sort((a, b) => a - b))
  const times = firstThree.map((f) => f.t!)
  expect(times).toEqual([...times].sort((a, b) => a - b))
})

for (const [label, size] of [
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`every entry is reachable with the keyboard, with a visible focus, without scrolling the timeline (${label})`, async ({ page }) => {
    await page.setViewportSize(size)
    await ready(page)
    const region = page.getByRole('region', { name: 'Zeitleiste' })
    const seen = new Set<string>()
    const pointTimes: number[] = []
    const spanTimes: number[] = []
    await page.keyboard.press('Tab')
    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab')
      const f = await focused(page)
      if (f.name === 'Hineinzoomen') break
      expect(f.outline, `focus visible on "${f.name}"`).not.toMatch(/^none|0px$/)
      if (f.role === 'group' && f.name.startsWith('Gruppe mit')) {
        // Step through the stack; each step shows the next entry.
        const stack = page.locator(':focus')
        for (let step = 0; step < f.ids.length; step++) {
          const shown = await stack.locator('li:not([inert]) [data-entry-id]').evaluateAll((els) =>
            els.map((el) => (el as HTMLElement).dataset.entryId!),
          )
          shown.forEach((id) => seen.add(id))
          await page.keyboard.press('ArrowDown')
        }
        await page.keyboard.press('Home')
      } else if (f.ids.length === 1) {
        seen.add(f.ids[0]!)
      }
      if (f.inPoints && f.t !== null && !f.name.startsWith('Hineinzoomen:')) pointTimes.push(f.t)
      if (f.inSpans && f.t !== null) spanTimes.push(f.t)
    }
    expect([...seen].sort()).toEqual(entries.map((e) => e.id).sort())
    expect(pointTimes).toEqual([...pointTimes].sort((a, b) => a - b))
    expect(spanTimes).toEqual([...spanTimes].sort((a, b) => a - b))
    // overflow: clip — focusing off-screen entries never scrolls the timeline box itself.
    expect(await region.evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  })
}

test('Enter on a group marker zooms into the group and keeps focus in the timeline (phone)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page)
  await page.keyboard.press('Tab')
  let f: Focused | null = null
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    f = await focused(page)
    if (f.name.startsWith('Hineinzoomen: ')) break
  }
  expect(f?.name).toMatch(/^Hineinzoomen: /)
  const before = await view(page)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await view(page)).span).toBeLessThan(before.span)
  await expect.poll(async () => (await focused(page)).ids.some((id) => f!.ids.includes(id))).toBe(true)
})

test('Enter opens a post, focus lands in it, Escape returns to the start page and the entry', async ({ page }) => {
  await ready(page)
  await page.keyboard.press('Tab')
  let f: Focused | null = null
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    f = await focused(page)
    if (f.name.endsWith(', Beitrag') && f.ids.length === 1) break
  }
  expect(f?.name).toMatch(/, Beitrag$/)
  const id = f!.ids[0]!
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/post/${id}$`))
  const heading = page.getByRole('article').getByRole('heading', { level: 2 })
  await expect(heading).toBeFocused()
  await expect(heading).toHaveText(entries.find((e) => e.id === id)!.title)

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect.poll(async () => (await focused(page)).ids).toContain(id)
})

test('+ and - zoom, the arrow keys pan the focused timeline', async ({ page }) => {
  await ready(page)
  await page.keyboard.press('Tab')
  const v0 = await view(page)
  await page.keyboard.press('+')
  await expect.poll(async () => (await view(page)).span).toBeLessThan(v0.span)
  const v1 = await view(page)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await view(page)).start).toBeLessThan(v1.start)
  const v2 = await view(page)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await view(page)).start).toBeGreaterThan(v2.start)
  const v3 = await view(page)
  await page.keyboard.press('-')
  await expect.poll(async () => (await view(page)).span).toBeGreaterThan(v3.span)
})
