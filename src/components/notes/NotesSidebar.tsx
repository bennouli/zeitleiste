'use client'

import { useI18n } from '@/components/I18nContext'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useId } from 'react'
import { useNotes } from './NotesContext'
import { NotesPanel } from './NotesPanel'
import { iconButtonClass } from './noteStyles'
import { useSidebarCollapsed } from './useSidebarCollapsed'

/** The notes beside the page from the `lg` breakpoint up; nothing for a visitor. */
export function NotesSidebar() {
    const { t } = useI18n()
    const { signedIn } = useNotes()
    const [collapsed, setCollapsed] = useSidebarCollapsed()
    const panelId = useId()
    if (!signedIn) return null
    return (
        <aside
            aria-label={t.notes.heading}
            className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-l border-border bg-surface lg:flex ${collapsed ? 'w-auto' : 'w-sidebar'}`}
        >
            <div className="flex items-center justify-between gap-2 px-2 py-2">
                {!collapsed && (
                    <h2 className="small-caps px-2 text-label-lg tracking-wordmark text-fg-muted">
                        {t.notes.heading}
                    </h2>
                )}
                <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-expanded={!collapsed}
                    aria-controls={panelId}
                    aria-label={collapsed ? t.notes.expand : t.notes.collapse}
                    title={collapsed ? t.notes.expand : t.notes.collapse}
                    className={iconButtonClass}
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
            </div>
            <div
                id={panelId}
                hidden={collapsed}
                className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
            >
                <NotesPanel />
            </div>
        </aside>
    )
}
