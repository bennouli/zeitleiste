import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import { MEDIA_WIDTHS } from './src/lib/media'

const nextConfig: NextConfig = {
    // Don't let `next dev` write AGENTS.md / CLAUDE.md into the repo.
    agentRules: false,
    images: {
        deviceSizes: [...MEDIA_WIDTHS],
        imageSizes: [],
    },
    experimental: {
        globalNotFound: true,
    },
}

export default withPayload(nextConfig)
