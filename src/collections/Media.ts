import type { CollectionConfig } from 'payload'
import { text } from 'payload/shared'
import { requiredInGerman } from './requiredInGerman'
import { loggedIn } from './userAccess'

const MEDIA_WIDTHS = [480, 960, 1600] as const

/**
 * Images for posts. `canStoreUploads` is false where an upload would land on a
 * disk that does not outlive the request (Vercel without a Blob store).
 */
export const mediaCollection = ({
    canStoreUploads,
}: {
    canStoreUploads: boolean
}): CollectionConfig => ({
    slug: 'media',
    labels: { singular: 'Bild', plural: 'Bilder' },
    admin: {
        useAsTitle: 'filename',
        defaultColumns: ['filename', 'alt', 'updatedAt'],
    },
    access: {
        read: () => true,
        create: (args) => canStoreUploads && loggedIn(args),
        update: loggedIn,
        delete: loggedIn,
    },
    upload: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
        imageSizes: MEDIA_WIDTHS.map((width) => ({
            name: `w${width}`,
            width,
            withoutEnlargement: true,
        })),
        adminThumbnail: 'w480',
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
            label: 'Alternativtext',
            localized: true,
            validate: requiredInGerman(text),
            admin: {
                description:
                    'Beschreibt das Bild für alle, die es nicht sehen. Pflicht auf Deutsch.',
            },
        },
        {
            name: 'caption',
            type: 'text',
            label: 'Bildunterschrift',
            localized: true,
        },
        {
            name: 'credit',
            type: 'text',
            label: 'Quelle',
            admin: {
                description:
                    'Urheber oder Herkunft, z. B. „Wikimedia Commons“.',
            },
        },
    ],
})
