export type TodayAlign = 'left' | 'center' | 'right'

/** Half the widest today label: "Today" in Google Sans 500 at 12 px with the 8 px padding of an edge alignment measures 51.6 px. */
const TODAY_LABEL_HALF_WIDTH_PX = 26
/** Free space kept between a tick label and the today label. */
const LABEL_CLEARANCE_PX = 8

/** Where the today label sits relative to today's x, so it never leaves the timeline. */
export function todayAlignment(todayX: number, width: number): TodayAlign {
    if (todayX > width - TODAY_LABEL_HALF_WIDTH_PX) return 'right'
    if (todayX < TODAY_LABEL_HALF_WIDTH_PX) return 'left'
    return 'center'
}

/** Whether a tick label centred on `tickX`, `labelWidthPx` wide, would run into the today label. */
export function overlapsTodayLabel(
    tickX: number,
    labelWidthPx: number,
    todayX: number,
    align: TodayAlign
): boolean {
    const todayWidth = 2 * TODAY_LABEL_HALF_WIDTH_PX
    const todayX0 =
        align === 'right'
            ? todayX - todayWidth
            : align === 'center'
              ? todayX - todayWidth / 2
              : todayX
    const halfLabel = labelWidthPx / 2
    return (
        tickX + halfLabel + LABEL_CLEARANCE_PX > todayX0 &&
        tickX - halfLabel - LABEL_CLEARANCE_PX < todayX0 + todayWidth
    )
}

export const PRIVATE_UNDER_TESTS = {
    LABEL_CLEARANCE_PX,
    TODAY_LABEL_HALF_WIDTH_PX,
}
