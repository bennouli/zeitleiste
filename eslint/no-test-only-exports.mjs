import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm
const IMPORT_PATTERN =
    /(?:import|export)\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}|(\*\s+as\s+\w+|\*))?\s*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const EVERYTHING = Symbol('every export')

/** Production sources: never the tests, never the test support. */
function* sourceFiles(dir, skip) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (name === '__tests__' || skip.has(path)) continue
        if (statSync(path).isDirectory()) yield* sourceFiles(path, skip)
        else if (
            SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext)) &&
            !/\.test\.tsx?$/.test(name)
        )
            yield path
    }
}

function moduleKey(path) {
    return path.replace(/\.(tsx?|js)$/, '').replace(/\/index$/, '')
}

function resolveSource(source, importer, root) {
    if (source.startsWith('@/'))
        return moduleKey(resolve(root, 'src', source.slice(2)))
    if (source.startsWith('.'))
        return moduleKey(resolve(dirname(importer), source))
    return null
}

function importedNames(braces) {
    return braces
        .split(',')
        .map((part) => part.trim().replace(/^type\s+/, ''))
        .filter(Boolean)
        .map((part) => part.split(/\s+as\s+/)[0].trim())
}

/** module key → set of imported names, or EVERYTHING for namespace imports and re-exports. */
function buildUsageIndex(root, testSupport) {
    const usage = new Map()
    const record = (key, name) => {
        const names = usage.get(key)
        if (names === EVERYTHING) return
        if (name === EVERYTHING) usage.set(key, EVERYTHING)
        else if (names) names.add(name)
        else usage.set(key, new Set([name]))
    }
    const skip = new Set(testSupport.map((dir) => resolve(root, dir)))
    for (const file of sourceFiles(join(root, 'src'), skip)) {
        const text = readFileSync(file, 'utf8').replace(COMMENT_PATTERN, '$1')
        for (const match of text.matchAll(IMPORT_PATTERN)) {
            const [, defaultName, braces, namespace, source, dynamicSource] =
                match
            const key = resolveSource(source ?? dynamicSource, file, root)
            if (!key) continue
            if (dynamicSource || namespace || (!defaultName && !braces))
                record(key, EVERYTHING)
            if (defaultName) record(key, 'default')
            for (const name of importedNames(braces ?? '')) record(key, name)
        }
    }
    return usage
}

const indexes = new Map()
function usageIndex(root, testSupport) {
    if (!indexes.has(root))
        indexes.set(root, buildUsageIndex(root, testSupport))
    return indexes.get(root)
}

function patternNames(pattern) {
    switch (pattern.type) {
        case 'Identifier':
            return [pattern.name]
        case 'ObjectPattern':
            return pattern.properties.flatMap((p) =>
                patternNames(p.type === 'RestElement' ? p.argument : p.value)
            )
        case 'ArrayPattern':
            return pattern.elements.flatMap((e) =>
                e ? patternNames(e.type === 'RestElement' ? e.argument : e) : []
            )
        case 'AssignmentPattern':
            return patternNames(pattern.left)
        default:
            return []
    }
}

function exportedNames(node) {
    if (node.declaration) {
        const declaration = node.declaration
        if (declaration.id) return [declaration.id.name]
        if (declaration.declarations)
            return declaration.declarations.flatMap((d) => patternNames(d.id))
        return []
    }
    return node.specifiers
        .filter((s) => s.exportKind !== 'type')
        .map((s) =>
            s.exported.type === 'Identifier'
                ? s.exported.name
                : s.exported.value
        )
}

function isUnder(filename, dir) {
    return filename === dir || filename.startsWith(dir + sep)
}

/**
 * Reports an export that no production module imports. Imports are read from the source text
 * with comments stripped; `export * from` counts as using everything of its target, and a
 * long-running lint server keeps the index of its first run.
 */
const noTestOnlyExports = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'exports must have a consumer outside the tests, or sit in PRIVATE_UNDER_TESTS',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    root: { type: 'string' },
                    entryPoints: { type: 'array', items: { type: 'string' } },
                    testSupport: { type: 'array', items: { type: 'string' } },
                },
                required: ['root'],
                additionalProperties: false,
            },
        ],
        messages: {
            testOnly:
                "'{{name}}' is exported but nothing outside the tests imports it. Keep it private, or put it in PRIVATE_UNDER_TESTS if a test needs it.",
        },
    },
    create(context) {
        const { root, entryPoints = [], testSupport = [] } = context.options[0]
        const filename = context.filename
        const exempt = [...entryPoints, ...testSupport].map((dir) =>
            resolve(root, dir)
        )
        if (exempt.some((dir) => isUnder(filename, dir))) return {}
        const used = usageIndex(root, testSupport).get(moduleKey(filename))
        if (used === EVERYTHING) return {}
        const report = (node, name) => {
            if (name === 'PRIVATE_UNDER_TESTS' || used?.has(name)) return
            context.report({ node, messageId: 'testOnly', data: { name } })
        }
        return {
            ExportNamedDeclaration(node) {
                if (node.exportKind === 'type' || node.source) return
                for (const name of exportedNames(node)) report(node, name)
            },
            ExportDefaultDeclaration(node) {
                report(node, 'default')
            },
        }
    },
}

export default noTestOnlyExports
