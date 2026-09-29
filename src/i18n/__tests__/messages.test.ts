import { containsText, germanOnlyTexts } from '@/test/germanTexts'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(import.meta.dirname, '../..')
const NOT_INTERFACE = [
    /^i18n\//,
    /(^|\/)__tests__\//,
    /^test\//,
    /^collections\//,
    /^data\//,
    /^migrations\//,
    /^payload-types\.ts$/,
    /^email\.ts$/,
]

describe('German interface texts', () => {
    const germanTexts = germanOnlyTexts()

    it('are collected from string leaves and the words of grammar functions', () => {
        expect(germanTexts).toEqual(
            expect.arrayContaining([
                'Heute',
                'Beitrag schließen',
                'Gruppe mit',
                'Einträgen',
                'von',
            ])
        )
        expect(germanTexts).not.toContain('Revolution')
        expect(germanTexts).not.toContain('Liniya')
    })

    it('are found when copied into a component', () => {
        const component = 'export const Today = () => <span>Heute</span>'
        expect(untranslatedIn(component, germanTexts)).toEqual(['Heute'])
    })

    it('appear nowhere in the source outside the translation files', () => {
        const found = interfaceSourceFiles().flatMap((file) =>
            untranslatedIn(
                readFileSync(path.join(SRC, file), 'utf8'),
                germanTexts
            ).map((text) => `${file}: ${text}`)
        )
        expect(found).toEqual([])
    })
})

function interfaceSourceFiles(): string[] {
    return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
        .map((file) => file.split(path.sep).join('/'))
        .filter((file) => /\.tsx?$/.test(file))
        .filter((file) => !NOT_INTERFACE.some((pattern) => pattern.test(file)))
}

function untranslatedIn(source: string, germanTexts: string[]): string[] {
    const literals = literalTexts(source)
    return germanTexts.filter((text) =>
        literals.some((literal) => containsText(literal, text))
    )
}

function literalTexts(source: string): string[] {
    const file = ts.createSourceFile(
        'source.tsx',
        source,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TSX
    )
    const texts: string[] = []
    const visit = (node: ts.Node) => {
        if (
            ts.isStringLiteralLike(node) ||
            ts.isTemplateLiteralToken(node) ||
            ts.isJsxText(node)
        )
            texts.push(node.text)
        node.forEachChild(visit)
    }
    visit(file)
    return texts
}
