import { toast, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESEND_TEXT, useResendInvitation } from '../useResendInvitation'

vi.mock('@payloadcms/ui', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
    useAuth: vi.fn(),
    useConfig: () => ({ config: { routes: { api: '/api' } } }),
    useDocumentInfo: vi.fn(),
    useFormFields: vi.fn(),
}))

type Scene = {
    role: 'admin' | 'editor'
    id?: number
    acceptedAt?: string
}

const showScene = ({ role, id, acceptedAt }: Scene) => {
    vi.mocked(useAuth).mockReturnValue({ user: { role } } as never)
    vi.mocked(useDocumentInfo).mockReturnValue({ id } as never)
    vi.mocked(useFormFields).mockImplementation((selector) =>
        selector([
            { invitationAcceptedAt: { value: acceptedAt } },
            () => {},
        ] as never)
    )
}

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

describe('useResendInvitation', () => {
    it('is visible to an admin on a pending invitation', () => {
        const scene: Scene = { role: 'admin', id: 7 }
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        expect(result.current.visible).toBe(true)
    })

    it('is hidden once the invitation is accepted', () => {
        const scene: Scene = {
            role: 'admin',
            id: 7,
            acceptedAt: '2026-09-01T00:00:00Z',
        }
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        expect(result.current.visible).toBe(false)
    })

    it('is hidden from an editor', () => {
        const scene: Scene = { role: 'editor', id: 7 }
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        expect(result.current.visible).toBe(false)
    })

    it('is hidden on the create form', () => {
        const scene: Scene = { role: 'admin' }
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        expect(result.current.visible).toBe(false)
    })

    it('posts to the invite endpoint and confirms', async () => {
        const scene: Scene = { role: 'admin', id: 7 }
        const fetchMock = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchMock)
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        act(() => result.current.resend())
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(RESEND_TEXT.sent)
        )
        expect(fetchMock).toHaveBeenCalledWith('/api/users/7/invite', {
            method: 'POST',
            credentials: 'include',
        })
        expect(result.current.pending).toBe(false)
    })

    it('reports a failed request', async () => {
        const scene: Scene = { role: 'admin', id: 7 }
        const fetchMock = vi.fn().mockResolvedValue({ ok: false })
        vi.stubGlobal('fetch', fetchMock)
        showScene(scene)
        const { result } = renderHook(useResendInvitation)
        act(() => result.current.resend())
        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(RESEND_TEXT.failed)
        )
    })
})
