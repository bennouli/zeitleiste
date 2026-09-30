import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // Don't let `next dev` write AGENTS.md / CLAUDE.md into the repo.
    agentRules: false,
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
        ],
    },
    experimental: {
        globalNotFound: true,
    },
}

export default withPayload(nextConfig)
