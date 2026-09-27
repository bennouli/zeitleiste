import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import type { AxeMatchers } from 'vitest-axe/matchers'

// vitest-axe 0.1.0 still augments the pre-1.0 `Vi` namespace and its
// `extend-expect` entry is empty, so register the matcher here and type it
// via Vitest's `Matchers` interface (the documented extension point).
expect.extend(axeMatchers)

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R, T> extends AxeMatchers {}
}

afterEach(() => {
  cleanup()
})
