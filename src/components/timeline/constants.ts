import { MS_PER_YEAR } from '@/lib/time'

/** Height of the axis band (line, ticks, labels, "Heute" mark). */
export const AXIS_HEIGHT_PX = 56
/** Default vertical pitch of one card row above/below the axis. */
export const CARD_ROW_HEIGHT_PX = 88
/** Height of one lane in the span band. */
export const SPAN_LANE_HEIGHT_PX = 28
/** Visible time span when a post opens (the entry is centered). */
export const FOCUS_VISIBLE_MS = 40 * MS_PER_YEAR
/** Height of the timeline while a post is open. */
export const COLLAPSED_HEIGHT = '50dvh'
/** Duration of zoom/pan animations and the height transition. */
export const ANIMATION_MS = 350
/** Minimum horizontal gap between two cluster anchors before they merge into a group. */
export const CLUSTER_MIN_GAP_PX = 24
/** A press that moves less than this is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 6
/** Keyboard pan step as a fraction of the width. */
export const KEY_PAN_FRACTION = 0.1
