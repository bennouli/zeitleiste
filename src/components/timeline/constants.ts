import { MS_PER_YEAR } from '@/lib/time'

/** Height of the axis band (line, ticks, labels, "Heute" mark). */
export const AXIS_HEIGHT_PX = 56
/** Height of the top bar (wordmark, language switch, zoom controls); no card row reaches into it. */
export const TOP_BAR_HEIGHT_PX = 44
/** Distance from the axis line to the nearest edge of the first card row. */
export const CARD_FIRST_ROW_OFFSET_PX = 32
/** Vertical pitch of one card row above/below the axis. */
export const CARD_ROW_HEIGHT_PX = 57
/** Visible time span when a post opens (the entry is centered). */
export const FOCUS_VISIBLE_MS = 40 * MS_PER_YEAR
/** Height of the timeline while a post is open. */
export const COLLAPSED_HEIGHT = '50dvh'
/** Duration of zoom/pan animations (eased out). */
export const ZOOM_ANIMATION_MS = 300
/** Duration of the height transition when a post opens or closes; matches `duration-500` on the timeline. */
export const COLLAPSE_ANIMATION_MS = 500
/** Minimum horizontal gap between two cards in a row; also the room kept beside a card anchored on either end of the range. */
export const CARD_GAP_PX = 8
/** Points closer than this sit on one spot and always form a group; otherwise grouping only happens when no card slot is free. */
export const CLUSTER_MIN_GAP_PX = 8
/** A merged group may span at most this many px; wider merges would put the marker far from its members. */
export const MAX_GROUP_SPAN_PX = 352
/** Keyboard pan step as a fraction of the width. */
export const KEY_PAN_FRACTION = 0.1
/** How long a label stays ringed after its span bar is clicked. */
export const BAR_HIGHLIGHT_MS = 1000
/** Fade-out of that ring; matches `duration-300` on the label. */
export const BAR_HIGHLIGHT_FADE_MS = 300
/** How long the wordmark reads «линия» before the first letter is replaced. */
export const WORDMARK_HOLD_MS = 400
/** Time per replaced letter of the wordmark; five steps after the hold end the change at 1500 ms. */
export const WORDMARK_STEP_MS = 220
