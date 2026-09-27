const FOCUSABLE = 'button, [tabindex="0"]'

/** The element now representing one of `ids`: its card, else the stack or marker holding it. */
export function findFocusTarget(root: HTMLElement, ids: string[]): HTMLElement | null {
  for (const id of ids) {
    const q = CSS.escape(id)
    const own = root.querySelector<HTMLElement>(`[data-entry-id="${q}"], [data-span-id="${q}"]`)
    if (own) {
      const hidden = own.closest<HTMLElement>('[inert]')
      if (hidden) {
        const stack = hidden.closest<HTMLElement>('[role="group"][tabindex]')
        if (stack) return stack
      } else {
        const el = own.matches(FOCUSABLE) ? own : own.querySelector<HTMLElement>(FOCUSABLE)
        if (el) return el
      }
    }
    const holder = root.querySelector<HTMLElement>(`[data-entry-ids~="${q}"]`)
    const el = holder?.querySelector<HTMLElement>(FOCUSABLE)
    if (el) return el
  }
  return null
}
