import { afterEach, describe, expect, it } from 'vitest'
import { inertOutside } from '../inertOutside'

const PAGE = `
    <header id="header"></header>
    <div id="layout">
        <main id="main"></main>
        <aside id="notes"><button id="close"></button></aside>
    </div>
    <div id="already" inert></div>
`

afterEach(() => {
    document.body.innerHTML = ''
})

const byId = (id: string) => document.getElementById(id)!

describe('inertOutside', () => {
    it('makes every sibling of the element and of its ancestors inert, and nothing inside it', () => {
        document.body.innerHTML = PAGE
        const notes = byId('notes')

        inertOutside(notes)

        for (const id of ['header', 'main', 'already'])
            expect(byId(id)).toHaveAttribute('inert')
        for (const id of ['layout', 'notes', 'close'])
            expect(byId(id)).not.toHaveAttribute('inert')
    })

    it('undoes only what it did', () => {
        document.body.innerHTML = PAGE
        const notes = byId('notes')
        const restore = inertOutside(notes)

        restore()

        expect(byId('header')).not.toHaveAttribute('inert')
        expect(byId('main')).not.toHaveAttribute('inert')
        expect(byId('already')).toHaveAttribute('inert')
    })
})
