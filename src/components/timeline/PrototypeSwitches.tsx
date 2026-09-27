'use client'

import type { LongSpanVariant } from './LongSpans'
import type { ShortSpanStyle } from './SpanBar'

export interface PrototypeSwitchesProps {
  shortSpanStyle: ShortSpanStyle
  onShortSpanStyle: (v: ShortSpanStyle) => void
  longSpanVariant: LongSpanVariant
  onLongSpanVariant: (v: LongSpanVariant) => void
}

/** Temporary switches to compare the open design variants (issues #11 and #12); removed once decided. */
export function PrototypeSwitches({ shortSpanStyle, onShortSpanStyle, longSpanVariant, onLongSpanVariant }: PrototypeSwitchesProps) {
  const select = 'rounded-sm border border-border bg-surface-raised px-1 py-0.5 text-xs text-fg focus-visible:outline-2 focus-visible:outline-focus'
  return (
    <fieldset
      data-no-drag
      className="absolute bottom-2 left-2 z-40 flex items-center gap-2 rounded-md border border-border bg-surface-raised/90 px-2 py-1 text-xs text-fg-muted"
    >
      <legend className="sr-only">Prototyp-Schalter</legend>
      <label className="flex items-center gap-1">
        Kurze Zeitspannen
        <select className={select} value={shortSpanStyle} onChange={(e) => onShortSpanStyle(e.target.value as ShortSpanStyle)}>
          <option value="uniform">einfarbig</option>
          <option value="faded">verlaufend</option>
        </select>
      </label>
      <label className="flex items-center gap-1">
        Lange Zeitspannen
        <select className={select} value={longSpanVariant} onChange={(e) => onLongSpanVariant(e.target.value as LongSpanVariant)}>
          <option value="bar">nur Balken</option>
          <option value="background">Hintergrund</option>
          <option value="bracket">Klammer</option>
        </select>
      </label>
    </fieldset>
  )
}
