# Effect `Schema` patterns

Target: `effect@4.0.0-rc.117` (installed) / `repos/effect` vendored at rc.118. The rc.117 → rc.118 changelog has no
`Schema` API changes; everything below applies to both. Schema is `@stability unstable`: re-check
`repos/effect/packages/effect/SCHEMA.md` after every bump.

Sources, in order of authority:

- `repos/effect/packages/effect/SCHEMA.md` — the guide (7 400 lines; read the section you need)
- `repos/effect/LLMS.md` — Effect-wide conventions (`Effect.gen`, `Effect.fn`, `TaggedError`)
- `repos/effect/migration/schema.md` — v3 → v4 mapping; the source of most "avoid" items
- `repos/effect/packages/effect/test/schema/Schema.test.ts` — behaviour of record, 10 700 lines
- `repos/effect/packages/effect/src/Schema.ts` — JSDoc on every export (`**When to use**`, `**Gotchas**`)

Docs are the contract (AGENTS.md § Libraries). Read `src/**` only to diagnose a failure, never to decide how.

## Ground rules

- Every value that crosses a boundary (request body, JSON file, `localStorage`, `URLSearchParams`, LLM output, CMS
  row) gets a schema and a real decode at the crossing. Inside one module, no schema.
- No hand-written parsing or `typeof` chains for untrusted data. `Predicate` is for narrowing values you already
  trust.
- One schema per shape; derive types from it, never the reverse:

  ```ts
  import { Schema } from "effect"

  export const Locale = Schema.Literals(["de", "en"])
  export type Locale = typeof Locale.Type
  ```

- Schemas are `PascalCase` consts. `Type` is the decoded side, `Encoded` the wire side; they differ whenever a
  transformation is involved (`DateFromString`: `Type = Date`, `Encoded = string`).
- `import { Schema, SchemaGetter, SchemaIssue, SchemaTransformation } from "effect"`. The `effect/schema` barrel
  holds only `Model`, `VariantSchema` and the compilers; do not import `Schema` from there.
- Project rule "types, not interfaces" wins over the guide's `interface` in recursive examples; `type` aliases
  work in every position shown here.

## Constructors and combinators

| Need                       | Write                                                                   |
| -------------------------- | ----------------------------------------------------------------------- |
| primitive                  | `Schema.String`, `Schema.Number`, `Schema.Boolean`, `Schema.BigInt`     |
| finite / integer           | `Schema.Finite`, `Schema.Int`, `Schema.Natural`                         |
| one literal / several      | `Schema.Literal("de")`, `Schema.Literals(["de", "en"])`                 |
| TS enum                    | `Schema.Enum(Direction)`                                                |
| nullable variants          | `Schema.NullOr(S)`, `Schema.UndefinedOr(S)`, `Schema.NullishOr(S)`      |
| object                     | `Schema.Struct({ ... })`                                                |
| key may be absent          | `Schema.optionalKey(S)`                                                 |
| key may be absent or undef | `Schema.optional(S)`                                                    |
| writable key               | `Schema.mutableKey(S)`                                                  |
| list                       | `Schema.Array(S)`, `Schema.NonEmptyArray(S)`, `Schema.UniqueArray(S)`   |
| fixed positions            | `Schema.Tuple([A, B])`, `Schema.TupleWithRest(tuple, [Rest])`           |
| dynamic keys               | `Schema.Record(Schema.String, S)`                                       |
| fixed + dynamic keys       | `Schema.StructWithRest(struct, [Schema.Record(...)])`                   |
| union                      | `Schema.Union([A, B])`, `{ mode: "oneOf" }` for exclusive               |
| discriminated union        | `Schema.TaggedStruct("Point", {...})` + `Schema.Union`, or `TaggedUnion` |
| self-reference             | `Schema.suspend((): Schema.Codec<T> => T)`                              |
| nominal string             | `Schema.String.pipe(Schema.brand("EntryId"))`                           |
| constraint                 | `.check(Schema.isMinLength(1), Schema.isPattern(/…/))`                   |
| custom constraint          | `.check(Schema.makeFilter(predicate, { title, description }))`          |
| narrow the TS type         | `.pipe(Schema.refine((x): x is Narrow => …))`                           |
| metadata                   | `.annotate({ identifier, title, description })`                         |
| per-key metadata           | `.annotateKey({ description, messageMissingKey })`                      |

Checks are values, reusable across schemas, and never change the schema's static shape: `.check(...)` on a
`Struct` still exposes `.fields` and `.make`.

**Example** (a timeline entry, adapted from the `Schema.Class` and tagged-union sections of SCHEMA.md)

```ts
import { Schema } from "effect"

export const EntryId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("EntryId"))
export type EntryId = typeof EntryId.Type

export const Year = Schema.Int.check(Schema.isBetween({ minimum: 1000, maximum: 2100 })).annotate({
  identifier: "Year"
})

export const LocalizedText = Schema.Struct({
  de: Schema.NonEmptyString,
  en: Schema.optionalKey(Schema.NonEmptyString)
})

export const Point = Schema.TaggedStruct("Point", { year: Year })

export const Span = Schema.TaggedStruct("Span", { from: Year, to: Year }).check(
  Schema.makeFilter(
    (span) => (span.from <= span.to ? undefined : { path: ["to"], issue: "to must not precede from" }),
    { title: "ordered span" }
  )
)

export const Entry = Schema.Struct({
  id: EntryId,
  title: LocalizedText,
  summary: LocalizedText,
  when: Schema.Union([Point, Span]),
  publishedAt: Schema.optionalKey(Schema.DateFromString)
})
export type Entry = typeof Entry.Type
export type EntryEncoded = typeof Entry.Encoded
```

### Deriving one schema from another

```ts
import { Schema, Struct } from "effect"

const Base = Schema.Struct({ id: Schema.String, title: Schema.String, body: Schema.String })

const Summary = Base.mapFields(Struct.pick(["id", "title"]))
const Draft = Base.mapFields(Struct.omit(["id"]))
const Patch = Base.mapFields(Struct.map(Schema.optionalKey))
const WithAudit = Base.pipe(Schema.fieldsAssign({ updatedAt: Schema.DateFromString }))
const Reused = Schema.Struct({ ...Base.fields, locale: Schema.Literals(["de", "en"]) })
```

`mapFields` drops struct-level checks. Re-apply them, or pass `{ unsafePreserveChecks: true }` only when the check
still makes sense on the new shape.

### Tagged unions

```ts
import { Schema } from "effect"

const When = Schema.TaggedUnion({
  Point: { year: Schema.Int },
  Span: { from: Schema.Int, to: Schema.Int }
})

declare const value: unknown

When.cases.Span // the member schema
When.guards.Point(value) // type guard
export const label = When.match({
  Point: (p) => String(p.year),
  Span: (s) => `${s.from}–${s.to}`
})
```

Any union whose members carry a literal discriminant becomes tag-aware with `Schema.toTaggedUnion("type")`.

### Recursive shapes

```ts
import { Schema } from "effect"

type Category = { readonly name: string; readonly children: ReadonlyArray<Category> }

const Category: Schema.Codec<Category> = Schema.Struct({
  name: Schema.String,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category))
})
```

The explicit `Schema.Codec<…>` annotation is the one place a wide annotation is correct. When `Encoded` differs from
`Type`, spell out both: `Schema.Codec<Category, CategoryEncoded>`.

### Classes

- `Schema.Struct` — plain data, structural type. Default.
- `Schema.Opaque<T>()(struct)` — same runtime, nominal TS type. No methods, no `new`.
- `Schema.Class<T>("Id")({...})` — prototype-backed, `instanceof`, methods, `new T(...)` validates.
- `Schema.TaggedClass<T>()("Tag", {...})` — `Class` plus `_tag`.
- `Schema.TaggedError<T>()("Tag", {...})` — for the Effect error channel (below).

```ts
import { Schema } from "effect"

export class Entry extends Schema.Class<Entry>("timeline/Entry")({
  id: Schema.String,
  from: Schema.Int,
  to: Schema.optionalKey(Schema.Int)
}) {
  get isSpan() {
    return this.to !== undefined
  }
}

new Entry({ id: "a", from: 1700 }) // validates, throws on bad input
Entry.make({ id: "a", from: 1700 }) // same
Schema.decodeUnknownSync(Entry)({ id: "a", from: 1700 }) // Entry instance
```

Class identifiers include the module path (`"timeline/Entry"`), as LLMS.md does for services.

## Decoding and encoding

Every parser exists in an `Unknown` variant (input `unknown`) and a typed variant (input already `Encoded` /
`Type`). Use `Unknown` at boundaries; use the typed one when the compiler already knows the shape.

| Result wanted                 | Decode                         | Encode                         |
| ----------------------------- | ------------------------------ | ------------------------------ |
| value or throw `SchemaError`  | `Schema.decodeUnknownSync`     | `Schema.encodeUnknownSync`     |
| `Result<T, SchemaError>`      | `Schema.decodeUnknownResult`   | `Schema.encodeUnknownResult`   |
| `Option<T>`                   | `Schema.decodeUnknownOption`   | `Schema.encodeUnknownOption`   |
| `Exit<T, SchemaError>`        | `Schema.decodeUnknownExit`     | `Schema.encodeUnknownExit`     |
| `Effect<T, SchemaError, R>`   | `Schema.decodeUnknownEffect`   | `Schema.encodeUnknownEffect`   |
| `Promise<T>`                  | `Schema.decodeUnknownPromise`  | `Schema.encodeUnknownPromise`  |
| boolean guard                 | `Schema.is(S)(input)`          |                                |
| assertion                     | `Schema.asserts(S, input)`     |                                |
| construct from `Type` input   | `S.make(input)` / `S.makeOption(input)` |                       |

```ts
import { Effect, Result, Schema } from "effect"

const Entry = Schema.Struct({ id: Schema.String, year: Schema.Int })

// Build the parser once, at module level; it is a plain function afterwards.
export const decodeEntry = Schema.decodeUnknownSync(Entry)
export const decodeEntryResult = Schema.decodeUnknownResult(Entry)
export const decodeEntryEffect = Schema.decodeUnknownEffect(Entry)
export const encodeEntry = Schema.encodeSync(Entry)

decodeEntry({ id: "a", year: 1700 }) // { id: "a", year: 1700 }

const result = decodeEntryResult({ id: "a", year: 1.5 })
if (Result.isFailure(result)) {
  result.failure.message // "Expected an integer\n  at [\"year\"]"
}

const program = Effect.gen(function*() {
  const entry = yield* decodeEntryEffect(JSON.parse("{}"))
  return entry.id
})
```

Which one:

- Inside Effect code: `decodeUnknownEffect`. The failure stays typed in the error channel.
- At a synchronous boundary where you branch on failure: `decodeUnknownResult`. Errors are data.
- At a synchronous boundary where invalid input is a bug: `decodeUnknownSync`. Let it throw.
- Rarely `Option`: it discards the reason.

### Parse options

Options are accepted at parser creation and again per call; the call wins.

```ts
import { Schema } from "effect"

const Entry = Schema.Struct({ id: Schema.String })

const strict = Schema.decodeUnknownExit(Entry, { onExcessProperty: "error", errors: "all" })
strict({ id: "a", extra: 1 }) // Failure: Expected no excess property at ["extra"]
strict({ id: "a", extra: 1 }, { onExcessProperty: "ignore" }) // Success({ id: "a" })
```

- `errors: "all"` collects every issue; the default `"first"` stops at the first one. Use `"all"` for form
  validation, the default for internal boundaries.
- `onExcessProperty` defaults to `"ignore"` and strips unknown keys silently. Set `"error"` when a stray key
  means a bug. To keep extra keys, model them with `Record` or `StructWithRest` instead.
- `reportInput: true` retains the rejected value on the issue and prints it in messages. Off by default; keep it
  off for anything holding credentials or personal data.
- `concurrency` parallelises effectful children of structs, arrays and records. Irrelevant for synchronous
  schemas.

### Types from schemas

```ts
import { Effect, Schema } from "effect"

const Entry = Schema.Struct({
  id: Schema.String,
  year: Schema.Int.pipe(Schema.withConstructorDefault(Effect.succeed(1700)))
})

type Entry = typeof Entry.Type // { readonly id: string; readonly year: number }
type EntryEncoded = typeof Entry.Encoded
type MakeInput = typeof Entry["~type.make.in"] // { readonly id: string; readonly year?: number }
```

Do not annotate a schema const with `Schema.Codec<…>`, `Schema.Schema<…>` or `Schema.Top` (except `suspend`).
Wide annotations erase optionality, mutability and constructor-default information. Use them only as generic
constraints: `<S extends Schema.Top>(schema: S)`.

## Transformations

A transformation pairs two `SchemaGetter`s: `decode` (Encoded → Type) and `encode` (Type → Encoded). Attach it with:

- `Schema.decodeTo(Target, transformation)` — source schema into a different target
- `Schema.decode(transformation)` — same schema both sides (trim, lowercase)
- `Schema.encodeTo` / `Schema.encode` — the same, viewed from the encoded side
- `Schema.decodeTo(Target)` with no transformation — composition, when `Source.Type` feeds `Target.Encoded`

### Built-ins first

| Wire form      | Schema                                                            |
| -------------- | ----------------------------------------------------------------- |
| `"1700"`       | `Schema.FiniteFromString`, `Schema.NumberFromString`              |
| `"12n"`        | `Schema.BigIntFromString`                                         |
| ISO date       | `Schema.DateFromString`, `Schema.DateTimeUtcFromString`           |
| epoch millis   | `Schema.DateFromMillis`, `Schema.DateTimeUtcFromMillis`           |
| `"  x "`       | `Schema.Trim` (transform) vs `Schema.Trimmed` (check only)        |
| JSON string    | `Schema.fromJsonString(S)`, `Schema.UnknownFromJsonString`        |
| base64 / hex   | `Schema.StringFromBase64`, `Schema.Uint8ArrayFromHex`, …          |
| URL            | `Schema.URLFromString`                                            |
| `null` → Option| `Schema.OptionFromNullOr(S)`, `Schema.OptionFromNullishOr(S)`     |
| absent → Option| `Schema.OptionFromOptionalKey(S)`, `Schema.OptionFromOptional(S)` |
| `FormData`     | `Schema.fromFormData(Schema.toCodecStringTree(S))`                |
| query string   | `Schema.fromURLSearchParams(Schema.toCodecStringTree(S))`         |

`Schema.Date` accepts a `Date` instance, not a string. Wire input needs `DateFromString`.

### Custom, total

```ts
import { Schema, SchemaTransformation } from "effect"

export const OnOff = Schema.Literals(["on", "off"]).pipe(
  Schema.decodeTo(
    Schema.Boolean,
    SchemaTransformation.transform({
      decode: (literal) => literal === "on",
      encode: (flag) => (flag ? "on" : "off")
    })
  )
)
```

### Custom, may fail

Fail with a `SchemaIssue`, never a thrown error. Pass the input and options through so `reportInput` works.

```ts
import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect"

export const YearFromLabel = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Int,
    SchemaTransformation.transformEffect({
      decode: (label, options) => {
        const match = /^(\d{4})$/.exec(label.trim())
        return match === null
          ? Effect.fail(new SchemaIssue.InvalidValue({ message: `not a year label: ${label}` }, label, options))
          : Effect.succeed(Number(match[1]))
      },
      encode: (year) => Effect.succeed(String(year))
    })
  )
)
```

Effectful checks that leave the value unchanged use `SchemaGetter.checkEffect` inside `Schema.decode`; they can
call services and run async.

### Defaults

| Where the gap is                         | Use                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------- |
| decoding, key absent, default in Encoded | `Schema.withDecodingDefaultKey(Effect.succeed("1"))`                |
| decoding, absent or undefined            | `Schema.withDecodingDefault(Effect.succeed("1"))`                   |
| decoding, default given as `Type` value  | `Schema.withDecodingDefaultType(Effect.succeed(1))` (+ `Key` form)  |
| `.make` constructor only                 | `Schema.withConstructorDefault(Effect.succeed(1))`                  |
| anything else (null, empty string, …)    | `decodeTo` + `SchemaGetter.transformOptional`                       |

```ts
import { DateTime, Effect, Schema } from "effect"

const Settings = Schema.Struct({
  locale: Schema.Literals(["de", "en"]).pipe(Schema.withDecodingDefault(Effect.succeed("de"))),
  createdAt: Schema.DateTimeUtc.pipe(Schema.withConstructorDefault(DateTime.now))
})

Schema.decodeUnknownSync(Settings)({ createdAt: DateTime.makeUnsafe(0) }) // locale: "de"
Settings.make({ locale: "en" }) // createdAt: now
```

The default is an `Effect` with no requirements, re-run each time a value is missing. `withConstructorDefault`
applies only to `.make`, never to decoding; `withDecodingDefault*` applies only to decoding.

### Optional keys

- `optionalKey(S)`: key may be missing. `undefined` present is an error.
- `optional(S)`: key may be missing or `undefined`.
- `SchemaGetter.transformOptional` sees `Option<Encoded>` and returns `Option<Type>`; `Option.none()` means
  "omit the key".
- `SchemaGetter.omit()` on the encode side drops a field from output; the encoded side must be `optionalKey`.
- `Schema.tagDefaultOmit("Point")` adds a discriminant on decode and drops it on encode.

```ts
import { Option, Predicate, Schema, SchemaGetter } from "effect"

const Quantity = Schema.optionalKey(Schema.NullOr(Schema.String)).pipe(
  Schema.decodeTo(Schema.FiniteFromString, {
    decode: SchemaGetter.transformOptional((maybe) =>
      maybe.pipe(Option.filter(Predicate.isNotNull), Option.orElseSome(() => "1"))
    ),
    encode: SchemaGetter.passthrough()
  })
)
```

### Renaming wire keys

```ts
import { Schema } from "effect"

const Entry = Schema.Struct({ entryId: Schema.String, publishedAt: Schema.DateFromString }).pipe(
  Schema.encodeKeys({ entryId: "entry_id", publishedAt: "published_at" })
)
```

Field names stay `entryId`; only the encoded object uses snake_case. Apply after the struct is complete.

### JSON round trips

`JSON.stringify` loses `Date`, `Map`, `Set`, `Option`, `BigInt`. Derive a JSON codec instead of hand-encoding:

```ts
import { Schema } from "effect"

const Entry = Schema.Struct({ id: Schema.String, publishedAt: Schema.Date })
const EntryJson = Schema.toCodecJson(Entry)

Schema.encodeSync(EntryJson)({ id: "a", publishedAt: new Date(0) }) // { id: "a", publishedAt: "1970-01-01T00:00:00.000Z" }
Schema.decodeUnknownSync(Schema.fromJsonString(EntryJson))(`{"id":"a","publishedAt":"1970-01-01T00:00:00.000Z"}`)
```

For a class or an `instanceOf` schema, supply the JSON shape once with the `toCodecJson` annotation via
`Schema.link`; `toJsonSchemaDocument` reuses the same link. `Schema.toStandardSchemaV1(S)` adapts a schema for
libraries that speak Standard Schema (form libraries, tRPC-style routers).

### Flipping

`Schema.flip(S)` swaps directions; encoding with `S` equals decoding with `flip(S)`. Reach for it when you already
have `NumberFromString` and need `StringFromNumber`.

## Error handling

### What a failure is

Every `Schema.*` parser fails with `Schema.SchemaError`, a `Data.TaggedError("SchemaError")`:

- `error.issue` — the structured `SchemaIssue.Issue` tree (`InvalidType`, `InvalidValue`, `MissingKey`,
  `UnexpectedKey`, `Filter`, `Pointer`, `Composite`, `AnyOf`, `OneOf`, `Encoding`, `Forbidden`)
- `error.message` — the default formatter's text, e.g. `Expected an integer\n  at ["year"]`
- no captured stack; `String(error)` is `SchemaError(<message>)`
- `Schema.isSchemaError(u)` narrows an `unknown`

`SchemaParser.decodeUnknownSync` (the low-level module) throws a plain `Error("Schema validation failed")` with the
issue in `cause` instead. Use the `Schema.*` parsers.

### In Effect code

Map the schema failure to a domain error at the boundary, as `ai-docs/src/01_effect/02_schema/10_schema-basics.ts`
does:

```ts
import { Effect, Schema } from "effect"

const Entry = Schema.Struct({ id: Schema.String, year: Schema.Int })

export class InvalidEntryPayload extends Schema.TaggedError<InvalidEntryPayload>()("InvalidEntryPayload", {
  message: Schema.String
}) {}

const decodeEntry = Schema.decodeUnknownEffect(Entry)

export const parseEntryPayload = Effect.fn("parseEntryPayload")((input: unknown) =>
  decodeEntry(input).pipe(
    Effect.mapError((error) => new InvalidEntryPayload({ message: error.message }))
  )
)
```

Or catch it by tag where a fallback is legitimate:

```ts
import { Effect, Schema } from "effect"

const Locale = Schema.Literals(["de", "en"])

export const localeFromHeader = (header: unknown) =>
  Schema.decodeUnknownEffect(Locale)(header).pipe(
    Effect.catchTag("SchemaError", () => Effect.succeed("de" as const))
  )
```

### At a synchronous boundary

```ts
import { Result, Schema, SchemaIssue } from "effect"

const Entry = Schema.Struct({ id: Schema.NonEmptyString, year: Schema.Int })
const decodeEntry = Schema.decodeUnknownResult(Entry, { errors: "all" })
const toIssues = SchemaIssue.makeFormatterStandardSchemaV1()

export function validateEntryForm(input: unknown) {
  const result = decodeEntry(input)
  return Result.isSuccess(result)
    ? { ok: true as const, entry: result.success }
    : { ok: false as const, issues: toIssues(result.failure.issue).issues }
}
// issues: [{ path: ["id"], message: "Expected a value with a length of at least 1" }, ...]
```

`makeFormatterStandardSchemaV1` yields `{ path, message }[]`, right for rendering next to form fields.
`SchemaIssue.makeFormatterDefault()` yields the single string `error.message` already carries.

### Custom messages

Precedence: `message` annotation on the schema or filter > filter `expected` > identifier > built-in text.

```ts
import { Schema } from "effect"

const Title = Schema.String
  .annotate({ message: "Titel muss ein Text sein" })
  .annotateKey({ messageMissingKey: "Titel fehlt" })
  .check(Schema.isNonEmpty({ message: "Titel darf nicht leer sein" }))

const Entry = Schema.Struct({ title: Title }).annotate({ messageUnexpectedKey: "Unbekanntes Feld" })
```

For i18n across many schemas, pass `leafHook` / `checkHook` to `makeFormatterStandardSchemaV1` instead of
annotating each field (SCHEMA.md § Hooks).

### Filters that report precisely

`Schema.makeFilter` predicates may return:

- `true` / `undefined` — pass
- `false` — fail with `Expected <filter>` (add `title` or `message`)
- `string` — fail with that message
- `{ path, issue }` — fail at a nested path
- an array of the above — several issues at once (`errors: "all"` to see them all)
- a `SchemaIssue.Issue` — escape hatch

Structural filters (`isMinLength` on an array, `isMaxProperties`) run only after every element parsed; a nested
failure hides them even with `errors: "all"`. `Schema.isMinLength(3).abort()` stops the chain on failure.

### Domain errors

`Schema.TaggedError` is the project's error type: serialisable, `_tag` for `Effect.catchTag`, fields validated on
construction, excess properties stripped.

```ts
import { Effect, Schema } from "effect"

export class EntryNotFound extends Schema.TaggedError<EntryNotFound>()("EntryNotFound", {
  id: Schema.String
}) {}

export class EntryConflict extends Schema.TaggedError<EntryConflict>()("EntryConflict", {
  id: Schema.String,
  reason: Schema.Literals(["duplicate", "locked"])
}) {}

declare const loadEntry: (id: string) => Effect.Effect<string, EntryNotFound | EntryConflict>

export const titleOrFallback = (id: string) =>
  loadEntry(id).pipe(
    Effect.catchTags({
      EntryNotFound: () => Effect.succeed("(missing)"),
      EntryConflict: (e) => Effect.succeed(`(conflict: ${e.reason})`)
    })
  )
```

Nest a union of tagged errors under a `reason` field and recover with `Effect.catchReason` when one operation has
many failure modes (`ai-docs/src/01_effect/04_errors/20_reason-errors.ts`). Zero-field errors allow `new E()`.

### Fallbacks inside a schema

`Schema.catchDecoding(() => Effect.succeedSome(fallback))` swallows the failure and substitutes a value;
`Effect.succeedNone` omits an optional key. Use sparingly and only where losing the input is acceptable. Checks
applied after `catchDecoding` still run on the fallback.

## Testing

Plain `vitest` is enough. Assert on what your code hands over, not on Effect's parser (AGENTS.md § Code Style).

```ts
import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"

const Span = Schema.Struct({ from: Schema.Int, to: Schema.Int }).check(
  Schema.makeFilter((s) => s.from <= s.to || { path: ["to"], issue: "to must not precede from" })
)

describe("Span", () => {
  it("rejects a reversed span at the offending key", () => {
    const input = { from: 1721, to: 1700 }

    const result = Schema.decodeUnknownResult(Span)(input)

    expect(Result.isFailure(result) && result.failure.message).toBe('to must not precede from\n  at ["to"]')
  })

  it("round-trips", () => {
    const span = { from: 1700, to: 1721 }

    expect(Schema.decodeUnknownSync(Span)(Schema.encodeSync(Span)(span))).toEqual(span)
  })
})
```

Name every fixture before the call under test. For property tests, `Arbitrary.schema(S)` from `effect/Arbitrary`
generates `Type` values; sampling is an Effect (`Arbitrary.sampleEffect`).

## Avoid

**v3 spellings** (all rejected by the type checker or silently different):

| v3                                        | v4                                                              |
| ----------------------------------------- | --------------------------------------------------------------- |
| `Schema.Literal("a", "b")`                | `Schema.Literals(["a", "b"])`                                   |
| `Schema.Union(A, B)` / `Tuple(A, B)`      | `Schema.Union([A, B])` / `Schema.Tuple([A, B])`                 |
| `Schema.Record({ key, value })`           | `Schema.Record(key, value)`                                     |
| `.annotations({...})`                     | `.annotate({...})`                                              |
| `Schema.filter(pred)`                     | `.check(Schema.makeFilter(pred))`; refinements → `Schema.refine` |
| `minLength(1)`, `int()`, `between(...)`   | `isMinLength(1)`, `isInt()`, `isBetween({ minimum, maximum })`  |
| `positive()`, `nonNegative()`             | removed; `isGreaterThan(0)`, `isGreaterThanOrEqualTo(0)`        |
| `Schema.UUID`, `Schema.ULID`              | `Schema.String.check(Schema.isUUID())`                          |
| `NonEmptyTrimmedString`                   | `Schema.Trimmed.check(Schema.isNonEmpty())`                     |
| `Schema.pick("a")`, `omit`, `partial`     | `.mapFields(Struct.pick(["a"]))`, `Struct.omit`, `Struct.map(Schema.optional)` |
| `Schema.extend(B)`                        | `.pipe(Schema.fieldsAssign(B.fields))`                          |
| `Schema.transform(From, To, {...})`       | `From.pipe(Schema.decodeTo(To, SchemaTransformation.transform({...})))` |
| `transformOrFail` + `ParseResult.fail`    | `SchemaGetter.transformEffect` + `Effect.fail(new SchemaIssue.InvalidValue(...))` |
| `optionalWith(S, { default })`            | `S.pipe(Schema.withDecodingDefaultType(Effect.succeed(x)))`     |
| `decodeUnknownEither`                     | `decodeUnknownResult` (or `Exit`)                               |
| `decodeUnknown` (returns Effect)          | `decodeUnknownEffect`                                           |
| `validate*`                               | `decode*` on `Schema.toType(S)`                                 |
| `ParseResult.ArrayFormatter`              | `SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues` |
| `Schema.Data(S)`                          | removed; `Equal.equals` is structural on plain objects          |
| `Schema.asserts(S)(input)`                | `Schema.asserts(S, input)`                                      |
| `Schema.toArbitrary(S)(fc)`               | `Arbitrary.schema(S)` from `effect/Arbitrary`                   |

**`Schema.Date` changed meaning.** v3 `Schema.Date` parsed strings; v4 `Schema.Date` wants a `Date` instance and
`Schema.DateFromString` parses. Old code type-checks and then rejects every request.

**Wide annotations.** `const Entry: Schema.Codec<Entry, EntryEncoded> = Schema.Struct(...)` compiles and throws
away `.fields`, optionality and `.make` typing. Only `suspend` needs it.

**`optional` vs `optionalKey` with this tsconfig.** `exactOptionalPropertyTypes` is off, so both render as
`key?: T` and TypeScript will not catch a mismatch. Runtime differs: `optionalKey` rejects an explicit `undefined`.
Pick by wire contract, not by what compiles.

**Sync adapters with effectful schemas.** `decodeUnknownSync`, `Result`, `Option`, `is` and `asserts` throw (or
die in `Exit`) when a getter is async or needs a service: `"Sync adapter can only throw schema errors"`. Such
schemas must be run through `decodeUnknownEffect` / `Promise`.

**Constructor defaults with requirements.** `withConstructorDefault` and `withDecodingDefault` take an `Effect`
whose `R` is `never`. Read services through `Effect.serviceOption` if a default is service-dependent.

**Silent excess keys.** The default `onExcessProperty: "ignore"` drops unknown fields on decode and encode. An
admin form that "loses" a field is usually this.

**`Schema.mutable` after an encoding.** Apply `Schema.mutable` before attaching a transformation to the array or
tuple itself; element-level encodings are fine.

**Template literals with transforming parts.** `Schema.TemplateLiteral` throws at construction if a part carries an
encoding (`FiniteFromString`). Use `Schema.Finite` as the part, or `TemplateLiteralParser` when the parts must
decode.

**Throwing inside getters.** A synchronous `throw` inside `SchemaTransformation.transform` escapes every adapter
as a raw exception: `decodeUnknownExit`, `decodeUnknownResult` and even the call that builds the `Effect` all
throw `boom` (verified on rc.117). An `Effect` that dies inside `transformEffect` is at least captured: `Exit`
reports a defect, and the sync and `Result` adapters throw a wrapper (`"Sync adapter can only throw schema
errors"`). Neither is a schema failure. Return `Effect.fail(new SchemaIssue.InvalidValue(...))` from
`transformEffect`, and wrap fallible library calls in `Effect.try` with a `SchemaIssue` in `catch`.

**`reportInput: true` in shared code.** Retained inputs leak into `message`, logs and serialised
`StandardSchemaV1` failures.

**`mapFields` on a checked struct.** Struct-level checks are dropped; `unsafePreserveChecks` reapplies the old
predicate to a shape it may no longer fit.

**Reading `repos/effect/packages/*/src` to choose an approach.** Diagnose there, decide from `SCHEMA.md`. A
behaviour without a documented path is a finding for the owner, not a subclass or monkey-patch.

**Version drift.** `package.json` pins rc.117; `repos/effect` is at rc.118. AGENTS.md § Vendored sources says they
move together. rc.118 also moved `effect/unstable/*` modules to `effect/*`; `Schema` is unaffected, other imports
may be.
