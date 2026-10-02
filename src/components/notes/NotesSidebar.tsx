'use client'

import { useI18n } from '@/components/I18nContext'
import clsx from 'clsx'
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'
import { useNotes } from './NotesContext'
import { NOTES_ASIDE_ID, useNotesOverlay } from './NotesOverlayContext'
import { NotesPanel } from './NotesPanel'
import { ICON_BUTTON_CLASS, LARGE_ICON_BUTTON_CLASS } from './noteStyles'
import { useNotesOverlayMode } from './useNotesOverlayMode'
import { useSidebarCollapsed } from './useSidebarCollapsed'

/**
 * The one notes panel on the page; nothing for a visitor. From `lg` up it is the collapsible sidebar; below, it stays hidden
 * until the top-bar button opens it over the page.
 */
export function NotesSidebar() {
    const { t } = useI18n()
    const { signedIn } = useNotes()
    const { open, closeOverlay } = useNotesOverlay()
    const [collapsed, setCollapsed] = useSidebarCollapsed()
    const panelId = useId()
    const asideRef = useRef<HTMLElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const collapseButtonRef = useRef<HTMLButtonElement>(null)
    useNotesOverlayMode({
        asideRef,
        focusOnOpenRef: closeButtonRef,
        focusWhenPanelHidesRef: collapseButtonRef,
    })

    if (!signedIn) return null

    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return
        e.preventDefault()
        if (open) closeOverlay(true)
    }

    return (
        <aside
            ref={asideRef}
            id={NOTES_ASIDE_ID}
            aria-label={t.notes.heading}
            onKeyDown={onKeyDown}
            className={clsx(
                'flex-col bg-surface',
                open
                    ? 'max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:flex'
                    : 'max-lg:hidden',
                'lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:border-l lg:border-border',
                collapsed ? 'lg:w-auto' : 'lg:w-sidebar'
            )}
        >
            <div className="flex items-center justify-between gap-2 px-2 py-2">
                <h2
                    className={clsx(
                        'small-caps px-2 text-label-lg tracking-wordmark text-fg-muted',
                        collapsed && 'lg:hidden'
                    )}
                >
                    {t.notes.heading}
                </h2>
                <button
                    ref={collapseButtonRef}
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-expanded={!collapsed}
                    aria-controls={panelId}
                    aria-label={collapsed ? t.notes.expand : t.notes.collapse}
                    title={collapsed ? t.notes.expand : t.notes.collapse}
                    className={clsx(ICON_BUTTON_CLASS, 'max-lg:hidden')}
                >
                    {collapsed ? (
                        <PanelRightOpen
                            aria-hidden
                            size={18}
                            strokeWidth={1.5}
                        />
                    ) : (
                        <PanelRightClose
                            aria-hidden
                            size={18}
                            strokeWidth={1.5}
                        />
                    )}
                </button>
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => closeOverlay(true)}
                    aria-label={t.notes.close}
                    title={t.notes.close}
                    className={clsx(LARGE_ICON_BUTTON_CLASS, 'lg:hidden')}
                >
                    <X
                        aria-hidden="true"
                        className="size-full"
                        strokeWidth={1.25}
                    />
                </button>
            </div>
            <div
                id={panelId}
                hidden={collapsed && !open}
                className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
            >
                <NotesPanel />
            </div>
        </aside>
    )
}
