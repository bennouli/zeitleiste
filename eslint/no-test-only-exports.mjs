import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const IMPORT_PATTERN =
    /(?:import|export)\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+\w+|\*)?\s*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const EVERYTHING = Symbol('every export')

/** Files that consume exports: production sources only, never the tests. */
function* sourceFiles(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (name === '__tests__' || name === 'node_modules') continue
        if (statSync(path).isDirectory()) yield* sourceFiles(path)
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
function buildUsageIndex(root) {
    const usage = new Map()
    const record = (key, name) => {
        const names = usage.get(key)
        if (names === EVERYTHING) return
        if (name === EVERYTHING) usage.set(key, EVERYTHING)
        else if (names) names.add(name)
        else usage.set(key, new Set([name]))
    }
    for (const file of sourceFiles(join(root, 'src'))) {
        const text = readFileSync(file, 'utf8')
        for (const match of text.matchAll(IMPORT_PATTERN)) {
            const [, defaultName, braces, source, dynamicSource] = match
            const key = resolveSource(source ?? dynamicSource, file, root)
            if (!key) continue
            if (dynamicSource || (!defaultName && !braces)) {
                record(key, EVERYTHING)
                continue
            }
            if (defaultName) record(key, 'default')
            for (const name of importedNames(braces ?? '')) record(key, name)
        }
    }
    return usage
}

const indexes = new Map()
function usageIndex(root) {
    if (!indexes.has(root)) indexes.set(root, buildUsageIndex(root))
    return indexes.get(root)
}

function exportedNames(node) {
    if (node.declaration) {
        const declaration = node.declaration
        if (declaration.id) return [declaration.id.name]
        if (declaration.declarations) {
            return declaration.declarations.flatMap((d) =>
                d.id.type === 'Identifier' ? [d.id.name] : []
            )
        }
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

/**
 * AGENTS.md § Code Style: a helper that only the tests read is not a bare export. It goes in
 * PRIVATE_UNDER_TESTS; everything else a module exports is imported by production code.
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
                    exempt: { type: 'array', items: { type: 'string' } },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            testOnly:
                "'{{name}}' is exported but nothing outside the tests imports it. Keep it private, or put it in PRIVATE_UNDER_TESTS if a test needs it.",
        },
    },
    create(context) {
        const root = context.cwd
        const filename = context.filename
        const exempt = context.options[0]?.exempt ?? []
        if (exempt.some((prefix) => filename.startsWith(resolve(root, prefix))))
            return {}
        const used = usageIndex(root).get(moduleKey(filename))
        if (used === EVERYTHING) return {}
        return {
            ExportNamedDeclaration(node) {
                if (node.exportKind === 'type' || node.source) return
                for (const name of exportedNames(node)) {
                    if (name === 'PRIVATE_UNDER_TESTS' || used?.has(name))
                        continue
                    context.report({
                        node,
                        messageId: 'testOnly',
                        data: { name },
                    })
                }
            },
        }
    },
}

export default noTestOnlyExports
